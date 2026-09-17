const { registerPublisherSubmissionRoute } = require('./publisherRegistration');
const { registerAdminRoutes } = require('./admin');
const { withLatestVideos } = require('./videoChannels');
const { clusterArticles, primaryTag } = require('@nouvellesdupays/shared/src/titrologie');

async function routes(fastify) {
  const pool = fastify.pg;
  registerPublisherSubmissionRoute(fastify);
  registerAdminRoutes(fastify);

  fastify.get('/health', async () => {
    await pool.query('SELECT 1');
    return { status: 'ok', db: 'connected' };
  });

  fastify.get('/api/countries', async () => {
    const { rows } = await pool.query(
      `SELECT iso_code, name, region, capital, population, languages, timezone, flag_url, lat, lng
       FROM countries ORDER BY name`
    );
    return rows;
  });

  fastify.get('/api/countries/:iso', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const { rows } = await pool.query(
      `SELECT iso_code, name, region, capital, population, languages, timezone, flag_url, lat, lng
       FROM countries WHERE iso_code = $1`,
      [iso]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'country not found' });
    return rows[0];
  });

  // Source Card grid (Phase 4): the same publisher list the country panel
  // always fetched, now widened with the fields a card needs -- feed
  // link/type (LATERAL, since a publisher could technically have more than
  // one feed row but only one is ever wired up in practice), social links
  // (nullable, unpopulated for most publishers today -- the frontend just
  // omits a button when a field is null, never fabricates one), and the
  // same editorial_tags/confidence pair articles already carry.
  fastify.get('/api/countries/:iso/publishers', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.homepage_url, p.logo_url, p.feed_status, p.language,
              p.source_type, p.youtube_url, p.facebook_url, p.instagram_url, p.tiktok_url,
              f.feed_url, f.feed_type,
              ep.classification_tags AS editorial_tags, ep.confidence AS editorial_confidence
       FROM publishers p
       JOIN countries c ON c.id = p.country_id
       LEFT JOIN LATERAL (
         SELECT feed_url, feed_type FROM feeds WHERE publisher_id = p.id ORDER BY id LIMIT 1
       ) f ON true
       LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
       WHERE c.iso_code = $1
       ORDER BY p.name`,
      [iso]
    );
    return rows;
  });

  // "À la une" featured strip: latest article from each of a country's
  // curated top outlets (publishers.is_top_outlet), ordered by the human-
  // assigned top_outlet_rank. A top outlet with no articles yet (feed still
  // pending, like a freshly-onboarded publisher) simply produces no row --
  // the frontend renders nothing for it rather than an empty card.
  fastify.get('/api/countries/:iso/featured', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (p.id)
                a.id, a.headline, a.summary, a.image_url, a.original_url, a.author,
                a.category, a.published_at, p.id AS publisher_id, p.name AS publisher_name,
                p.homepage_url AS publisher_url, p.top_outlet_rank,
                ep.classification_tags AS editorial_tags, ep.confidence AS editorial_confidence
         FROM publishers p
         JOIN countries c ON c.id = p.country_id
         JOIN articles a ON a.publisher_id = p.id
         LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
         WHERE c.iso_code = $1 AND p.is_top_outlet
         ORDER BY p.id, a.published_at DESC NULLS LAST
       ) latest_per_top_outlet
       ORDER BY top_outlet_rank NULLS LAST, publisher_name`,
      [iso]
    );
    return rows;
  });

  // Video rail (phase 1): Live Now / {Country} Voices / National TV. One
  // query per category rather than three round-trips from the frontend,
  // since all three tabs load together the moment the rail's first tab is
  // opened. Live Now additionally pulls in `always_show_in_world` rows
  // regardless of country -- the handful of major global broadcasters every
  // country's Live Now tab shows alongside its own entries -- with the
  // selected country's own rows sorted first. Live Now excludes any channel
  // already listed as the selected country's National TV entry -- the
  // original rollout frequently inserted the same broadcaster into both
  // categories for a given country, so without this the two sections would
  // show the identical channel twice.
  //
  // `local_voices` (was `africa_voices` until the Voices rollout went
  // worldwide -- see migration 009) holds each country's own vetted local
  // creators/outlets, displayed in the UI as "{Country} Voices".
  fastify.get('/api/countries/:iso/video-channels', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const countryRes = await pool.query('SELECT id FROM countries WHERE iso_code = $1', [iso]);
    if (countryRes.rows.length === 0) return reply.code(404).send({ error: 'country not found' });
    const countryId = countryRes.rows[0].id;

    const [liveNow, localVoices, nationalTv] = await Promise.all([
      pool.query(
        `SELECT vc.id, vc.name, vc.description, vc.topic, vc.platform, vc.youtube_channel_id,
                vc.channel_url, vc.page_url, vc.logo_url, c.iso_code AS country_iso, c.name AS country_name,
                (vc.country_id = $1) AS is_selected_country
         FROM video_channels vc
         JOIN countries c ON c.id = vc.country_id
         WHERE vc.category = 'live_now' AND (vc.country_id = $1 OR vc.always_show_in_world)
           AND NOT EXISTS (
             SELECT 1 FROM video_channels nt
             WHERE nt.category = 'national_tv' AND nt.country_id = $1
               AND (
                 (vc.youtube_channel_id IS NOT NULL AND nt.youtube_channel_id = vc.youtube_channel_id)
                 OR (vc.youtube_channel_id IS NULL AND nt.name = vc.name)
               )
           )
         ORDER BY is_selected_country DESC, vc.rank NULLS LAST, vc.name`,
        [countryId]
      ),
      pool.query(
        `SELECT vc.id, vc.name, vc.description, vc.topic, vc.platform, vc.youtube_channel_id,
                vc.channel_url, vc.page_url, vc.logo_url
         FROM video_channels vc
         WHERE vc.category = 'local_voices' AND vc.country_id = $1
         ORDER BY vc.rank NULLS LAST, vc.name`,
        [countryId]
      ),
      pool.query(
        `SELECT vc.id, vc.name, vc.description, vc.topic, vc.platform, vc.youtube_channel_id,
                vc.channel_url, vc.page_url, vc.logo_url
         FROM video_channels vc
         WHERE vc.category = 'national_tv' AND vc.country_id = $1
         ORDER BY vc.rank NULLS LAST, vc.name`,
        [countryId]
      ),
    ]);

    const [liveNowRows, localVoicesRows, nationalTvRows] = await Promise.all([
      withLatestVideos(liveNow.rows),
      withLatestVideos(localVoices.rows),
      withLatestVideos(nationalTv.rows),
    ]);

    return { live_now: liveNowRows, local_voices: localVoicesRows, national_tv: nationalTvRows };
  });

  fastify.get('/api/countries/:iso/articles', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const category = req.query.category || null;
    // Opt-in, not the endpoint's default -- this only changes behavior for
    // callers that ask for it (the "Dernières actualités" panel), so
    // anything else hitting this public endpoint keeps getting the raw,
    // undeduplicated feed unless it explicitly asks otherwise.
    const distinctPublisher = req.query.distinct_publisher === '1' || req.query.distinct_publisher === 'true';

    // editorial_tags/editorial_confidence ride along on every article row so
    // the publisher-name badge in CountryPanel needs zero extra requests --
    // only clicking through to the full Editorial Lens panel calls
    // GET /api/publishers/:id/editorial-profile below. A publisher with no
    // profile (the common case today) gets NULL on both, which the frontend
    // renders as no badge at all -- never a guess.
    const { rows } = await pool.query(
      distinctPublisher
        ? `SELECT * FROM (
             SELECT DISTINCT ON (a.publisher_id)
                    a.id, a.headline, a.summary, a.image_url, a.original_url, a.author,
                    a.category, a.published_at, p.id AS publisher_id, p.name AS publisher_name,
                    p.homepage_url AS publisher_url, ep.classification_tags AS editorial_tags,
                    ep.confidence AS editorial_confidence
             FROM articles a
             JOIN publishers p ON p.id = a.publisher_id
             JOIN countries c ON c.id = a.country_id
             LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
             WHERE c.iso_code = $1 AND ($2::text IS NULL OR a.category = $2)
             ORDER BY a.publisher_id, a.published_at DESC NULLS LAST
           ) one_per_publisher
           ORDER BY published_at DESC NULLS LAST
           LIMIT $3 OFFSET $4`
        : `SELECT a.id, a.headline, a.summary, a.image_url, a.original_url, a.author,
                  a.category, a.published_at, p.id AS publisher_id, p.name AS publisher_name,
                  p.homepage_url AS publisher_url, ep.classification_tags AS editorial_tags,
                  ep.confidence AS editorial_confidence
           FROM articles a
           JOIN publishers p ON p.id = a.publisher_id
           JOIN countries c ON c.id = a.country_id
           LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
           WHERE c.iso_code = $1 AND ($2::text IS NULL OR a.category = $2)
           ORDER BY a.published_at DESC NULLS LAST
           LIMIT $3 OFFSET $4`,
      [iso, category, limit, offset]
    );
    return rows;
  });

  // Titrologie (Phase 5): groups the last 48h of coverage into stories, then
  // keeps only the stories where ≥2 outlets carrying ≥2 different editorial
  // classifications actually covered the same thing -- see
  // packages/shared/src/titrologie.js for the clustering logic and its
  // tuning notes. Only articles from publishers with an authored,
  // non-'unknown' profile participate, matching the badge's own visibility
  // rule -- an unassessed outlet can't be placed in any perspective column.
  fastify.get('/api/countries/:iso/titrologie', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const { rows } = await pool.query(
      `SELECT a.id, a.headline, a.original_url, a.published_at,
              p.id AS publisher_id, p.name AS publisher_name,
              ep.classification_tags
       FROM articles a
       JOIN publishers p ON p.id = a.publisher_id
       JOIN countries c ON c.id = a.country_id
       JOIN editorial_profiles ep ON ep.publisher_id = p.id
       WHERE c.iso_code = $1
         AND a.published_at > now() - interval '48 hours'
         AND ep.confidence <> 'unknown'
         AND array_length(ep.classification_tags, 1) > 0
       ORDER BY a.published_at DESC
       LIMIT 300`,
      [iso]
    );

    const clusters = clusterArticles(rows)
      .sort((a, b) => new Date(b[0].published_at) - new Date(a[0].published_at))
      .slice(0, 6)
      .map((group) => ({
        headline: group[0].headline,
        articles: group
          .map((a) => ({
            headline: a.headline,
            original_url: a.original_url,
            published_at: a.published_at,
            publisher_name: a.publisher_name,
            tag: primaryTag(a.classification_tags),
          }))
          .sort((a, b) => new Date(b.published_at) - new Date(a.published_at)),
      }));

    return clusters;
  });

  // Read-only, public: the Editorial Lens panel's full detail view. Only
  // returns a row once a human has authored one via /admin/editorial --
  // 404 (not an empty object) when unassessed, so the frontend's "no badge
  // without a profile" rule has an unambiguous signal to key off.
  fastify.get('/api/publishers/:id/editorial-profile', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT p.id AS publisher_id, p.name AS publisher_name, c.name AS country_name,
              ep.ownership_type, ep.owner, ep.classification_tags, ep.political_party_association,
              ep.historical_context, ep.current_context, ep.confidence, ep.evidence_summary,
              ep.evidence_sources, ep.classification_date, ep.last_reviewed, ep.evidence_date
       FROM publishers p
       JOIN countries c ON c.id = p.country_id
       JOIN editorial_profiles ep ON ep.publisher_id = p.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'No editorial profile for this publisher' });
    return rows[0];
  });

  fastify.get('/api/articles/:id', async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT a.*, p.name AS publisher_name, p.homepage_url AS publisher_url
       FROM articles a
       JOIN publishers p ON p.id = a.publisher_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'article not found' });
    return rows[0];
  });
}

module.exports = routes;
