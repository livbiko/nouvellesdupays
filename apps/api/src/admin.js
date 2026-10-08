const { verifyPassword, createToken, requireAdmin } = require('./adminAuth');
const { crawlSource } = require('@nouvellesdupays/shared/src/crawler');
const { validatePublicHttpUrl, domainOf } = require('@nouvellesdupays/shared/src/urlSafety');
const { tryParseRss, tryParseSitemapNews } = require('./publisherRegistration');
const { cleanText, optionalUrl, urlList, patternList } = require('./security');
const { getSettings, updateSettings, secretStatus, SCHEMA: SETTINGS_SCHEMA } = require('./settings');
const { registerYoutubeAdminRoutes } = require('./youtube');
const { registerAnalyticsAdminRoutes } = require('./analytics');
const { registerDiscoveryAdminRoutes } = require('./discovery');

// Same domain-extraction helper as db/review-submissions.js -- kept as a
// local copy rather than a shared import, matching the existing pattern of
// small single-use helpers not being centralized until a third caller
// actually needs one (see publisherRegistration.js's own local
// escapeBareAmpersands copy for the same reasoning).
function domainFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

const EDITORIAL_TAGS = [
  'public_state', 'government_aligned', 'party_aligned', 'opposition_aligned',
  'independent', 'commercial_generalist', 'editorially_mixed', 'specialist', 'unknown',
];
const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'];

function registerAdminRoutes(fastify) {
  const pool = fastify.pg;

  fastify.post(
    '/api/admin/login',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const { password } = req.body || {};
      const hash = process.env.ADMIN_PASSWORD_HASH;
      const secret = process.env.ADMIN_TOKEN_SECRET;

      if (!hash || !secret) {
        req.log.error('ADMIN_PASSWORD_HASH or ADMIN_TOKEN_SECRET not configured');
        return reply.code(503).send({ error: 'Admin login not configured' });
      }
      if (!password || !verifyPassword(password, hash)) {
        return reply.code(401).send({ error: 'Invalid password' });
      }
      return { token: createToken(secret) };
    }
  );

  // Everything below requires a valid admin token.
  fastify.register(async (admin) => {
    admin.addHook('preHandler', requireAdmin);

    admin.get('/api/admin/submissions', async (req) => {
      const status = req.query.status || 'pending';
      const { rows } = await pool.query(
        `SELECT s.*, c.name AS country_name, c.iso_code
         FROM publisher_submissions s
         JOIN countries c ON c.id = s.country_id
         WHERE ($1::text = 'all' OR s.status = $1 OR ($1 = 'open' AND s.status IN ('submitted', 'pending')))
         ORDER BY s.submitted_at DESC`,
        [status]
      );
      return rows;
    });

    admin.post('/api/admin/submissions/:id/approve', async (req, reply) => {
      const { rows: subs } = await pool.query(
        `SELECT * FROM publisher_submissions WHERE id = $1 AND status IN ('pending', 'submitted')`,
        [req.params.id]
      );
      if (subs.length === 0) {
        return reply.code(404).send({ error: 'No pending submission with that id' });
      }
      const sub = subs[0];
      const domain = domainFromUrl(sub.homepage_url);
      const hasFeed = Boolean(sub.feed_url);

      // Same approve() logic as db/review-submissions.js, kept in sync
      // intentionally -- this endpoint supersedes that script for
      // day-to-day use, but the script stays as a documented fallback if
      // the admin panel/API is ever unreachable. A feed-verified submission
      // goes live immediately (unchanged behaviour); a feed-less one creates
      // the publisher in 'pending' with an inactive crawl source, and only
      // starts being crawled once an admin activates it.
      const { rows: pubRows } = await pool.query(
        `INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain, logo_url,
           youtube_url, facebook_url, instagram_url, tiktok_url, x_url, region, city, description, contact_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (country_id, name) DO UPDATE SET homepage_url = EXCLUDED.homepage_url
         RETURNING id`,
        [sub.country_id, sub.name, sub.homepage_url, hasFeed ? 'active' : 'pending', sub.language, domain,
          sub.logo_url, sub.youtube_url, sub.facebook_url, sub.instagram_url, sub.tiktok_url, sub.x_url,
          sub.region, sub.city, sub.description, sub.contact_email]
      );
      const publisherId = pubRows[0].id;

      if (hasFeed) {
        await pool.query(
          `INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES ($1, $2, $3)
           ON CONFLICT (feed_url) DO NOTHING`,
          [publisherId, sub.feed_url, sub.feed_type]
        );
      } else if (sub.ingestion_method !== 'api') {
        const settings = await getSettings(pool);
        const sourceType = sub.sitemap_url ? 'sitemap' : 'html';
        await pool.query(
          `INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, allowed_domains,
             category_urls, article_url_patterns, respect_robots_txt, enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
           ON CONFLICT (feed_url) DO NOTHING`,
          [publisherId, sub.sitemap_url || sub.homepage_url, sourceType, settings.crawler_default_frequency_minutes,
            [domainOf(sub.homepage_url)], sub.category_urls || [], sub.article_url_patterns || []]
        );
      }

      await pool.query(
        `UPDATE publisher_submissions SET status = 'approved', reviewed_at = now(), status_changed_at = now(),
           publisher_id = $2 WHERE id = $1`,
        [sub.id, publisherId]
      );

      return { status: 'approved', publisher_id: publisherId, live: hasFeed };
    });

    // SUBMITTED -> PENDING REVIEW
    admin.post('/api/admin/submissions/:id/review', async (req, reply) => {
      const { rows } = await pool.query(
        `UPDATE publisher_submissions SET status = 'pending', status_changed_at = now()
         WHERE id = $1 AND status = 'submitted' RETURNING id`,
        [req.params.id]
      );
      if (rows.length === 0) return reply.code(404).send({ error: 'No submitted (unreviewed) submission with that id' });
      return { status: 'pending' };
    });

    // APPROVED/SUSPENDED -> ACTIVE: the publisher's sources start being polled/crawled.
    admin.post('/api/admin/submissions/:id/activate', async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT id, publisher_id, status FROM publisher_submissions WHERE id = $1 AND status IN ('approved', 'suspended')`,
        [req.params.id]
      );
      if (rows.length === 0 || !rows[0].publisher_id) {
        return reply.code(404).send({ error: 'No approved or suspended submission with that id' });
      }
      const { rows: feeds } = await pool.query('SELECT count(*)::int AS n FROM feeds WHERE publisher_id = $1 AND enabled', [rows[0].publisher_id]);
      if (feeds[0].n === 0) {
        return reply.code(409).send({ error: 'This publisher has no enabled source yet -- configure one before activating' });
      }
      await pool.query(`UPDATE publishers SET feed_status = 'active' WHERE id = $1`, [rows[0].publisher_id]);
      await pool.query(
        `UPDATE publisher_submissions SET status = 'active', status_changed_at = now() WHERE id = $1`,
        [rows[0].id]
      );
      return { status: 'active' };
    });

    // APPROVED/ACTIVE -> SUSPENDED: stops ingestion, keeps existing articles.
    admin.post('/api/admin/submissions/:id/suspend', async (req, reply) => {
      const { rows } = await pool.query(
        `UPDATE publisher_submissions SET status = 'suspended', status_changed_at = now(),
           reviewer_note = COALESCE($2, reviewer_note)
         WHERE id = $1 AND status IN ('approved', 'active') RETURNING publisher_id`,
        [req.params.id, cleanText(req.body?.note, 500)]
      );
      if (rows.length === 0) return reply.code(404).send({ error: 'No approved or active submission with that id' });
      if (rows[0].publisher_id) {
        await pool.query(`UPDATE publishers SET feed_status = 'suspended' WHERE id = $1`, [rows[0].publisher_id]);
      }
      return { status: 'suspended' };
    });

    admin.post('/api/admin/submissions/:id/reject', async (req, reply) => {
      const { note } = req.body || {};
      const { rows } = await pool.query(
        `UPDATE publisher_submissions SET status = 'rejected', reviewer_note = $2, reviewed_at = now(),
           status_changed_at = now()
         WHERE id = $1 AND status IN ('pending', 'submitted')
         RETURNING id`,
        [req.params.id, cleanText(note, 500)]
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'No pending submission with that id' });
      }
      return { status: 'rejected' };
    });

    admin.get('/api/admin/publishers', async (req) => {
      const countryIso = req.query.country_iso || null;
      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.homepage_url, p.feed_status, p.language, p.source_type,
                p.terms_url, p.license_status, p.attribution_required, p.logo_url,
                p.youtube_url, p.facebook_url, p.instagram_url, p.tiktok_url, p.x_url,
                p.region, p.city, p.description,
                c.name AS country_name, c.iso_code,
                (SELECT count(*) FROM feeds f WHERE f.publisher_id = p.id) AS feed_count,
                src.last_fetched_at, src.last_success_at, src.last_error, src.last_error_at, src.error_sources,
                src.source_types,
                (SELECT count(*)::int FROM articles a WHERE a.publisher_id = p.id) AS article_count,
                (SELECT max(a.published_at) FROM articles a WHERE a.publisher_id = p.id) AS last_article_at,
                (SELECT count(*)::int FROM analytics_events e
                  WHERE e.publisher_id = p.id AND e.event_name IN ('NewsArticleClick', 'ExternalPublisherClick')
                    AND e.occurred_at > now() - interval '30 days' AND NOT e.is_debug) AS clicks_30d
         FROM publishers p
         JOIN countries c ON c.id = p.country_id
         LEFT JOIN LATERAL (
           SELECT max(f.last_fetched_at) AS last_fetched_at, max(f.last_success_at) AS last_success_at,
                  (array_agg(f.last_error ORDER BY f.last_error_at DESC NULLS LAST))[1] AS last_error,
                  max(f.last_error_at) AS last_error_at,
                  count(*) FILTER (WHERE f.consecutive_failures > 0)::int AS error_sources,
                  array_agg(DISTINCT f.feed_type) AS source_types
           FROM feeds f WHERE f.publisher_id = p.id
         ) src ON true
         WHERE ($1::text IS NULL OR c.iso_code = $1)
         ORDER BY c.name, p.name`,
        [countryIso ? countryIso.toUpperCase() : null]
      );
      return rows;
    });

    admin.patch('/api/admin/publishers/:id', async (req, reply) => {
      const body = req.body || {};
      const enumFields = {
        feed_status: ['active', 'unavailable', 'pending', 'suspended'],
      };
      const plainFields = ['source_type', 'terms_url', 'license_status', 'attribution_required'];
      const textFields = { name: 200, language: 20, region: 120, city: 120, description: 2000 };
      const urlFields = {
        homepage_url: null, logo_url: null,
        youtube_url: ['youtube.com', 'youtu.be'], facebook_url: ['facebook.com', 'fb.com'],
        instagram_url: ['instagram.com'], tiktok_url: ['tiktok.com'], x_url: ['x.com', 'twitter.com'],
      };
      const updates = [];
      for (const [k, v] of Object.entries(body)) {
        if (enumFields[k]) {
          if (!enumFields[k].includes(v)) return reply.code(400).send({ error: `${k} must be one of: ${enumFields[k].join(', ')}` });
          updates.push([k, v]);
        } else if (plainFields.includes(k)) {
          updates.push([k, v]);
        } else if (k in textFields) {
          const t = cleanText(v, textFields[k]);
          if (k === 'name' && !t) return reply.code(400).send({ error: 'name cannot be empty' });
          updates.push([k, t]);
        } else if (k in urlFields) {
          const r = optionalUrl(v, k, urlFields[k] ? { hosts: urlFields[k] } : {});
          if (r.error) return reply.code(400).send({ error: r.error });
          if (k === 'homepage_url' && !r.value) return reply.code(400).send({ error: 'homepage_url cannot be empty' });
          updates.push([k, r.value]);
        }
      }
      if (updates.length === 0) {
        const allowed = [...Object.keys(enumFields), ...plainFields, ...Object.keys(textFields), ...Object.keys(urlFields)];
        return reply.code(400).send({ error: `No updatable fields provided (allowed: ${allowed.join(', ')})` });
      }

      const setClause = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const values = updates.map(([, v]) => v);

      const { rows } = await pool.query(
        `UPDATE publishers SET ${setClause} WHERE id = $1 RETURNING id`,
        [req.params.id, ...values]
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Publisher not found' });
      }
      return { status: 'updated' };
    });

    // Sources (= feeds rows) and their crawl configuration.
    admin.get('/api/admin/publishers/:id/sources', async (req) => {
      const { rows } = await pool.query(
        `SELECT f.*, (SELECT count(*)::int FROM articles a WHERE a.feed_id = f.id) AS article_count
         FROM feeds f WHERE f.publisher_id = $1 ORDER BY f.id`,
        [req.params.id]
      );
      return rows;
    });

    function validateSourceConfig(body) {
      const out = {};
      if (body.crawl_frequency_minutes !== undefined) {
        const v = body.crawl_frequency_minutes;
        if (v === null) out.crawl_frequency_minutes = null;
        else {
          const nMin = Number(v);
          if (!Number.isInteger(nMin) || nMin < 5 || nMin > 10080) return { error: 'crawl_frequency_minutes must be between 5 and 10080' };
          out.crawl_frequency_minutes = nMin;
        }
      }
      if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);
      if (body.respect_robots_txt !== undefined) out.respect_robots_txt = Boolean(body.respect_robots_txt);
      if (body.allowed_domains !== undefined) {
        const list = (Array.isArray(body.allowed_domains) ? body.allowed_domains : String(body.allowed_domains).split(/[\n,]+/))
          .map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
          .filter(Boolean);
        if (list.length > 10 || list.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) return { error: 'allowed_domains must be up to 10 domain names' };
        out.allowed_domains = list;
      }
      if (body.category_urls !== undefined) {
        const r = urlList(body.category_urls, 'category_urls', 20);
        if (r.error) return r;
        out.category_urls = r.value;
      }
      if (body.article_url_patterns !== undefined) {
        const r = patternList(body.article_url_patterns, 20);
        if (r.error) return r;
        out.article_url_patterns = r.value;
      }
      if (body.parser_config !== undefined) {
        if (!body.parser_config || typeof body.parser_config !== 'object' || Array.isArray(body.parser_config)
          || JSON.stringify(body.parser_config).length > 4000) return { error: 'parser_config must be a small JSON object' };
        out.parser_config = JSON.stringify(body.parser_config);
      }
      return { value: out };
    }

    admin.post('/api/admin/publishers/:id/sources', async (req, reply) => {
      const body = req.body || {};
      const { rows: pubs } = await pool.query('SELECT id, homepage_url FROM publishers WHERE id = $1', [req.params.id]);
      if (pubs.length === 0) return reply.code(404).send({ error: 'Publisher not found' });
      const type = body.feed_type;
      if (!['rss', 'atom', 'sitemap-news', 'sitemap', 'html'].includes(type)) return reply.code(400).send({ error: 'Unknown feed_type' });
      const url = validatePublicHttpUrl(String(body.feed_url || ''));
      if (!url.ok) return reply.code(400).send({ error: `feed_url: ${url.error}` });
      const cfg = validateSourceConfig(body);
      if (cfg.error) return reply.code(400).send({ error: cfg.error });
      const c = cfg.value;
      const settings = await getSettings(pool);
      const crawled = type === 'sitemap' || type === 'html';
      const { rows } = await pool.query(
        `INSERT INTO feeds (publisher_id, feed_url, feed_type, crawl_frequency_minutes, enabled, respect_robots_txt,
           allowed_domains, category_urls, article_url_patterns, parser_config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (feed_url) DO NOTHING RETURNING id`,
        [pubs[0].id, url.url, type,
          c.crawl_frequency_minutes !== undefined ? c.crawl_frequency_minutes : (crawled ? settings.crawler_default_frequency_minutes : null),
          c.enabled ?? true, c.respect_robots_txt ?? true,
          c.allowed_domains || (crawled ? [domainOf(pubs[0].homepage_url)] : []),
          c.category_urls || [], c.article_url_patterns || [], c.parser_config || '{}']
      );
      if (rows.length === 0) return reply.code(409).send({ error: 'A source with this URL already exists' });
      return reply.code(201).send({ id: rows[0].id });
    });

    admin.patch('/api/admin/sources/:id', async (req, reply) => {
      const cfg = validateSourceConfig(req.body || {});
      if (cfg.error) return reply.code(400).send({ error: cfg.error });
      const entries = Object.entries(cfg.value);
      if (entries.length === 0) return reply.code(400).send({ error: 'No updatable fields provided' });
      const set = entries.map(([k], i) => `${k} = $${i + 2}${k === 'parser_config' ? '::jsonb' : ''}`).join(', ');
      const { rows } = await pool.query(`UPDATE feeds SET ${set} WHERE id = $1 RETURNING id`, [req.params.id, ...entries.map(([, v]) => v)]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Source not found' });
      return { status: 'updated' };
    });

    // Dry run: fetches the source exactly as the worker would (robots.txt,
    // domain/pattern filters, bounded article fetches) and reports what it
    // found -- nothing is written to articles.
    admin.post(
      '/api/admin/sources/:id/test',
      { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
      async (req, reply) => {
        const { rows } = await pool.query('SELECT * FROM feeds WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return reply.code(404).send({ error: 'Source not found' });
        const feed = rows[0];
        const started = Date.now();
        try {
          if (feed.feed_type === 'rss' || feed.feed_type === 'atom') {
            const r = await tryParseRss(feed.feed_url);
            return { ok: r.verified, detail: r.detail, duration_ms: Date.now() - started };
          }
          if (feed.feed_type === 'sitemap-news') {
            const r = await tryParseSitemapNews(feed.feed_url);
            return { ok: r.verified, detail: r.detail, duration_ms: Date.now() - started };
          }
          const result = await crawlSource(feed, { maxArticles: 5, delayMs: 500 });
          return {
            ok: result.items.length > 0,
            detail: `${result.items.length} article(s) extracted from ${result.fetched} page(s) fetched; ${result.candidates} new candidate URL(s).`,
            sample: result.items.map((i) => ({ title: i.title, link: i.link, published_at: i.isoDate })),
            log: result.log,
            duration_ms: Date.now() - started,
          };
        } catch (err) {
          req.log.warn({ err, feedId: feed.id }, 'source test failed');
          return { ok: false, detail: err.message, duration_ms: Date.now() - started };
        }
      }
    );

    // Runtime settings (never includes secrets; see settings.js).
    admin.get('/api/admin/settings', async () => ({
      settings: await getSettings(pool, { fresh: true }),
      secrets: secretStatus(),
      keys: Object.keys(SETTINGS_SCHEMA),
    }));

    admin.put('/api/admin/settings', async (req, reply) => {
      const result = await updateSettings(pool, req.body || {});
      if (result.error) return reply.code(400).send({ error: result.error });
      return { settings: result.settings, secrets: secretStatus() };
    });

    // Leads (registrations) and contact messages -- personal data, admin only.
    admin.get('/api/admin/leads', async (req) => {
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const { rows } = await pool.query(
        `SELECT l.id, l.email, l.name, c.name AS country_name, l.interests, l.marketing_consent, l.source_page,
                l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.status, l.created_at,
                v.slug AS video_slug
         FROM leads l LEFT JOIN countries c ON c.id = l.country_id LEFT JOIN youtube_videos v ON v.id = l.video_id
         ORDER BY l.created_at DESC LIMIT $1`,
        [limit]
      );
      return rows;
    });

    admin.get('/api/admin/contact-messages', async (req) => {
      const { rows } = await pool.query(
        `SELECT id, name, email, subject, message, status, created_at FROM contact_messages
         WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 500`,
        [['new', 'read', 'archived'].includes(req.query.status) ? req.query.status : null]
      );
      return rows;
    });

    admin.patch('/api/admin/contact-messages/:id', async (req, reply) => {
      const status = req.body?.status;
      if (!['new', 'read', 'archived'].includes(status)) return reply.code(400).send({ error: 'status must be new, read or archived' });
      const { rows } = await pool.query('UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING id', [req.params.id, status]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Message not found' });
      return { status: 'updated' };
    });

    registerYoutubeAdminRoutes(admin, pool);
    registerAnalyticsAdminRoutes(admin, pool);

    // Review queue of the media discovery worker (see ./discovery.js).
    registerDiscoveryAdminRoutes(admin, pool);

    // Outreach reply tracking -- there's no inbox integration, a human marks
    // each invitation's outcome by hand as they see replies land. Read/patch
    // only, matching the same shape as the publishers endpoints above; the
    // sending step itself stays manual/external too (see contacted-status
    // note in discovered_sources -- this table is the record of what was
    // actually sent and how it landed, not a send mechanism).
    admin.get('/api/admin/invitations', async (req) => {
      const status = req.query.status || null;
      const { rows } = await pool.query(
        `SELECT i.*, ds.name AS source_name, ds.homepage_url, c.name AS country_name, c.iso_code
         FROM invitations i
         JOIN discovered_sources ds ON ds.id = i.discovered_source_id
         LEFT JOIN countries c ON c.id = ds.country_id
         WHERE ($1::text IS NULL OR i.status = $1)
         ORDER BY i.sent_at DESC NULLS LAST, i.created_at DESC`,
        [status]
      );
      return rows;
    });

    admin.patch('/api/admin/invitations/:id', async (req, reply) => {
      const allowedStatuses = ['drafted', 'awaiting_approval', 'approved', 'sent', 'opened', 'replied', 'bounced', 'opted_out', 'rejected_by_reviewer'];
      const { status } = req.body || {};
      if (!status || !allowedStatuses.includes(status)) {
        return reply.code(400).send({ error: `status must be one of: ${allowedStatuses.join(', ')}` });
      }
      const { rows } = await pool.query(
        `UPDATE invitations SET status = $2 WHERE id = $1 RETURNING id`,
        [req.params.id, status]
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Invitation not found' });
      }
      return { status: 'updated' };
    });

    // Editorial Lens (Phase 1): a separate satellite table from publishers,
    // authored/reviewed by a human here -- never derived from article
    // content. List view is a LEFT JOIN so publishers with no profile yet
    // still show up (as the honest "not yet assessed" case), and the upsert
    // is a single endpoint since every publisher has at most one profile.
    admin.get('/api/admin/editorial-profiles', async (req) => {
      const countryIso = req.query.country_iso || null;
      const { rows } = await pool.query(
        `SELECT p.id AS publisher_id, p.name AS publisher_name, p.homepage_url,
                c.name AS country_name, c.iso_code,
                ep.id AS profile_id, ep.ownership_type, ep.owner, ep.classification_tags,
                ep.political_party_association, ep.historical_context, ep.current_context,
                ep.confidence, ep.evidence_summary, ep.evidence_sources,
                ep.classification_date, ep.last_reviewed, ep.evidence_date, ep.review_required
         FROM publishers p
         JOIN countries c ON c.id = p.country_id
         LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
         WHERE ($1::text IS NULL OR c.iso_code = $1)
         ORDER BY c.name, p.name`,
        [countryIso ? countryIso.toUpperCase() : null]
      );
      return rows;
    });

    admin.put('/api/admin/editorial-profiles/:publisherId', async (req, reply) => {
      const body = req.body || {};
      const tags = Array.isArray(body.classification_tags) ? body.classification_tags : [];
      const invalidTags = tags.filter((t) => !EDITORIAL_TAGS.includes(t));
      if (invalidTags.length > 0) {
        return reply.code(400).send({ error: `Unknown classification tag(s): ${invalidTags.join(', ')}` });
      }
      const confidence = body.confidence || 'unknown';
      if (!CONFIDENCE_LEVELS.includes(confidence)) {
        return reply.code(400).send({ error: `confidence must be one of: ${CONFIDENCE_LEVELS.join(', ')}` });
      }
      const evidenceSources = Array.isArray(body.evidence_sources) ? body.evidence_sources : [];

      const { rows: pubs } = await pool.query('SELECT id FROM publishers WHERE id = $1', [req.params.publisherId]);
      if (pubs.length === 0) {
        return reply.code(404).send({ error: 'Publisher not found' });
      }

      const { rows } = await pool.query(
        `INSERT INTO editorial_profiles (
           publisher_id, ownership_type, owner, classification_tags,
           political_party_association, historical_context, current_context,
           confidence, evidence_summary, evidence_sources,
           evidence_date, review_required, last_reviewed, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, CURRENT_DATE, now())
         ON CONFLICT (publisher_id) DO UPDATE SET
           ownership_type = EXCLUDED.ownership_type,
           owner = EXCLUDED.owner,
           classification_tags = EXCLUDED.classification_tags,
           political_party_association = EXCLUDED.political_party_association,
           historical_context = EXCLUDED.historical_context,
           current_context = EXCLUDED.current_context,
           confidence = EXCLUDED.confidence,
           evidence_summary = EXCLUDED.evidence_summary,
           evidence_sources = EXCLUDED.evidence_sources,
           evidence_date = EXCLUDED.evidence_date,
           review_required = EXCLUDED.review_required,
           last_reviewed = CURRENT_DATE,
           updated_at = now()
         RETURNING id`,
        [
          req.params.publisherId,
          body.ownership_type || null,
          body.owner || null,
          tags,
          body.political_party_association || null,
          body.historical_context || null,
          body.current_context || null,
          confidence,
          body.evidence_summary || null,
          JSON.stringify(evidenceSources),
          body.evidence_date || null,
          Boolean(body.review_required),
        ]
      );
      return { status: 'saved', profile_id: rows[0].id };
    });
  });
}

module.exports = { registerAdminRoutes };
