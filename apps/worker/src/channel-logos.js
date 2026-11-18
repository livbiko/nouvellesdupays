// CR-2026-11-17-04: logos for the /youtube directory channels (video_channels), once a day, from the official YouTube
// Data API (channels.list, 1 unit per 50 channels: ~7 units for ~305 channels). Charged to the 'youtube' agent's
// rolling 24 h budget in agent_runs like collectRecentActivity, so discovery counts these units, and off while that
// agent is paused.
//  - video_channels.logo_url is set from the channel thumbnail on every row of that channel, only when it is empty or
//    was set by this step (a YouTube image host); a logo set by hand elsewhere is never overwritten. Only https images
//    on YouTube's own hosts are stored.
//  - subscribers (unless hidden), total views and video count go to audience_metrics for the channels that already
//    have a youtube social_accounts row (the other directory channels have no row to hang them on until migration 020
//    adds channel_metrics, CR-2026-11-17-02).
//  - a channel id the API does not return is only counted and logged; nothing is marked dead here.
const { youtubeClient, QuotaExhausted } = require('./creator-agents');

const REFRESH_HOURS = 20;
const RUN_MESSAGE = 'channel-logos';
const YT_IMAGE = /^https:\/\/yt3\.(ggpht|googleusercontent)\.com\/[^\s"'<>]+$/;

function logoOf(snippet) {
  const t = snippet?.thumbnails || {};
  const url = (t.high || t.medium || t.default || {}).url;
  return typeof url === 'string' && YT_IMAGE.test(url) ? url : null;
}

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function refreshChannelLogos(pool, { apiKey = process.env.YOUTUBE_API_KEY, fetchImpl = (...a) => fetch(...a), log = console.log,
  now = new Date() } = {}) {
  if (!apiKey) return { skipped: 'no YOUTUBE_API_KEY' };
  const { rows: [agent] } = await pool.query(`SELECT paused, daily_quota_units FROM discovery_agents WHERE agent = 'youtube'`);
  if (!agent || agent.paused) return { skipped: 'paused' };
  const { rows: [last] } = await pool.query(
    `SELECT 1 FROM agent_runs WHERE agent = 'youtube' AND message LIKE $2 AND status = 'ok'
        AND started_at > $1::timestamptz - make_interval(hours => $3) LIMIT 1`, [now, `${RUN_MESSAGE}%`, REFRESH_HOURS]);
  if (last) return { skipped: `ran in the last ${REFRESH_HOURS} h` };

  const { rows: idRows } = await pool.query(
    `SELECT DISTINCT youtube_channel_id AS id FROM video_channels
      WHERE youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$' ORDER BY 1`);
  const ids = idRows.map((r) => r.id);
  if (!ids.length) return { checked: 0, quota: 0 };
  const { rows: [{ used }] } = await pool.query(
    `SELECT coalesce(sum(quota_units), 0)::int AS used FROM agent_runs WHERE agent = 'youtube' AND started_at > $1::timestamptz - interval '24 hours'`,
    [now]);
  const budget = { used: 0, limit: Math.max(agent.daily_quota_units - used, 0) };
  const calls = Math.ceil(ids.length / 50);
  if (budget.limit < calls) return { skipped: `quota budget used (${budget.limit} left, ${calls} needed)` };

  const { rows: [run] } = await pool.query(`INSERT INTO agent_runs (agent, message, started_at) VALUES ('youtube', $1, $2) RETURNING id`, [RUN_MESSAGE, now]);
  const yt = youtubeClient(apiKey, fetchImpl, budget);
  const out = { checked: 0, returned: 0, logos: 0, metrics: 0, missing: 0, quota: 0, stopped: null };
  let status = 'ok';
  try {
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const items = (await yt.channelsByIds(batch)).items || [];
      const byId = new Map(items.map((it) => [it.id, it]));
      out.checked += batch.length;
      out.missing += batch.filter((id) => !byId.has(id)).length;
      for (const it of items) {
        out.returned++;
        const logo = logoOf(it.snippet);
        if (logo) {
          const { rowCount } = await pool.query(
            `UPDATE video_channels SET logo_url = $2
              WHERE youtube_channel_id = $1 AND (logo_url IS NULL OR logo_url ~ '^https://yt3\\.(ggpht|googleusercontent)\\.com/')
                AND logo_url IS DISTINCT FROM $2`, [it.id, logo]);
          out.logos += rowCount;
        }
        const st = it.statistics || {};
        const values = [
          ['subscribers', st.hiddenSubscriberCount === true ? null : num(st.subscriberCount)],
          ['total_views', num(st.viewCount)],
          ['video_count', num(st.videoCount)],
        ].filter(([, v]) => v != null);
        if (!values.length) continue;
        const { rows: accounts } = await pool.query(
          `SELECT id FROM social_accounts WHERE platform = 'youtube' AND platform_account_id = $1 AND status <> 'dead'`, [it.id]);
        for (const acc of accounts) {
          for (const [metric, value] of values) {
            await pool.query(
              `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
               VALUES ($1, $2, $3, 'youtube_data_api', $4)`, [acc.id, metric, value, now]);
            out.metrics++;
          }
        }
      }
    }
  } catch (err) {
    status = 'failed';
    out.stopped = err instanceof QuotaExhausted ? err.message : `error: ${err.message}`;
  } finally {
    out.quota = budget.used;
    await pool.query(
      `UPDATE agent_runs SET finished_at = now(), status = $2, quota_units = $3, items_seen = $4, items_new = $5, message = $6 WHERE id = $1`,
      [run.id, status, budget.used, out.returned, out.logos,
        (`${RUN_MESSAGE}: ${out.checked} checked, ${out.returned} returned, ${out.missing} not returned, ${out.logos} logo rows, `
        + `${out.metrics} metrics${out.stopped ? `; stopped: ${out.stopped}` : ''}`).slice(0, 500)]);
  }
  log(`[channel-logos] ${out.checked} checked, ${out.returned} returned, ${out.missing} not returned, ${out.logos} logo rows, `
    + `${out.metrics} metrics, quota ${out.quota}${out.stopped ? `, stopped: ${out.stopped}` : ''}`);
  return { ...out, status };
}

module.exports = { refreshChannelLogos, logoOf, REFRESH_HOURS };
