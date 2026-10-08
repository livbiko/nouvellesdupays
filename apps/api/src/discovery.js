// Admin side of the media discovery worker (apps/worker/src/discover.js):
// the review queue for discovered_sources. Promoting a candidate creates an
// ordinary publisher_submissions row, so it then goes through the exact same
// approve -> active flow as a self-registered publisher; nothing here writes
// to publishers or feeds directly.
const { normalizeCandidateUrl } = require('@nouvellesdupays/shared/src/discovery');
const { cleanText } = require('./security');

const STATUSES = ['discovered', 'under_review', 'verified', 'contacted', 'invited', 'registered', 'rejected'];
const HEALTH = ['unchecked', 'ok', 'unreachable', 'dead', 'blocked_by_robots', 'spam_suspect', 'not_news'];
const SOURCE_TYPES = ['NEWS_AGENCY', 'NEWSPAPER', 'TV', 'RADIO', 'MAGAZINE', 'ONLINE_NEWS', 'INVESTIGATIVE', 'BLOG',
  'JOURNALIST', 'YOUTUBE_NEWS', 'PODCAST', 'SOCIAL_NEWS', 'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER'];
const ORIENTATIONS = ['unknown', 'public', 'state_affiliated', 'commercial', 'independent', 'political', 'community', 'religious', 'investigative'];

// Same www./path-insensitive key the worker dedupes on.
const KNOWN_DOMAIN_SQL = `
  SELECT 'publisher' AS kind, id FROM publishers WHERE lower(split_part(regexp_replace(domain, '^www\\.', ''), '/', 1)) = $1
  UNION ALL
  SELECT 'submission', id FROM publisher_submissions WHERE lower(split_part(regexp_replace(coalesce(domain, ''), '^www\\.', ''), '/', 1)) = $1
  UNION ALL
  SELECT 'candidate', id FROM discovered_sources WHERE domain = $1
  LIMIT 1`;

function registerDiscoveryAdminRoutes(admin, pool) {
  admin.get('/api/admin/discovered-sources', async (req, reply) => {
    const q = req.query || {};
    if (q.status && q.status !== 'open' && !STATUSES.includes(q.status)) return reply.code(400).send({ error: 'Unknown status' });
    if (q.health && !HEALTH.includes(q.health)) return reply.code(400).send({ error: 'Unknown health' });
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const { rows } = await pool.query(
      `SELECT ds.*, c.name AS country_name, c.iso_code, c.region,
         sc.score_breakdown, sc.score_band, count(*) OVER () AS total_count
       FROM discovered_sources ds
       LEFT JOIN countries c ON c.id = ds.country_id
       LEFT JOIN LATERAL (
         SELECT score_breakdown, score_band FROM source_scores s
         WHERE s.discovered_source_id = ds.id ORDER BY computed_at DESC LIMIT 1
       ) sc ON true
       WHERE ($1::text IS NULL OR ds.status = $1 OR ($1 = 'open' AND ds.status IN ('discovered', 'under_review')))
         AND ($2::text IS NULL OR c.iso_code = upper($2))
         AND ($3::text IS NULL OR c.region = $3)
         AND ($4::text IS NULL OR ds.health = $4)
         AND ($5::boolean IS NULL OR (ds.feed_url IS NOT NULL) = $5)
         AND ($6::text IS NULL OR ds.domain ILIKE '%' || $6 || '%' OR ds.name ILIKE '%' || $6 || '%')
       ORDER BY ds.score DESC NULLS LAST, ds.times_seen DESC, ds.created_at DESC
       LIMIT $7 OFFSET $8`,
      [q.status || null, q.country || null, q.region || null, q.health || null,
        q.has_feed === 'true' ? true : q.has_feed === 'false' ? false : null,
        q.q ? String(q.q).slice(0, 100) : null, limit, offset]
    );
    return rows;
  });

  // Coverage per country of a region: what is live vs what is waiting.
  admin.get('/api/admin/discovered-sources/summary', async (req) => {
    const region = (req.query && req.query.region) || 'West Africa';
    const { rows: countries } = await pool.query(
      `SELECT c.iso_code, c.name,
         (SELECT count(*) FROM publishers p WHERE p.country_id = c.id AND p.feed_status = 'active')::int AS live_publishers,
         count(ds.id)::int AS candidates,
         count(ds.id) FILTER (WHERE ds.status = 'discovered')::int AS unchecked,
         count(ds.id) FILTER (WHERE ds.status = 'under_review')::int AS to_review,
         count(ds.id) FILTER (WHERE ds.status = 'under_review' AND ds.feed_url IS NOT NULL)::int AS to_review_with_feed,
         count(ds.id) FILTER (WHERE ds.status = 'verified')::int AS promoted,
         count(ds.id) FILTER (WHERE ds.status = 'rejected')::int AS rejected
       FROM countries c
       LEFT JOIN discovered_sources ds ON ds.country_id = c.id
       WHERE c.region = $1
       GROUP BY c.id
       ORDER BY c.name`,
      [region]
    );
    const { rows: [totals] } = await pool.query(
      `SELECT count(*)::int AS candidates,
         count(*) FILTER (WHERE health = 'ok')::int AS healthy,
         count(*) FILTER (WHERE health IN ('unreachable', 'dead'))::int AS failing,
         count(*) FILTER (WHERE health = 'spam_suspect')::int AS spam,
         count(*) FILTER (WHERE feed_url IS NOT NULL)::int AS with_feed,
         count(*) FILTER (WHERE feed_url IS NULL AND health = 'ok')::int AS without_feed,
         count(*) FILTER (WHERE youtube_url IS NOT NULL)::int AS with_youtube,
         count(*) FILTER (WHERE facebook_url IS NOT NULL)::int AS with_facebook,
         count(*) FILTER (WHERE tiktok_url IS NOT NULL)::int AS with_tiktok,
         max(last_checked_at) AS last_checked_at,
         (SELECT max(mined_at) FROM discovery_mining_log) AS last_mined_at,
         (SELECT count(*)::int FROM discovery_mining_log) AS publishers_mined
       FROM discovered_sources`
    );
    return { region, totals, countries };
  });

  // Manual add: an admin pastes a site the worker hasn't found yet.
  admin.post('/api/admin/discovered-sources', async (req, reply) => {
    const body = req.body || {};
    const n = normalizeCandidateUrl(body.url);
    if (!n.ok) return reply.code(400).send({ error: n.error });
    const { rows: known } = await pool.query(KNOWN_DOMAIN_SQL, [n.domain]);
    if (known.length) return reply.code(409).send({ error: `Already known as ${known[0].kind} ${known[0].id}`, kind: known[0].kind, id: known[0].id });
    const name = cleanText(body.name, 200) || n.domain;
    const { rows } = await pool.query(
      `INSERT INTO discovered_sources (name, homepage_url, domain, country_id, discovery_method, discovered_from, notes)
       VALUES ($1, $2, $3, (SELECT id FROM countries WHERE iso_code = upper($4)), 'manual', $5, $6)
       RETURNING id`,
      [name, n.homepage, n.domain, body.country_iso || null, cleanText(body.evidence_url, 500) || null, cleanText(body.notes, 2000) || null]
    );
    return { id: rows[0].id };
  });

  admin.patch('/api/admin/discovered-sources/:id', async (req, reply) => {
    const b = req.body || {};
    if (b.status !== undefined && !['discovered', 'under_review', 'rejected'].includes(b.status)) {
      return reply.code(400).send({ error: 'status can only be set to discovered, under_review or rejected here (use promote)' });
    }
    if (b.source_type !== undefined && b.source_type !== null && !SOURCE_TYPES.includes(b.source_type)) return reply.code(400).send({ error: 'Unknown source_type' });
    if (b.editorial_orientation !== undefined && !ORIENTATIONS.includes(b.editorial_orientation)) return reply.code(400).send({ error: 'Unknown editorial_orientation' });
    if (b.creator_kind !== undefined && !['organisation', 'individual'].includes(b.creator_kind)) return reply.code(400).send({ error: 'Unknown creator_kind' });
    if (b.language !== undefined && b.language !== null && !/^[a-z]{2,3}$/.test(b.language)) return reply.code(400).send({ error: 'language must be an ISO 639 code' });
    let countryId;
    if (b.country_iso !== undefined) {
      const { rows } = await pool.query('SELECT id FROM countries WHERE iso_code = upper($1)', [String(b.country_iso)]);
      if (!rows.length) return reply.code(400).send({ error: 'Unknown country' });
      countryId = rows[0].id;
    }
    const { rows } = await pool.query(
      `UPDATE discovered_sources SET
         name = coalesce($2, name), country_id = coalesce($3, country_id), language = coalesce($4, language),
         source_type = coalesce($5, source_type), creator_kind = coalesce($6, creator_kind),
         editorial_orientation = coalesce($7, editorial_orientation), notes = coalesce($8, notes),
         status = coalesce($9, status), updated_at = now()
       WHERE id = $1 AND status NOT IN ('verified', 'contacted', 'invited', 'registered')
       RETURNING id, status`,
      [req.params.id, b.name !== undefined ? cleanText(b.name, 200) || null : null, countryId ?? null, b.language ?? null,
        b.source_type ?? null, b.creator_kind ?? null, b.editorial_orientation ?? null,
        b.notes !== undefined ? cleanText(b.notes, 2000) : null, b.status ?? null]
    );
    if (!rows.length) return reply.code(404).send({ error: 'No editable candidate with that id (already promoted?)' });
    return rows[0];
  });

  admin.post('/api/admin/discovered-sources/:id/recheck', async (req, reply) => {
    const { rows } = await pool.query(
      `UPDATE discovered_sources SET next_check_at = now(),
         status = CASE WHEN status = 'rejected' THEN 'discovered' ELSE status END, updated_at = now()
       WHERE id = $1 AND status IN ('discovered', 'under_review', 'rejected') RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'No re-checkable candidate with that id' });
    return { status: 'queued' };
  });

  // Candidate -> publisher_submissions (feed found: 'pending' with the
  // verified feed; no feed: 'submitted' for a crawled sitemap/html source).
  admin.post('/api/admin/discovered-sources/:id/promote', async (req, reply) => {
    const { rows: [c] } = await pool.query('SELECT * FROM discovered_sources WHERE id = $1', [req.params.id]);
    if (!c) return reply.code(404).send({ error: 'Candidate not found' });
    if (!['discovered', 'under_review'].includes(c.status)) return reply.code(409).send({ error: `Candidate is ${c.status}` });
    if (c.health === 'spam_suspect' && !(req.body && req.body.force)) {
      return reply.code(409).send({ error: 'Candidate looks like spam/hijacked; re-check it or pass force' });
    }
    if (!c.country_id) return reply.code(400).send({ error: 'Set the country first' });
    const language = c.language || c.html_lang;
    if (!language) return reply.code(400).send({ error: 'Set the language first' });
    const { rows: known } = await pool.query(
      `SELECT kind, id FROM (${KNOWN_DOMAIN_SQL.replace(/\s*LIMIT 1\s*$/, '')}) k WHERE kind <> 'candidate' LIMIT 1`,
      [c.domain]
    );
    if (known.length) return reply.code(409).send({ error: `Already a ${known[0].kind} (id ${known[0].id})` });

    const hasFeed = Boolean(c.feed_url);
    const method = hasFeed ? 'feed' : c.sitemap_url ? 'sitemap' : 'html';
    const detail = `Discovery worker: ${hasFeed ? `${c.feed_type} feed ${c.feed_url}, ${c.item_count} items` : `no feed (${method} crawl)`}`
      + `, score ${c.score ?? 'n/a'}, found via ${c.discovery_method}${c.discovered_from ? ` (${c.discovered_from})` : ''}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [sub] } = await client.query(
        `INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified,
           verification_detail, domain, description, youtube_url, facebook_url, x_url, instagram_url, tiktok_url,
           sitemap_url, ingestion_method, status, status_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, now())
         RETURNING id, status`,
        [c.name, c.homepage_url, c.feed_url, hasFeed ? (c.feed_type === 'sitemap-news' ? 'sitemap-news' : 'rss') : null,
          c.country_id, language, hasFeed, detail, c.domain, c.description,
          c.youtube_url, c.facebook_url, c.x_url, c.instagram_url, c.tiktok_url,
          c.sitemap_url, method, hasFeed ? 'pending' : 'submitted']
      );
      await client.query(
        `UPDATE discovered_sources SET status = 'verified', promoted_submission_id = $2, updated_at = now() WHERE id = $1`,
        [c.id, sub.id]
      );
      await client.query('COMMIT');
      return { submission_id: sub.id, submission_status: sub.status, ingestion_method: method };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}

module.exports = { registerDiscoveryAdminRoutes };
