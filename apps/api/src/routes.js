const { registerPublisherSubmissionRoute } = require('./publisherRegistration');

async function routes(fastify) {
  const pool = fastify.pg;
  registerPublisherSubmissionRoute(fastify);

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

    const { rows } = await pool.query(
      `SELECT a.id, a.headline, a.summary, a.image_url, a.original_url, a.author,
              a.category, a.published_at, p.name AS publisher_name, p.homepage_url AS publisher_url
       FROM articles a
       JOIN publishers p ON p.id = a.publisher_id
       JOIN countries c ON c.id = a.country_id
       WHERE c.iso_code = $1 AND ($2::text IS NULL OR a.category = $2)
       ORDER BY a.published_at DESC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [iso, category, limit, offset]
    );
    return rows;
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
