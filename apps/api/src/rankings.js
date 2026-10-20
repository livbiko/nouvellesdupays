// GET /api/rankings — top African media by publicly measured audience figures.
// Spec section 16: "Most Watched African News", "Most Followed African Media",
// "Trending African Channels".
//
// All values come exclusively from audience_metrics (source = 'youtube_data_api'
// or 'reviewer'). A source with no measured data is absent from the rankings —
// numbers are never fabricated (spec section 26). When the table is empty (before
// YOUTUBE_API_KEY is configured) every list returns [] and the page shows a
// "waiting for data" notice.
//
// Response shape:
//   youtube_by_subscribers  top 20 YouTube channels by subscriber count
//   youtube_by_views        top 20 by lifetime view count
//   all_by_followers        top 20 across all platforms by their primary reach metric
//                           (subscribers for YouTube, followers for FB/TikTok/IG, X)

const AFRICAN_REGIONS = ['West Africa', 'East Africa', 'Central Africa', 'North Africa', 'Southern Africa'];
const PLATFORM_ORDER = ['youtube', 'facebook', 'tiktok', 'x', 'instagram'];

async function topByMetric(pool, platform, metric, limit) {
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.homepage_url, p.logo_url,
            c.name AS country_name, c.iso_code AS country_iso, c.region AS country_region,
            c.flag_url AS country_flag_url,
            sa.platform, sa.url AS account_url, sa.handle, sa.verification,
            am.value AS metric_value, am.metric AS metric_name, am.measured_at
       FROM publishers p
       JOIN countries c ON c.id = p.country_id
       JOIN social_accounts sa ON sa.publisher_id = p.id
       JOIN LATERAL (
         SELECT metric, value, measured_at
           FROM audience_metrics
          WHERE social_account_id = sa.id AND metric = $1
          ORDER BY measured_at DESC
          LIMIT 1
       ) am ON true
      WHERE c.region = ANY($2)
        AND ($3::text IS NULL OR sa.platform = $3)
        AND p.feed_status <> 'suspended'
        AND sa.status     <> 'dead'
        AND sa.verification <> 'rejected'
      ORDER BY am.value DESC NULLS LAST
      LIMIT $4`,
    [metric, AFRICAN_REGIONS, platform, limit]
  );
  return rows;
}

// Cross-platform: best primary reach metric per account, then rank globally.
async function topAllPlatforms(pool, limit) {
  const { rows } = await pool.query(
    `SELECT p.id, p.slug, p.name, p.homepage_url, p.logo_url,
            c.name AS country_name, c.iso_code AS country_iso, c.region AS country_region,
            c.flag_url AS country_flag_url,
            sa.platform, sa.url AS account_url, sa.handle, sa.verification,
            am.value AS metric_value, am.metric AS metric_name, am.measured_at
       FROM publishers p
       JOIN countries c ON c.id = p.country_id
       JOIN social_accounts sa ON sa.publisher_id = p.id
       JOIN LATERAL (
         SELECT metric, value, measured_at
           FROM audience_metrics
          WHERE social_account_id = sa.id
            AND metric IN ('subscribers', 'followers')
          ORDER BY measured_at DESC
          LIMIT 1
       ) am ON true
      WHERE c.region = ANY($1)
        AND p.feed_status <> 'suspended'
        AND sa.status     <> 'dead'
        AND sa.verification <> 'rejected'
      ORDER BY array_position($2::text[], sa.platform), am.value DESC NULLS LAST
      LIMIT $3`,
    [AFRICAN_REGIONS, PLATFORM_ORDER, limit]
  );
  // Re-sort purely by value for the cross-platform list
  return rows.sort((a, b) => Number(b.metric_value) - Number(a.metric_value));
}

function registerRankingsRoutes(fastify) {
  const pool = fastify.pg;

  fastify.get('/api/rankings', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    try {
      const [ytSubs, ytViews, allFollowers] = await Promise.all([
        topByMetric(pool, 'youtube',  'subscribers', limit),
        topByMetric(pool, 'youtube',  'total_views', limit),
        topAllPlatforms(pool, limit),
      ]);
      return {
        youtube_by_subscribers: ytSubs,
        youtube_by_views:       ytViews,
        all_by_followers:       allFollowers,
      };
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'rankings unavailable' });
    }
  });

  // Per-platform leaderboard (used by admin and the public rankings page
  // for platform-specific tabs). platform=youtube|facebook|tiktok|x|instagram
  fastify.get('/api/rankings/:platform', async (req, reply) => {
    const platform = req.params.platform;
    if (!PLATFORM_ORDER.includes(platform)) return reply.code(404).send({ error: 'unknown platform' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const metric = platform === 'youtube' ? (req.query.metric || 'subscribers') : 'followers';
    const validMetrics = ['subscribers', 'followers', 'total_views', 'video_count'];
    if (!validMetrics.includes(metric)) return reply.code(400).send({ error: 'invalid metric' });
    try {
      const rows = await topByMetric(pool, platform, metric, limit);
      return rows;
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'rankings unavailable' });
    }
  });
}

module.exports = { registerRankingsRoutes };
