// Creator rankings (Build #235; brief section 5, tables creator_ranking_weights / creator_rankings of migration 018).
//
// collectRecentActivity - for approved creators' YouTube channels, once a day: how many videos they published in the
//                         last 30 days, the average views of their recent videos (published 2 to 90 days ago, so a
//                         video a few hours old does not drag the average down) and the engagement rate of those
//                         videos ((likes + comments) / views). 1 quota unit per channel + 1 per 50 videos, charged to
//                         the YouTube agent's rolling 24 h budget after discovery has had its share.
// computeCreatorRankings - scores every approved creator on five dimensions and an overall score with the configurable
//                         per-platform weights, and ranks them per country, region, all Africa, category and globally.
//                         Append-only: each computation is a new set of rows with one computed_at (ranking history).
//
// Rules from the brief: platforms are scored on their own metrics; a metric that is missing (hidden, never measured or
// older than METRIC_MAX_AGE_DAYS) is left out and the remaining weights are rescaled, so a creator is not penalised for
// it and no value is invented; growth compares like with like (subscribers now against a snapshot 25 to 40 days old,
// scaled to 30 days). Scores are on fixed scales, so a score means the same thing in a country of 3 creators and in the
// global list. Popularity is not credibility: these are audience figures only.
const { youtubeClient, QuotaExhausted } = require('./creator-agents');

const PUBLIC = `cr.review_status = 'approved' AND NOT cr.possible_minor AND cr.merged_into_id IS NULL`;
const AFRICA = ['West Africa', 'Central Africa', 'East Africa', 'North Africa', 'Southern Africa'];
const DIMENSIONS = ['popularity', 'engagement', 'content', 'growth', 'activity'];
const REFRESH_HOURS = 20;
const METRIC_MAX_AGE_DAYS = 14;
const DAY = 86400000;

const clamp = (v) => Math.max(0, Math.min(100, v));
const round2 = (v) => Math.round(v * 100) / 100;

// Fixed scales (0-100). Logarithmic for audience sizes: 10 M subscribers or 1 M average views per recent video = 100.
const SCORE = {
  popularity: (subscribers) => clamp((Math.log10(subscribers + 1) / 7) * 100),
  content: (avgViews) => clamp((Math.log10(avgViews + 1) / 6) * 100),
  engagement: (bp) => clamp(bp / 10), // basis points: 10 % (1000 bp) = 100
  activity: (uploads30) => clamp(Math.sqrt(Math.min(uploads30, 30) / 30) * 100), // daily = 100, weekly ~ 37
  growth: (monthlyPct) => clamp((monthlyPct / 10) * 100), // +10 % a month = 100, shrinking = 0
};

// Scores for one channel from its metrics; missing inputs give no score for that dimension.
function scoreChannel(m, weights) {
  const s = {};
  if (m.subscribers != null) s.popularity = SCORE.popularity(m.subscribers);
  if (m.avg_recent_views != null) s.content = SCORE.content(m.avg_recent_views);
  if (m.engagement_rate_bp != null) s.engagement = SCORE.engagement(m.engagement_rate_bp);
  if (m.recent_uploads_30d != null) s.activity = SCORE.activity(m.recent_uploads_30d);
  if (m.growth_pct_30d != null) s.growth = SCORE.growth(m.growth_pct_30d);
  const used = DIMENSIONS.filter((d) => s[d] !== undefined);
  // An overall score needs at least two dimensions, so one number on its own is not presented as "performance".
  if (used.length >= 2) {
    const total = used.reduce((t, d) => t + Number(weights[d]), 0);
    if (total > 0) s.overall = used.reduce((t, d) => t + s[d] * Number(weights[d]), 0) / total;
  }
  for (const k of Object.keys(s)) s[k] = round2(s[k]);
  return { scores: s, used, missing: DIMENSIONS.filter((d) => !used.includes(d)) };
}

async function youtubeBudget(pool, now) {
  const { rows: [a] } = await pool.query(`SELECT paused, daily_quota_units FROM discovery_agents WHERE agent = 'youtube'`);
  if (!a || a.paused) return { skipped: 'paused' };
  const { rows: [{ used }] } = await pool.query(
    `SELECT coalesce(sum(quota_units), 0)::int AS used FROM agent_runs WHERE agent = 'youtube' AND started_at > $1::timestamptz - interval '24 hours'`,
    [now]);
  return { used: 0, limit: Math.max(a.daily_quota_units - used, 0) };
}

async function collectRecentActivity(pool, { apiKey = process.env.YOUTUBE_API_KEY, fetchImpl = (...a) => fetch(...a), log = console.log,
  now = new Date() } = {}) {
  if (!apiKey) return { skipped: 'no YOUTUBE_API_KEY' };
  const budget = await youtubeBudget(pool, now);
  if (budget.skipped) return budget;
  // Approved creators' live channels whose recent numbers are older than REFRESH_HOURS (recent_uploads_30d is written
  // on every successful check, even when it is 0, so it marks the last check).
  const { rows: due } = await pool.query(
    `SELECT sa.id, sa.platform_account_id AS channel_id
       FROM social_accounts sa JOIN creators cr ON cr.id = sa.creator_id
      WHERE ${PUBLIC} AND sa.platform = 'youtube' AND sa.status <> 'dead' AND sa.verification <> 'rejected'
        AND sa.platform_account_id LIKE 'UC%'
        AND NOT EXISTS (SELECT 1 FROM audience_metrics am WHERE am.social_account_id = sa.id AND am.metric = 'recent_uploads_30d'
                          AND am.measured_at > $1::timestamptz - interval '${REFRESH_HOURS} hours')
      ORDER BY sa.id LIMIT 200`, [now]);
  if (!due.length) return { checked: 0, quota: 0 };
  if (budget.limit < 2) return { skipped: `quota budget used (${budget.limit} left)` };

  const { rows: [run] } = await pool.query(`INSERT INTO agent_runs (agent) VALUES ('youtube') RETURNING id`);
  const yt = youtubeClient(apiKey, fetchImpl, budget);
  const out = { checked: 0, quota: 0, stopped: null };
  let status = 'ok';
  try {
    // 1. Recent uploads per channel; keep the videos old enough (2-90 days) for an average.
    const plan = [];
    for (const acc of due) {
      if (budget.limit - budget.used < 2) { out.stopped = 'quota budget reached'; break; }
      let items = [];
      try {
        items = (await yt.recentUploads(acc.channel_id)).items || [];
      } catch (err) {
        if (err instanceof QuotaExhausted) throw err;
        if (!/HTTP 404/.test(err.message)) { log(`  account ${acc.id}: ${err.message}`); continue; }
        // No uploads playlist: a channel with no public videos.
      }
      const published = items.map((it) => ({ id: it.contentDetails?.videoId, at: Date.parse(it.contentDetails?.videoPublishedAt) }))
        .filter((v) => v.id && Number.isFinite(v.at));
      const age = (v) => (now.getTime() - v.at) / DAY;
      plan.push({ acc, uploads30: published.filter((v) => age(v) <= 30).length,
        sample: published.filter((v) => age(v) >= 2 && age(v) <= 90).slice(0, 20).map((v) => v.id) });
    }
    // 2. Statistics of the sampled videos, 50 per call across channels.
    const stats = new Map();
    const ids = plan.flatMap((p) => p.sample);
    for (let i = 0; i < ids.length; i += 50) {
      for (const it of (await yt.videosByIds(ids.slice(i, i + 50))).items || []) stats.set(it.id, it.statistics || {});
    }
    // 3. One snapshot per channel; a number that cannot be measured gets no row (never a guess).
    for (const { acc, uploads30, sample } of plan) {
      const vids = sample.map((id) => stats.get(id)).filter((st) => st && st.viewCount != null);
      const rows = [['recent_uploads_30d', uploads30, 30]];
      if (vids.length) {
        const views = vids.reduce((t, st) => t + Number(st.viewCount), 0);
        rows.push(['avg_recent_views', Math.round(views / vids.length), 90]);
        const withLikes = vids.filter((st) => st.likeCount != null);
        const v2 = withLikes.reduce((t, st) => t + Number(st.viewCount), 0);
        if (withLikes.length && v2 > 0) {
          const inter = withLikes.reduce((t, st) => t + Number(st.likeCount) + Number(st.commentCount || 0), 0);
          rows.push(['engagement_rate_bp', Math.round((inter / v2) * 10000), 90]);
        }
      }
      for (const [metric, value, windowDays] of rows) {
        await pool.query(
          `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at, window_days)
           VALUES ($1, $2, $3, 'youtube_data_api', $4, $5)`, [acc.id, metric, value, now, windowDays]);
      }
      out.checked++;
    }
  } catch (err) {
    if (err instanceof QuotaExhausted) out.stopped = err.message;
    else { status = 'failed'; out.stopped = err.message; }
  } finally {
    out.quota = budget.used;
    await pool.query(
      `UPDATE agent_runs SET finished_at = now(), status = $2, quota_units = $3, items_seen = $4, message = $5 WHERE id = $1`,
      [run.id, status, budget.used, out.checked,
        `recent activity: ${out.checked} channel(s)${out.stopped ? `; stopped: ${out.stopped}` : ''}`.slice(0, 1000)]);
  }
  log(`[creators/rankings] recent activity for ${out.checked} channel(s), quota ${out.quota}${out.stopped ? ` (stopped: ${out.stopped})` : ''}`);
  return { ...out, status };
}

// Recompute when the last computation is older than REFRESH_HOURS or an approved / previously ranked creator changed
// since (approval, rejection, new category...), so a newly approved creator does not wait a day for a rank.
async function rankingsDue(pool, now) {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT max(computed_at) FROM creator_rankings) AS last,
            (SELECT max(cr.updated_at) FROM creators cr
              WHERE cr.review_status = 'approved'
                 OR cr.id IN (SELECT creator_id FROM creator_rankings WHERE computed_at = (SELECT max(computed_at) FROM creator_rankings))) AS changed`);
  if (!r.last) return true;
  return r.last < new Date(now.getTime() - REFRESH_HOURS * 3600000) || (r.changed && r.changed > r.last);
}

async function computeCreatorRankings(pool, { now = new Date(), log = console.log, force = false } = {}) {
  if (!force && !(await rankingsDue(pool, now))) return { skipped: 'up to date' };
  const { rows: [w] } = await pool.query(`SELECT * FROM creator_ranking_weights WHERE platform = 'youtube'`);
  const weights = w || { popularity: 25, engagement: 25, content: 25, growth: 15, activity: 10 };
  // Each approved creator's largest live YouTube channel, with its latest metrics (not older than METRIC_MAX_AGE_DAYS)
  // and a subscriber snapshot 25-40 days old for growth.
  const { rows } = await pool.query(
    `SELECT cr.id AS creator_id, c.iso_code AS country_iso, coalesce(c.region, cr.region) AS region,
            coalesce((SELECT array_agg(cc.slug) FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id
                       WHERE l.creator_id = cr.id), '{}') AS categories,
            acc.id AS account_id, acc.metrics, acc.past_subscribers, acc.past_at
       FROM creators cr
       LEFT JOIN countries c ON c.id = cr.country_id
       JOIN LATERAL (
         SELECT sa.id,
                (SELECT jsonb_object_agg(m.metric, jsonb_build_object('value', m.value, 'at', m.measured_at))
                   FROM (SELECT DISTINCT ON (metric) metric, value, measured_at FROM audience_metrics
                          WHERE social_account_id = sa.id AND measured_at > $1::timestamptz - interval '${METRIC_MAX_AGE_DAYS} days'
                          ORDER BY metric, measured_at DESC) m) AS metrics,
                past.value AS past_subscribers, past.measured_at AS past_at
           FROM social_accounts sa
           LEFT JOIN LATERAL (
             SELECT value, measured_at FROM audience_metrics
              WHERE social_account_id = sa.id AND metric = 'subscribers'
                AND measured_at BETWEEN $1::timestamptz - interval '40 days' AND $1::timestamptz - interval '25 days'
              ORDER BY abs(extract(epoch FROM ($1::timestamptz - interval '30 days' - measured_at))) LIMIT 1
           ) past ON true
          WHERE sa.creator_id = cr.id AND sa.platform = 'youtube' AND sa.status <> 'dead' AND sa.verification <> 'rejected'
          ORDER BY (SELECT value FROM audience_metrics WHERE social_account_id = sa.id AND metric = 'subscribers'
                     ORDER BY measured_at DESC LIMIT 1) DESC NULLS LAST, sa.id
          LIMIT 1
       ) acc ON true
      WHERE ${PUBLIC}`, [now]);

  const scored = [];
  for (const r of rows) {
    const metric = (k) => (r.metrics && r.metrics[k] ? Number(r.metrics[k].value) : null);
    const m = {
      subscribers: metric('subscribers'), avg_recent_views: metric('avg_recent_views'),
      engagement_rate_bp: metric('engagement_rate_bp'), recent_uploads_30d: metric('recent_uploads_30d'), growth_pct_30d: null,
    };
    if (m.subscribers != null && r.past_subscribers != null && Number(r.past_subscribers) > 0) {
      const days = (r.metrics.subscribers ? Date.parse(r.metrics.subscribers.at) : now.getTime()) - new Date(r.past_at).getTime();
      if (days > 0) m.growth_pct_30d = ((m.subscribers - Number(r.past_subscribers)) / Number(r.past_subscribers)) * 100 * (30 * DAY / days);
    }
    const { scores, used, missing } = scoreChannel(m, weights);
    if (!Object.keys(scores).length) continue;
    const scopes = [['global', '']];
    if (r.region && AFRICA.includes(r.region)) scopes.push(['africa', '']);
    if (r.region) scopes.push(['region', r.region]);
    if (r.country_iso) scopes.push(['country', r.country_iso.trim()]);
    for (const cat of r.categories) scopes.push(['category', cat]);
    scored.push({ ...r, m, scores, inputs: { metrics: m, used, missing, weights: DIMENSIONS.reduce((o, d) => ({ ...o, [d]: Number(weights[d]) }), {}) }, scopes });
  }

  // Rank within every (scope, key, dimension) among the creators that have that score; ties by subscribers, then id.
  const groups = new Map();
  for (const s of scored) {
    for (const [scope, key] of s.scopes) {
      for (const dim of ['overall', ...DIMENSIONS]) {
        if (s.scores[dim] === undefined) continue;
        const g = `${scope}|${key}|${dim}`;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(s);
      }
    }
  }
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const [g, list] of groups) {
      const [scope, key, dim] = g.split('|');
      list.sort((a, b) => b.scores[dim] - a.scores[dim] || (b.m.subscribers ?? -1) - (a.m.subscribers ?? -1) || a.creator_id - b.creator_id);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        await client.query(
          `INSERT INTO creator_rankings (computed_at, platform, scope, scope_key, dimension, creator_id, social_account_id, rank, score, inputs)
           VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, $8, $9)`,
          [now, scope, key, dim, s.creator_id, s.account_id, i + 1, s.scores[dim], s.inputs]);
        n++;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  log(`[creators/rankings] ranked ${scored.length} creator(s), ${n} row(s)`);
  return { creators: scored.length, rows: n };
}

module.exports = { collectRecentActivity, computeCreatorRankings, scoreChannel, SCORE };
