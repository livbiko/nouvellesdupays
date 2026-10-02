const { cleanText, cleanEmail, spamCheck, rejectForeignOrigin, requireJson, optionalUrl } = require('./security');
const { recordServerConversion } = require('./tracking');
const { getSettings } = require('./settings');

// YouTube channel/video registration and the data behind the automatic
// /youtube/<slug> landing pages.
//
// Metadata comes from YouTube itself wherever possible:
//   * with YOUTUBE_API_KEY set: YouTube Data API v3 (title, description,
//     thumbnails, channel, publication date, privacy status);
//   * without a key: the public, keyless oEmbed endpoint (title, channel,
//     thumbnail) -- description/publication date then fall back to what the
//     submitter typed.
// A 404 from either means the video doesn't exist or was deleted; 401/403
// means it is private or not embeddable. Both are rejected at submission.

const USER_AGENT = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; YouTube metadata lookup)';
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const YT_HOSTS = ['youtube.com', 'm.youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
const THUMB_HOSTS = ['i.ytimg.com', 'img.youtube.com', 'i9.ytimg.com'];

const VIDEO_CATEGORIES = [
  'news', 'politics', 'business', 'technology', 'sports', 'health', 'entertainment',
  'culture', 'education', 'documentary', 'interview', 'other',
];

let fetchImpl = (...args) => fetch(...args);
function setFetch(f) {
  fetchImpl = f || ((...args) => fetch(...args));
}

function parseUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u;
  } catch {
    return null;
  }
}

// watch?v=, youtu.be/, /shorts/, /embed/, /live/, /v/
function parseVideoId(input) {
  const u = parseUrl(input);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1];
  } else if (YT_HOSTS.includes(host)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }
  return id && VIDEO_ID_RE.test(id) ? id : null;
}

// /channel/UC..., /@handle, /c/name, /user/name
function parseChannelUrl(input) {
  const u = parseUrl(input);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (!YT_HOSTS.includes(host)) return null;
  const path = decodeURIComponent(u.pathname);
  let m = path.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
  if (m) return { kind: 'id', id: m[1], url: `https://www.youtube.com/channel/${m[1]}` };
  m = path.match(/^\/@([\p{L}\p{N}._-]{3,100})(?:\/|$)/u);
  if (m) return { kind: 'handle', handle: m[1], url: `https://www.youtube.com/@${m[1]}` };
  m = path.match(/^\/(c|user)\/([\p{L}\p{N}._-]{1,100})(?:\/|$)/u);
  if (m) return { kind: 'legacy', name: m[2], url: `https://www.youtube.com/${m[1]}/${m[2]}` };
  return null;
}

function defaultThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function getJson(url) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
  let body = null;
  if (res.ok) body = await res.json();
  return { status: res.status, ok: res.ok, body };
}

async function fetchVideoMetadata(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  try {
    if (key) {
      const { ok, status, body } = await getJson(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`
      );
      if (!ok) return { status: 'unreachable', detail: `YouTube Data API HTTP ${status}` };
      const item = body.items && body.items[0];
      if (!item) return { status: 'not_found' };
      if (item.status && item.status.privacyStatus === 'private') return { status: 'unavailable' };
      const sn = item.snippet || {};
      const thumbs = sn.thumbnails || {};
      const thumb = (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || {}).url;
      return {
        status: 'ok',
        source: 'youtube_api',
        title: sn.title || null,
        description: sn.description || null,
        thumbnail_url: thumb || defaultThumbnail(videoId),
        channel_name: sn.channelTitle || null,
        youtube_channel_id: sn.channelId || null,
        channel_url: sn.channelId ? `https://www.youtube.com/channel/${sn.channelId}` : null,
        published_at: sn.publishedAt || null,
      };
    }
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const { ok, status, body } = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
    if (status === 404 || status === 400) return { status: 'not_found' };
    if (status === 401 || status === 403) return { status: 'unavailable' };
    if (!ok) return { status: 'unreachable', detail: `oEmbed HTTP ${status}` };
    return {
      status: 'ok',
      source: 'oembed',
      title: body.title || null,
      description: null,
      thumbnail_url: body.thumbnail_url || defaultThumbnail(videoId),
      channel_name: body.author_name || null,
      channel_url: body.author_url || null,
      youtube_channel_id: null,
      published_at: null,
    };
  } catch (err) {
    return { status: 'unreachable', detail: err.message };
  }
}

// Returns { verification: 'verified'|'unverified'|'invalid', youtube_channel_id, name }
async function verifyChannel(parsed) {
  const key = process.env.YOUTUBE_API_KEY;
  try {
    if (key && parsed.kind !== 'legacy') {
      const q = parsed.kind === 'id' ? `id=${parsed.id}` : `forHandle=${encodeURIComponent('@' + parsed.handle)}`;
      const { ok, body } = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=snippet&${q}&key=${encodeURIComponent(key)}`);
      if (ok) {
        const item = body.items && body.items[0];
        if (!item) return { verification: 'invalid' };
        return { verification: 'verified', youtube_channel_id: item.id, name: item.snippet?.title || null };
      }
    }
    if (parsed.kind === 'id') {
      // Keyless: the same public per-channel Atom feed videoChannels.js uses.
      const res = await fetchImpl(`https://www.youtube.com/feeds/videos.xml?channel_id=${parsed.id}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) return { verification: 'invalid' };
      if (!res.ok) return { verification: 'unverified', youtube_channel_id: parsed.id };
      const xml = await res.text();
      const name = (/<title>([^<]+)<\/title>/.exec(xml) || [])[1] || null;
      return { verification: 'verified', youtube_channel_id: parsed.id, name };
    }
    const res = await fetchImpl(parsed.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return { verification: 'invalid' };
    if (!res.ok) return { verification: 'unverified' };
    const html = (await res.text()).slice(0, 2_000_000);
    const id = (/"(?:externalId|channelId)"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/.exec(html) || /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(html) || [])[1];
    const name = (/<meta\s+property="og:title"\s+content="([^"]+)"/.exec(html) || [])[1] || null;
    return id ? { verification: 'verified', youtube_channel_id: id, name } : { verification: 'unverified', name };
  } catch {
    return { verification: 'unverified' };
  }
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

async function uniqueSlug(pool, base, excludeId = null) {
  const root = slugify(base) || 'video';
  for (let i = 1; i < 100; i += 1) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const { rows } = await pool.query('SELECT 1 FROM youtube_videos WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)', [candidate, excludeId]);
    if (rows.length === 0) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function cleanThumbnail(url) {
  const r = optionalUrl(url, 'thumbnail_url');
  if (r.error || !r.value) return null;
  const host = new URL(r.value).hostname.toLowerCase();
  return THUMB_HOSTS.includes(host) && r.value.startsWith('https://') ? r.value : null;
}

async function countryByIso(pool, iso) {
  if (!iso) return null;
  const { rows } = await pool.query('SELECT id, iso_code, name FROM countries WHERE iso_code = $1', [String(iso).toUpperCase().slice(0, 2)]);
  return rows[0] || null;
}

async function upsertChannel(pool, { channelUrl, youtubeChannelId, name, countryId, language, category, verification }) {
  const { rows } = await pool.query(
    `INSERT INTO youtube_channels (channel_url, youtube_channel_id, name, country_id, language, category, verification)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (channel_url) DO UPDATE SET
       youtube_channel_id = COALESCE(youtube_channels.youtube_channel_id, EXCLUDED.youtube_channel_id),
       name = COALESCE(youtube_channels.name, EXCLUDED.name),
       updated_at = now()
     RETURNING id`,
    [channelUrl, youtubeChannelId, name, countryId, language, category, verification]
  );
  return rows[0].id;
}

const PUBLIC_VIDEO_FIELDS = `v.id, v.youtube_video_id, v.slug, v.title, v.description, v.thumbnail_url, v.channel_name,
  v.channel_url, v.language, v.category, v.published_at, v.landing_headline, v.landing_cta_text, v.is_featured,
  v.approved_at, v.country_id, v.publisher_id,
  c.iso_code AS country_iso, c.name AS country_name, c.flag_url AS country_flag_url`;

function publicVideo(row) {
  return {
    id: row.id,
    youtube_video_id: row.youtube_video_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url || defaultThumbnail(row.youtube_video_id),
    channel_name: row.channel_name,
    channel_url: row.channel_url,
    language: row.language,
    category: row.category,
    published_at: row.published_at,
    landing_headline: row.landing_headline,
    landing_cta_text: row.landing_cta_text,
    country_iso: row.country_iso,
    country_name: row.country_name,
    country_flag_url: row.country_flag_url,
  };
}

function registerYoutubeRoutes(fastify) {
  const pool = fastify.pg;
  const writeGuards = [rejectForeignOrigin, requireJson];

  fastify.post(
    '/api/youtube/submit-video',
    { preHandler: writeGuards, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const settings = await getSettings(pool);
      if (!settings.youtube_submissions_open) return reply.code(503).send({ error: 'Video submissions are temporarily closed' });
      const body = req.body || {};
      const spam = spamCheck(body);
      if (spam) return reply.code(400).send({ error: 'Submission rejected', reason: spam });

      const videoId = parseVideoId(body.video_url);
      if (!videoId) return reply.code(400).send({ error: 'Invalid YouTube video URL' });

      let submittedChannel = null;
      if (body.channel_url) {
        submittedChannel = parseChannelUrl(body.channel_url);
        if (!submittedChannel) return reply.code(400).send({ error: 'Invalid YouTube channel URL' });
      }
      const email = cleanEmail(body.contact_email);
      if (!email) return reply.code(400).send({ error: 'A valid contact email is required' });
      const country = await countryByIso(pool, body.country_iso);
      if (!country) return reply.code(400).send({ error: 'A valid country is required' });
      const category = VIDEO_CATEGORIES.includes(body.category) ? body.category : 'news';
      const language = cleanText(body.language, 20);

      const { rows: dupes } = await pool.query('SELECT status FROM youtube_videos WHERE youtube_video_id = $1', [videoId]);
      if (dupes.length > 0) return reply.code(409).send({ error: 'This video has already been submitted' });

      const meta = await fetchVideoMetadata(videoId);
      if (meta.status === 'not_found') {
        return reply.code(422).send({ error: 'Video not found on YouTube (it may have been deleted)' });
      }
      if (meta.status === 'unavailable') {
        return reply.code(422).send({ error: 'This video is private or cannot be embedded' });
      }
      const verified = meta.status === 'ok';
      if (!verified) req.log.warn({ videoId, detail: meta.detail }, 'YouTube metadata lookup failed; storing submitter metadata');

      const title = (verified && meta.title) || cleanText(body.title, 200);
      if (!title) return reply.code(400).send({ error: 'Video title is required (YouTube metadata unavailable)' });

      const channelUrl = (verified && meta.channel_url) || submittedChannel?.url || null;
      const channelName = (verified && meta.channel_name) || cleanText(body.channel_name, 120);
      let channelRowId = null;
      if (channelUrl) {
        const parsedCh = parseChannelUrl(channelUrl);
        channelRowId = await upsertChannel(pool, {
          channelUrl: parsedCh ? parsedCh.url : channelUrl,
          youtubeChannelId: meta.youtube_channel_id || (submittedChannel?.kind === 'id' ? submittedChannel.id : null),
          name: channelName,
          countryId: country.id,
          language,
          category,
          verification: verified ? 'verified' : 'unverified',
        });
      }

      const slug = await uniqueSlug(pool, title);
      const { rows } = await pool.query(
        `INSERT INTO youtube_videos (youtube_video_id, slug, title, description, thumbnail_url, channel_id, channel_name,
           channel_url, country_id, language, category, published_at, contact_email, metadata_source,
           metadata_checked_at, availability, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id, slug, status`,
        [
          videoId, slug, title,
          (verified && meta.description) || cleanText(body.description, 2000),
          (verified && meta.thumbnail_url) || cleanThumbnail(body.thumbnail_url) || defaultThumbnail(videoId),
          channelRowId, channelName, channelUrl ? (parseChannelUrl(channelUrl)?.url || channelUrl) : null,
          country.id, language, category,
          verified && meta.published_at ? meta.published_at : null,
          email,
          verified ? meta.source : 'submitter',
          verified ? new Date() : null,
          verified ? 'available' : 'unknown',
          verified ? 'pending' : 'submitted',
        ]
      );

      const eventId = await recordServerConversion(pool, req, body.tracking, {
        name: 'YouTubeSubmissionCompleted',
        country_iso: country.iso_code,
        email,
        properties: { kind: 'video', category },
      });
      return reply.code(201).send({
        id: rows[0].id,
        status: rows[0].status,
        title,
        metadata_source: verified ? meta.source : 'submitter',
        message: 'Vidéo soumise. Elle sera publiée après validation par notre équipe.',
        conversion_event_id: eventId,
      });
    }
  );

  fastify.post(
    '/api/youtube/submit-channel',
    { preHandler: writeGuards, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const settings = await getSettings(pool);
      if (!settings.youtube_submissions_open) return reply.code(503).send({ error: 'Submissions are temporarily closed' });
      const body = req.body || {};
      const spam = spamCheck(body);
      if (spam) return reply.code(400).send({ error: 'Submission rejected', reason: spam });

      const parsed = parseChannelUrl(body.channel_url);
      if (!parsed) return reply.code(400).send({ error: 'Invalid YouTube channel URL' });
      const email = cleanEmail(body.contact_email);
      if (!email) return reply.code(400).send({ error: 'A valid contact email is required' });
      const country = await countryByIso(pool, body.country_iso);
      if (!country) return reply.code(400).send({ error: 'A valid country is required' });
      const category = VIDEO_CATEGORIES.includes(body.category) ? body.category : 'news';

      const { rows: dupes } = await pool.query(
        'SELECT 1 FROM youtube_channels WHERE channel_url = $1 OR ($2::text IS NOT NULL AND youtube_channel_id = $2)',
        [parsed.url, parsed.kind === 'id' ? parsed.id : null]
      );
      if (dupes.length > 0) return reply.code(409).send({ error: 'This channel has already been submitted' });

      const check = await verifyChannel(parsed);
      if (check.verification === 'invalid') return reply.code(422).send({ error: 'Channel not found on YouTube' });
      if (check.youtube_channel_id) {
        const { rows } = await pool.query('SELECT 1 FROM youtube_channels WHERE youtube_channel_id = $1', [check.youtube_channel_id]);
        if (rows.length > 0) return reply.code(409).send({ error: 'This channel has already been submitted' });
      }

      const { rows } = await pool.query(
        `INSERT INTO youtube_channels (youtube_channel_id, handle, channel_url, name, description, country_id, language,
           category, contact_email, verification, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted')
         RETURNING id`,
        [
          check.youtube_channel_id || null, parsed.kind === 'handle' ? parsed.handle : null, parsed.url,
          check.name || cleanText(body.name, 120), cleanText(body.description, 2000), country.id,
          cleanText(body.language, 20), category, email, check.verification,
        ]
      );
      const eventId = await recordServerConversion(pool, req, body.tracking, {
        name: 'YouTubeSubmissionCompleted',
        country_iso: country.iso_code,
        email,
        properties: { kind: 'channel', category },
      });
      return reply.code(201).send({ id: rows[0].id, status: 'submitted', verification: check.verification, conversion_event_id: eventId });
    }
  );

  fastify.get('/api/youtube/videos', async (req) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 60);
    const iso = req.query.country ? String(req.query.country).toUpperCase().slice(0, 2) : null;
    const category = VIDEO_CATEGORIES.includes(req.query.category) ? req.query.category : null;
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_VIDEO_FIELDS}
       FROM youtube_videos v LEFT JOIN countries c ON c.id = v.country_id
       WHERE v.status = 'approved' AND ($1::text IS NULL OR c.iso_code = $1) AND ($2::text IS NULL OR v.category = $2)
       ORDER BY v.is_featured DESC, v.approved_at DESC NULLS LAST
       LIMIT $3`,
      [iso, category, limit]
    );
    return rows.map(publicVideo);
  });

  // Landing-page payload: the approved video plus everything the page shows
  // around it, in one round-trip so the server-rendered page stays fast.
  fastify.get('/api/youtube/videos/:slug', async (req, reply) => {
    const key = String(req.params.slug).slice(0, 80);
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_VIDEO_FIELDS}
       FROM youtube_videos v LEFT JOIN countries c ON c.id = v.country_id
       WHERE v.status = 'approved' AND (v.slug = $1 OR v.youtube_video_id = $1)`,
      [key]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
    const v = rows[0];
    const settings = await getSettings(pool);

    const [country, publisher, related, news] = await Promise.all([
      v.country_id
        ? pool.query('SELECT iso_code, name, region, capital, population, languages, flag_url FROM countries WHERE id = $1', [v.country_id])
        : { rows: [] },
      v.publisher_id
        ? pool.query('SELECT id, name, homepage_url, logo_url FROM publishers WHERE id = $1', [v.publisher_id])
        : { rows: [] },
      settings.landing_show_related_videos
        ? pool.query(
          `SELECT ${PUBLIC_VIDEO_FIELDS}
           FROM youtube_videos v LEFT JOIN countries c ON c.id = v.country_id
           WHERE v.status = 'approved' AND v.id <> $1 AND (v.country_id = $2 OR v.category = $3)
           ORDER BY (v.country_id = $2) DESC, v.approved_at DESC NULLS LAST
           LIMIT 6`,
          [v.id, v.country_id, v.category]
        )
        : { rows: [] },
      settings.landing_show_related_news && v.country_id
        ? pool.query(
          `SELECT * FROM (
             SELECT DISTINCT ON (a.publisher_id) a.id, a.headline, a.original_url, a.published_at, a.image_url,
                    p.id AS publisher_id, p.name AS publisher_name
             FROM articles a JOIN publishers p ON p.id = a.publisher_id
             WHERE a.country_id = $1
             ORDER BY a.publisher_id, a.published_at DESC NULLS LAST
           ) x ORDER BY published_at DESC NULLS LAST LIMIT 6`,
          [v.country_id]
        )
        : { rows: [] },
    ]);

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      video: publicVideo(v),
      country: country.rows[0] || null,
      publisher: publisher.rows[0] || null,
      related_videos: related.rows.map(publicVideo),
      related_news: news.rows,
      cta_text: v.landing_cta_text || settings.landing_cta_text,
    };
  });
}

function registerYoutubeAdminRoutes(admin, pool) {
  admin.get('/api/admin/youtube/videos', async (req) => {
    const status = req.query.status || 'all';
    const { rows } = await pool.query(
      `SELECT v.*, c.iso_code AS country_iso, c.name AS country_name
       FROM youtube_videos v LEFT JOIN countries c ON c.id = v.country_id
       WHERE ($1::text = 'all' OR v.status = $1)
       ORDER BY v.submitted_at DESC LIMIT 500`,
      [status]
    );
    return rows;
  });

  const TRANSITIONS = {
    review: { from: ['submitted'], to: 'pending' },
    approve: { from: ['submitted', 'pending', 'suspended'], to: 'approved' },
    reject: { from: ['submitted', 'pending'], to: 'rejected' },
    suspend: { from: ['approved'], to: 'suspended' },
  };

  for (const [action, t] of Object.entries(TRANSITIONS)) {
    admin.post(`/api/admin/youtube/videos/:id/${action}`, async (req, reply) => {
      const { rows: current } = await pool.query('SELECT id, status, availability FROM youtube_videos WHERE id = $1', [req.params.id]);
      if (current.length === 0) return reply.code(404).send({ error: 'Video not found' });
      if (!t.from.includes(current[0].status)) {
        return reply.code(409).send({ error: `Cannot ${action} a video in status "${current[0].status}"` });
      }
      if (action === 'approve' && current[0].availability === 'unavailable') {
        return reply.code(409).send({ error: 'Video is unavailable on YouTube; refresh its metadata first' });
      }
      const note = cleanText(req.body?.note, 500);
      await pool.query(
        `UPDATE youtube_videos SET status = $2, reviewer_note = COALESCE($3, reviewer_note), updated_at = now(),
           approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(approved_at, now()) ELSE approved_at END
         WHERE id = $1`,
        [req.params.id, t.to, note]
      );
      return { status: t.to };
    });
  }

  admin.post('/api/admin/youtube/videos/:id/refresh', async (req, reply) => {
    const { rows } = await pool.query('SELECT id, youtube_video_id FROM youtube_videos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
    const meta = await fetchVideoMetadata(rows[0].youtube_video_id);
    if (meta.status === 'unreachable') return reply.code(502).send({ error: 'YouTube could not be reached', detail: meta.detail });
    if (meta.status !== 'ok') {
      await pool.query(
        `UPDATE youtube_videos SET availability = 'unavailable', metadata_checked_at = now(), updated_at = now(),
           status = CASE WHEN status = 'approved' THEN 'suspended' ELSE status END
         WHERE id = $1`,
        [rows[0].id]
      );
      return { availability: 'unavailable', detail: meta.status };
    }
    await pool.query(
      `UPDATE youtube_videos SET title = COALESCE($2, title), description = COALESCE($3, description),
         thumbnail_url = COALESCE($4, thumbnail_url), channel_name = COALESCE($5, channel_name),
         channel_url = COALESCE($6, channel_url), published_at = COALESCE($7, published_at),
         metadata_source = $8, metadata_checked_at = now(), availability = 'available', updated_at = now()
       WHERE id = $1`,
      [rows[0].id, meta.title, meta.description, meta.thumbnail_url, meta.channel_name, meta.channel_url, meta.published_at, meta.source]
    );
    return { availability: 'available', metadata_source: meta.source };
  });

  admin.patch('/api/admin/youtube/videos/:id', async (req, reply) => {
    const b = req.body || {};
    const sets = [];
    const values = [req.params.id];
    const push = (col, val) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };
    if (b.slug !== undefined) {
      const slug = String(b.slug).toLowerCase().trim();
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return reply.code(400).send({ error: 'slug must be lowercase letters, digits and hyphens' });
      const { rows } = await pool.query('SELECT 1 FROM youtube_videos WHERE slug = $1 AND id <> $2', [slug, req.params.id]);
      if (rows.length > 0) return reply.code(409).send({ error: 'slug already in use' });
      push('slug', slug);
    }
    if (b.title !== undefined) {
      const title = cleanText(b.title, 200);
      if (!title) return reply.code(400).send({ error: 'title cannot be empty' });
      push('title', title);
    }
    if (b.description !== undefined) push('description', cleanText(b.description, 5000));
    if (b.landing_headline !== undefined) push('landing_headline', cleanText(b.landing_headline, 200));
    if (b.landing_cta_text !== undefined) push('landing_cta_text', cleanText(b.landing_cta_text, 200));
    if (b.language !== undefined) push('language', cleanText(b.language, 20));
    if (b.category !== undefined) {
      if (!VIDEO_CATEGORIES.includes(b.category)) return reply.code(400).send({ error: 'Unknown category' });
      push('category', b.category);
    }
    if (b.is_featured !== undefined) push('is_featured', Boolean(b.is_featured));
    if (b.country_iso !== undefined) {
      const c = await countryByIso(pool, b.country_iso);
      if (!c) return reply.code(400).send({ error: 'Unknown country' });
      push('country_id', c.id);
    }
    if (b.publisher_id !== undefined) {
      if (b.publisher_id === null) push('publisher_id', null);
      else {
        const { rows } = await pool.query('SELECT id FROM publishers WHERE id = $1', [b.publisher_id]);
        if (rows.length === 0) return reply.code(400).send({ error: 'Unknown publisher' });
        push('publisher_id', rows[0].id);
      }
    }
    if (sets.length === 0) return reply.code(400).send({ error: 'No updatable fields provided' });
    const { rows } = await pool.query(
      `UPDATE youtube_videos SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id, slug`,
      values
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'Video not found' });
    return { status: 'updated', slug: rows[0].slug };
  });

  admin.get('/api/admin/youtube/channels', async (req) => {
    const status = req.query.status || 'all';
    const { rows } = await pool.query(
      `SELECT ch.*, c.iso_code AS country_iso, c.name AS country_name,
              (SELECT count(*)::int FROM youtube_videos v WHERE v.channel_id = ch.id) AS video_count
       FROM youtube_channels ch LEFT JOIN countries c ON c.id = ch.country_id
       WHERE ($1::text = 'all' OR ch.status = $1)
       ORDER BY ch.submitted_at DESC LIMIT 500`,
      [status]
    );
    return rows;
  });

  const CH_TRANSITIONS = {
    approve: { from: ['submitted', 'pending', 'suspended'], to: 'approved' },
    reject: { from: ['submitted', 'pending'], to: 'rejected' },
    suspend: { from: ['approved'], to: 'suspended' },
  };
  for (const [action, t] of Object.entries(CH_TRANSITIONS)) {
    admin.post(`/api/admin/youtube/channels/:id/${action}`, async (req, reply) => {
      const { rows } = await pool.query('SELECT status, verification FROM youtube_channels WHERE id = $1', [req.params.id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Channel not found' });
      if (!t.from.includes(rows[0].status)) return reply.code(409).send({ error: `Cannot ${action} a channel in status "${rows[0].status}"` });
      if (action === 'approve' && rows[0].verification === 'invalid') return reply.code(409).send({ error: 'Channel failed verification' });
      await pool.query(
        `UPDATE youtube_channels SET status = $2, reviewer_note = COALESCE($3, reviewer_note), reviewed_at = now(), updated_at = now() WHERE id = $1`,
        [req.params.id, t.to, cleanText(req.body?.note, 500)]
      );
      return { status: t.to };
    });
  }
}

module.exports = {
  registerYoutubeRoutes,
  registerYoutubeAdminRoutes,
  parseVideoId,
  parseChannelUrl,
  fetchVideoMetadata,
  verifyChannel,
  slugify,
  setFetch,
  VIDEO_CATEGORIES,
};
