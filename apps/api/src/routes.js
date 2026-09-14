const { registerPublisherSubmissionRoute } = require('./publisherRegistration');
const { registerAdminRoutes } = require('./admin');

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

  fastify.get('/api/countries/:iso/publishers', async (req, reply) => {
    const iso = req.params.iso.toUpperCase();
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.homepage_url, p.logo_url, p.feed_status, p.language
       FROM publishers p
       JOIN countries c ON c.id = p.country_id
       WHERE c.iso_code = $1
       ORDER BY p.name`,
      [iso]
    );
    return rows;
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
