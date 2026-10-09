// Public data for the /africa, /africa/<region> and /africa/<country> pages
// of the web app. Country-level content (articles, publishers, video
// channels, Titrologie) keeps coming from the existing per-country
// endpoints; these two only add what those can't give cheaply: per-country
// counts for a whole region in one query, and the latest headlines across a
// region.
const { cleanHeadline } = require('@nouvellesdupays/shared/src/text');

const AFRICAN_REGIONS = ['West Africa', 'East Africa', 'Central Africa', 'North Africa', 'Southern Africa'];

function registerAfricaRoutes(fastify) {
  const pool = fastify.pg;

  // Regions in the fixed order above (West Africa first, the discovery
  // priority), each with its countries and what is live for them.
  fastify.get('/api/africa/summary', async () => {
    const { rows } = await pool.query(
      `SELECT c.iso_code, c.name, c.region, c.capital, c.population, c.flag_url,
         (SELECT count(*) FROM publishers p WHERE p.country_id = c.id AND p.feed_status = 'active')::int AS publishers,
         (SELECT count(*) FROM articles a WHERE a.country_id = c.id AND a.published_at > now() - interval '24 hours' AND a.published_at <= now())::int AS articles_24h,
         (SELECT max(a.published_at) FROM articles a WHERE a.country_id = c.id AND a.published_at <= now()) AS latest_at,
         (SELECT count(*) FROM video_channels v WHERE v.country_id = c.id AND v.category = 'national_tv')::int AS national_tv,
         (SELECT count(*) FROM video_channels v WHERE v.country_id = c.id AND v.category = 'local_voices')::int AS voices
       FROM countries c
       WHERE c.region = ANY($1)
       ORDER BY c.name`,
      [AFRICAN_REGIONS]
    );
    return {
      regions: AFRICAN_REGIONS.map((region) => ({
        region,
        countries: rows.filter((r) => r.region === region).map(({ region: _r, ...rest }) => rest),
      })),
    };
  });

  // Latest headline per publisher across a region, newest first -- the same
  // one-per-publisher rule as the country panel's "Dernières actualités", so
  // one prolific outlet can't fill the whole list.
  fastify.get('/api/africa/regions/:region/articles', async (req, reply) => {
    const region = AFRICAN_REGIONS.find((r) => r.toLowerCase() === String(req.params.region).toLowerCase());
    if (!region) return reply.code(404).send({ error: 'unknown region' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 24, 60);
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (a.publisher_id)
                a.id, a.headline, a.summary, a.image_url, a.original_url, a.category, a.published_at,
                p.id AS publisher_id, p.name AS publisher_name, p.homepage_url AS publisher_url,
                c.iso_code AS country_iso, c.name AS country_name, c.flag_url AS country_flag_url
         FROM articles a
         JOIN publishers p ON p.id = a.publisher_id
         JOIN countries c ON c.id = a.country_id
         WHERE c.region = $1 AND a.published_at > now() - interval '7 days' AND a.published_at <= now()
         ORDER BY a.publisher_id, a.published_at DESC
       ) one_per_publisher
       ORDER BY published_at DESC
       LIMIT $2`,
      [region, limit]
    );
    return rows.map((r) => ({ ...r, headline: cleanHeadline(r.headline) }));
  });
}

module.exports = { registerAfricaRoutes, AFRICAN_REGIONS };
