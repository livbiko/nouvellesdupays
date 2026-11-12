// Public creator directory (Build #231; schema db/migrations/018_creators.sql + 019).
//
// GET /api/creators          approved creators, optionally ?country=<iso>&kind=individual|group|media_brand&limit=
// GET /api/creators/:slug    one approved creator: categories, channels with their latest public numbers, kinds of
//                            identity evidence, and (Build #235) its scores and ranks from the latest ranking computation
//
// Only a creator a reviewer approved is ever returned: candidates, rejected and merged creators, and anyone flagged
// as a possible minor answer 404 / are left out (spec section 13). Numbers come only from audience_metrics (an
// official API or a reviewer), never estimated; a hidden or missing number is simply absent. Reviewer notes,
// discovery details and evidence notes stay private.

const PUBLIC = `cr.review_status = 'approved' AND NOT cr.possible_minor AND cr.merged_into_id IS NULL`;
const KINDS = ['individual', 'group', 'media_brand'];
// Evidence kinds a reader may see, and the account states that are shown at all.
const PUBLIC_EVIDENCE = ['platform_badge', 'cross_link', 'official_website', 'creator_confirmed', 'reviewer'];
// The latest ranking computation (worker creator-rankings.js); every computation shares one computed_at.
const LATEST_RANKING = `(SELECT max(computed_at) FROM creator_rankings)`;

function registerPublicCreatorRoutes(fastify) {
  const pool = fastify.pg;

  fastify.get('/api/creators', async (req, reply) => {
    const iso = String(req.query.country || '').trim().toUpperCase();
    if (iso && !/^[A-Z]{2}$/.test(iso)) return reply.code(400).send({ error: 'country must be a 2-letter ISO code' });
    const kind = String(req.query.kind || '').trim();
    if (kind && !KINDS.includes(kind)) return reply.code(400).send({ error: `kind must be one of ${KINDS.join(', ')}` });
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);
    const { rows } = await pool.query(
      `SELECT cr.slug, cr.display_name, cr.creator_kind, cr.confidence, cr.languages, cr.approved_at, cr.updated_at,
              c.iso_code AS country_iso, c.name AS country_name, coalesce(c.region, cr.region) AS region,
              cat.name_fr AS primary_category, aud.subscribers, aud.profile_image_url,
              rk.score::float8 AS score, rk.rank
         FROM creators cr
         LEFT JOIN countries c ON c.id = cr.country_id
         LEFT JOIN LATERAL (
           SELECT cc.name_fr FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id
            WHERE l.creator_id = cr.id ORDER BY l.is_primary DESC, cc.sort_order LIMIT 1
         ) cat ON true
         LEFT JOIN LATERAL (
           SELECT m.value::float8 AS subscribers, sa.profile_image_url
             FROM social_accounts sa
             LEFT JOIN LATERAL (
               SELECT value FROM audience_metrics
                WHERE social_account_id = sa.id AND metric IN ('subscribers', 'followers')
                ORDER BY measured_at DESC LIMIT 1
             ) m ON true
            WHERE sa.creator_id = cr.id AND sa.status <> 'dead' AND sa.verification <> 'rejected'
            ORDER BY m.value DESC NULLS LAST LIMIT 1
         ) aud ON true
         LEFT JOIN LATERAL (
           SELECT score, rank FROM creator_rankings
            WHERE creator_id = cr.id AND computed_at = ${LATEST_RANKING} AND scope = 'global' AND dimension = 'overall'
            LIMIT 1
         ) rk ON true
        WHERE ${PUBLIC}
          AND ($1 = '' OR c.iso_code = $1)
          AND ($2 = '' OR cr.creator_kind = $2)
        ORDER BY rk.score DESC NULLS LAST, aud.subscribers DESC NULLS LAST, cr.display_name
        LIMIT $3`,
      [iso, kind, limit]
    );
    return rows;
  });

  fastify.get('/api/creators/:slug', async (req, reply) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return reply.code(404).send({ error: 'Unknown creator' });
    const { rows: [cr] } = await pool.query(
      `SELECT cr.id, cr.slug, cr.display_name, cr.creator_kind, cr.confidence, cr.languages, cr.bio, cr.official_website,
              cr.approved_at, cr.updated_at, c.iso_code AS country_iso, c.name AS country_name,
              coalesce(c.region, cr.region) AS region
         FROM creators cr LEFT JOIN countries c ON c.id = cr.country_id
        WHERE cr.slug = $1 AND ${PUBLIC}`,
      [slug]
    );
    if (!cr) return reply.code(404).send({ error: 'Unknown creator' });
    const [cats, accounts, evidence, ranks] = await Promise.all([
      pool.query(
        `SELECT cc.slug, cc.name_fr, cc.name_en, l.is_primary
           FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id
          WHERE l.creator_id = $1 ORDER BY l.is_primary DESC, cc.sort_order`,
        [cr.id]
      ),
      pool.query(
        `SELECT s.platform, s.url, s.handle, s.display_name, s.profile_image_url, s.verification, s.platform_verified,
                coalesce((SELECT json_agg(json_build_object('metric', m.metric, 'value', m.value::float8, 'source', m.source,
                                                            'measured_at', m.measured_at) ORDER BY m.metric)
                            FROM (SELECT DISTINCT ON (metric) metric, value, source, measured_at
                                    FROM audience_metrics WHERE social_account_id = s.id
                                   ORDER BY metric, measured_at DESC) m), '[]') AS audience
           FROM social_accounts s
          WHERE s.creator_id = $1 AND s.status <> 'dead' AND s.verification <> 'rejected'
          ORDER BY array_position(ARRAY['youtube','facebook','tiktok','x','instagram'], s.platform), s.id`,
        [cr.id]
      ),
      pool.query(
        `SELECT DISTINCT v.evidence_kind
           FROM creator_verifications v JOIN social_accounts sa ON sa.id = v.social_account_id
          WHERE v.creator_id = $1 AND sa.creator_id = $1 AND sa.verification <> 'rejected' AND v.evidence_kind = ANY($2)`,
        [cr.id, PUBLIC_EVIDENCE]
      ),
      // Rank and score in every scope and dimension, with how many creators that ranking has; the inputs say which
      // metrics were used and which were missing (shown as unavailable, never as zero).
      pool.query(
        `SELECT r.scope, r.scope_key, r.dimension, r.rank, r.score::float8 AS score, r.computed_at, r.inputs,
                (SELECT count(*)::int FROM creator_rankings t
                  WHERE t.computed_at = r.computed_at AND t.platform = r.platform AND t.scope = r.scope
                    AND t.scope_key = r.scope_key AND t.dimension = r.dimension) AS total
           FROM creator_rankings r
          WHERE r.creator_id = $1 AND r.computed_at = ${LATEST_RANKING}
          ORDER BY array_position(ARRAY['country','region','africa','global','category'], r.scope), r.scope_key,
                   array_position(ARRAY['overall','popularity','engagement','content','growth','activity'], r.dimension)`,
        [cr.id]
      ),
    ]);
    const { id, ...profile } = cr;
    return {
      ...profile,
      categories: cats.rows,
      accounts: accounts.rows,
      evidence: evidence.rows.map((r) => r.evidence_kind).sort(),
      rankings: ranks.rows.map(({ inputs, ...r }) => r),
      ranking_inputs: ranks.rows.length ? { used: ranks.rows[0].inputs.used, missing: ranks.rows[0].inputs.missing,
        weights: ranks.rows[0].inputs.weights } : null,
    };
  });
}

module.exports = { registerPublicCreatorRoutes };
