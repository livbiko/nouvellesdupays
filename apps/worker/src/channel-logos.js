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
//  - CR-2026-11-18-01: the same numbers for every returned channel go to channel_metrics (migration 020, keyed by the
//    channel id like the directory) - no extra call; the directory shows them on channels without a linked account.
//  - a channel id the API does not return is only counted and logged; nothing is marked dead here.
//  - CR-2026-11-18-08: then, for every returned channel, its UPLOADS newest videos (playlistItems, 1 unit each) go to
//    channel_videos for the "Dernières vidéos" section; videos older than 30 days, or not seen for 30 days, are
//    deleted. A channel whose uploads playlist fails is counted and skipped; when the budget runs out the step stops
//    (the logos and numbers above are already stored).
//  - CR-2026-11-26-02: between those daily runs, refreshLatestUploads fetches the uploads alone every
//    UPLOADS_REFRESH_HOURS (~1 unit per channel), so "Dernières vidéos" is at most a few hours old. The YouTube agent's
//    discovery leaves uploadsReserve() units for it.
const { youtubeClient, QuotaExhausted } = require('./creator-agents');

const REFRESH_HOURS = 20;
const RUN_MESSAGE = 'channel-logos';
const UPLOADS_REFRESH_HOURS = 3;
// CR-2026-11-27-02: the hourly run reaches the check a few seconds earlier or later each time (the recent-activity
// step before it varies), so a run counts as due from 3 h minus this; without it a refresh often slipped one hour.
const UPLOADS_SLACK_MINUTES = 10;
const UPLOADS_MESSAGE = 'channel-uploads';
const YT_IMAGE = /^https:\/\/yt3\.(ggpht|googleusercontent)\.com\/[^\s"'<>]+$/;
const UPLOADS = 5;
const KEEP_DAYS = 30;
const VIDEO_THUMB = /^https:\/\/i\.ytimg\.com\/[^\s"'<>]+$/;

// One playlistItems item -> a channel_videos row, or null (private / deleted / not yet published / too old).
function uploadOf(item, now) {
  const id = item?.contentDetails?.videoId;
  const sn = item?.snippet || {};
  const published = new Date(item?.contentDetails?.videoPublishedAt || '');
  const title = typeof sn.title === 'string' ? sn.title.replace(/\u0000/g, '').trim() : '';
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || !title || Number.isNaN(published.getTime())) return null;
  if (published.getTime() < now.getTime() - KEEP_DAYS * 864e5) return null;
  const t = sn.thumbnails || {};
  const thumb = (t.medium || t.high || t.default || {}).url;
  return { id, title: title.slice(0, 300), published, thumb: typeof thumb === 'string' && VIDEO_THUMB.test(thumb) ? thumb : null };
}

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
  const out = { checked: 0, returned: 0, logos: 0, metrics: 0, channelMetrics: 0, missing: 0, uploads: 0,
    uploadChannels: 0, uploadFailed: 0, purged: 0, quota: 0, stopped: null };
  const returnedIds = [];
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
        returnedIds.push(it.id);
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
        for (const [metric, value] of values) {
          await pool.query(
            `INSERT INTO channel_metrics (channel_key, metric, value, source, measured_at) VALUES ($1, $2, $3, 'youtube_data_api', $4)`,
            [it.id, metric, value, now]);
          out.channelMetrics++;
        }
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
    await storeLatestUploads(pool, yt, returnedIds, now, out, log);
  } catch (err) {
    status = 'failed';
    out.stopped = err instanceof QuotaExhausted ? err.message : `error: ${err.message}`;
  } finally {
    out.quota = budget.used;
    await pool.query(
      `UPDATE agent_runs SET finished_at = now(), status = $2, quota_units = $3, items_seen = $4, items_new = $5, message = $6 WHERE id = $1`,
      [run.id, status, budget.used, out.returned, out.logos,
        (`${RUN_MESSAGE}: ${out.checked} checked, ${out.returned} returned, ${out.missing} not returned, ${out.logos} logo rows, `
        + `${out.metrics} metrics, ${out.channelMetrics} channel metrics, ${out.uploads} uploads from ${out.uploadChannels} channels`
        + ` (${out.uploadFailed} failed, ${out.purged} purged)${out.stopped ? `; stopped: ${out.stopped}` : ''}`).slice(0, 500)]);
  }
  log(`[channel-logos] ${out.checked} checked, ${out.returned} returned, ${out.missing} not returned, ${out.logos} logo rows, `
    + `${out.metrics} metrics, ${out.channelMetrics} channel metrics, ${out.uploads} uploads from ${out.uploadChannels} channels `
    + `(${out.uploadFailed} failed, ${out.purged} purged), quota ${out.quota}${out.stopped ? `, stopped: ${out.stopped}` : ''}`);
  return { ...out, status };
}

// CR-2026-11-18-08: the newest uploads of each returned channel. A quota stop ends this step only (the run stays ok and
// says so); any other error on one channel (no uploads playlist, private) skips that channel.
async function storeLatestUploads(pool, yt, channelIds, now, out, log) {
  for (const channelId of channelIds) {
    let items;
    try {
      items = (await yt.latestUploads(channelId, UPLOADS)).items || [];
    } catch (err) {
      if (err instanceof QuotaExhausted) { out.stopped = `uploads: ${err.message}`; break; }
      out.uploadFailed++;
      log(`[channel-logos] uploads of ${channelId} skipped: ${err.message}`);
      continue;
    }
    out.uploadChannels++;
    for (const item of items) {
      const v = uploadOf(item, now);
      if (!v) continue;
      await pool.query(
        `INSERT INTO channel_videos (youtube_video_id, channel_key, title, published_at, thumbnail_url, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (youtube_video_id) DO UPDATE SET channel_key = EXCLUDED.channel_key, title = EXCLUDED.title,
           published_at = EXCLUDED.published_at, thumbnail_url = EXCLUDED.thumbnail_url, fetched_at = EXCLUDED.fetched_at`,
        [v.id, channelId, v.title, v.published, v.thumb, now]);
      out.uploads++;
    }
  }
  const { rowCount } = await pool.query(
    `DELETE FROM channel_videos WHERE published_at < $1::timestamptz - make_interval(days => $2)
        OR fetched_at < $1::timestamptz - make_interval(days => $2)`, [now, KEEP_DAYS]);
  out.purged = rowCount;
}

// CR-2026-11-26-02: the channels whose uploads are fetched - those the last daily run saw (channel_metrics in the last
// 3 days), so a channel the API no longer returns is not paid for every 3 h; all directory channels before any such run.
async function uploadChannelIds(pool, now) {
  const { rows } = await pool.query(
    `SELECT DISTINCT vc.youtube_channel_id AS id FROM video_channels vc
      WHERE vc.youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'
        AND EXISTS (SELECT 1 FROM channel_metrics cm WHERE cm.channel_key = vc.youtube_channel_id
                      AND cm.measured_at > $1::timestamptz - interval '3 days')
      ORDER BY 1`, [now]);
  if (rows.length) return rows.map((r) => r.id);
  const { rows: all } = await pool.query(
    `SELECT DISTINCT youtube_channel_id AS id FROM video_channels WHERE youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$' ORDER BY 1`);
  return all.map((r) => r.id);
}

// Units the YouTube agent's discovery leaves free for the next uploads run (one per channel, plus a small margin).
async function uploadsReserve(pool, now = new Date()) {
  return (await uploadChannelIds(pool, now)).length + 5;
}

// CR-2026-11-26-02: the newest uploads only, every UPLOADS_REFRESH_HOURS (a daily channel-logos run counts as one).
async function refreshLatestUploads(pool, { apiKey = process.env.YOUTUBE_API_KEY, fetchImpl = (...a) => fetch(...a), log = console.log,
  now = new Date() } = {}) {
  if (!apiKey) return { skipped: 'no YOUTUBE_API_KEY' };
  const { rows: [agent] } = await pool.query(`SELECT paused, daily_quota_units FROM discovery_agents WHERE agent = 'youtube'`);
  if (!agent || agent.paused) return { skipped: 'paused' };
  const { rows: [last] } = await pool.query(
    `SELECT 1 FROM agent_runs WHERE agent = 'youtube' AND (message LIKE $2 OR message LIKE $3) AND status = 'ok'
        AND started_at > $1::timestamptz - make_interval(hours => $4) + make_interval(mins => $5::int) LIMIT 1`,
    [now, `${RUN_MESSAGE}%`, `${UPLOADS_MESSAGE}%`, UPLOADS_REFRESH_HOURS, UPLOADS_SLACK_MINUTES]);
  if (last) return { skipped: `uploads fetched in the last ${UPLOADS_REFRESH_HOURS} h` };

  const ids = await uploadChannelIds(pool, now);
  if (!ids.length) return { uploadChannels: 0, quota: 0 };
  const { rows: [{ used }] } = await pool.query(
    `SELECT coalesce(sum(quota_units), 0)::int AS used FROM agent_runs WHERE agent = 'youtube' AND started_at > $1::timestamptz - interval '24 hours'`,
    [now]);
  const budget = { used: 0, limit: Math.max(agent.daily_quota_units - used, 0) };
  if (budget.limit < ids.length) {
    // CR-2026-11-27-02: recorded (status 'skipped', 0 units) so a gap shows on /admin/creators; not counted as a refresh.
    const skipped = `quota budget used (${budget.limit} left, ${ids.length} needed)`;
    await pool.query(
      `INSERT INTO agent_runs (agent, started_at, finished_at, status, message) VALUES ('youtube', $1, now(), 'skipped', $2)`,
      [now, `${UPLOADS_MESSAGE} skipped: ${budget.limit} units left in 24 h, ${ids.length} needed`]);
    log(`[channel-uploads] skipped: ${skipped}`);
    return { skipped };
  }

  const { rows: [run] } = await pool.query(`INSERT INTO agent_runs (agent, message, started_at) VALUES ('youtube', $1, $2) RETURNING id`, [UPLOADS_MESSAGE, now]);
  const yt = youtubeClient(apiKey, fetchImpl, budget);
  const out = { uploads: 0, uploadChannels: 0, uploadFailed: 0, purged: 0, quota: 0, stopped: null };
  let status = 'ok';
  try {
    await storeLatestUploads(pool, yt, ids, now, out, log);
  } catch (err) {
    status = 'failed';
    out.stopped = `error: ${err.message}`;
  } finally {
    out.quota = budget.used;
    await pool.query(
      `UPDATE agent_runs SET finished_at = now(), status = $2, quota_units = $3, items_seen = $4, items_new = $5, message = $6 WHERE id = $1`,
      [run.id, status, budget.used, out.uploadChannels, out.uploads,
        (`${UPLOADS_MESSAGE}: ${out.uploads} uploads from ${out.uploadChannels} of ${ids.length} channels`
        + ` (${out.uploadFailed} failed, ${out.purged} purged)${out.stopped ? `; stopped: ${out.stopped}` : ''}`).slice(0, 500)]);
  }
  log(`[channel-uploads] ${out.uploads} uploads from ${out.uploadChannels} of ${ids.length} channels (${out.uploadFailed} failed, `
    + `${out.purged} purged), quota ${out.quota}${out.stopped ? `, stopped: ${out.stopped}` : ''}`);
  return { ...out, status };
}

module.exports = { refreshChannelLogos, refreshLatestUploads, uploadsReserve, logoOf, uploadOf, REFRESH_HOURS, UPLOADS_REFRESH_HOURS, UPLOADS_SLACK_MINUTES };
