const { verifyPassword, createToken, requireAdmin } = require('./adminAuth');

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
