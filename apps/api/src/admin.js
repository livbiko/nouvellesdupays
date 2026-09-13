const { verifyPassword, createToken, requireAdmin } = require('./adminAuth');

// Same domain-extraction helper as db/review-submissions.js -- kept as a
// local copy rather than a shared import, matching the existing pattern of
// small single-use helpers not being centralized until a third caller
// actually needs one (see publisherRegistration.js's own local
// escapeBareAmpersands copy for the same reasoning).
function domainFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

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
         WHERE ($1::text = 'all' OR s.status = $1)
         ORDER BY s.submitted_at DESC`,
        [status]
      );
      return rows;
    });

    admin.post('/api/admin/submissions/:id/approve', async (req, reply) => {
      const { rows: subs } = await pool.query(
        `SELECT * FROM publisher_submissions WHERE id = $1 AND status = 'pending'`,
        [req.params.id]
      );
      if (subs.length === 0) {
        return reply.code(404).send({ error: 'No pending submission with that id' });
      }
      const sub = subs[0];
      const domain = domainFromUrl(sub.homepage_url);

      // Same approve() logic as db/review-submissions.js, kept in sync
      // intentionally -- this endpoint supersedes that script for
      // day-to-day use, but the script stays as a documented fallback if
      // the admin panel/API is ever unreachable.
      const { rows: pubRows } = await pool.query(
        `INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain)
         VALUES ($1, $2, $3, 'active', $4, $5)
         ON CONFLICT (country_id, name) DO UPDATE SET homepage_url = EXCLUDED.homepage_url
         RETURNING id`,
        [sub.country_id, sub.name, sub.homepage_url, sub.language, domain]
      );
      const publisherId = pubRows[0].id;

      await pool.query(
        `INSERT INTO feeds (publisher_id, feed_url, feed_type) VALUES ($1, $2, $3)
         ON CONFLICT (feed_url) DO NOTHING`,
        [publisherId, sub.feed_url, sub.feed_type]
      );

      await pool.query(
        `UPDATE publisher_submissions SET status = 'approved', reviewed_at = now() WHERE id = $1`,
        [sub.id]
      );

      return { status: 'approved', publisher_id: publisherId };
    });

    admin.post('/api/admin/submissions/:id/reject', async (req, reply) => {
      const { note } = req.body || {};
      const { rows } = await pool.query(
        `UPDATE publisher_submissions SET status = 'rejected', reviewer_note = $2, reviewed_at = now()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [req.params.id, note || null]
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
                p.terms_url, p.license_status, p.attribution_required,
                c.name AS country_name, c.iso_code,
                (SELECT count(*) FROM feeds f WHERE f.publisher_id = p.id) AS feed_count
         FROM publishers p
         JOIN countries c ON c.id = p.country_id
         WHERE ($1::text IS NULL OR c.iso_code = $1)
         ORDER BY c.name, p.name`,
        [countryIso ? countryIso.toUpperCase() : null]
      );
      return rows;
    });

    admin.patch('/api/admin/publishers/:id', async (req, reply) => {
      const allowed = ['feed_status', 'source_type', 'terms_url', 'license_status', 'attribution_required'];
      const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
      if (updates.length === 0) {
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

    // Read-only view over discovered_sources -- write endpoints (creating
    // candidates) belong to the discovery engine (Phase B), not this
    // admin-panel phase. This just lets a human see what's there today
    // (nothing, until Phase B ships) without needing psql access.
    admin.get('/api/admin/discovered-sources', async (req) => {
      const status = req.query.status || null;
      const { rows } = await pool.query(
        `SELECT ds.*, c.name AS country_name, c.iso_code
         FROM discovered_sources ds
         LEFT JOIN countries c ON c.id = ds.country_id
         WHERE ($1::text IS NULL OR ds.status = $1)
         ORDER BY ds.created_at DESC`,
        [status]
      );
      return rows;
    });
  });
}

module.exports = { registerAdminRoutes };
