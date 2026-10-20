// YouTube Data API v3 audience fetcher (spec section 9, 16, 17).
//
// Reads social_accounts WHERE platform='youtube', fetches channel statistics
// (subscribers, total views, video count) via the YouTube Data API v3, and
// writes the results to audience_metrics. Fails gracefully when
// YOUTUBE_API_KEY is not set — the audience_metrics table stays empty until
// the key is configured, and every source page + rankings page renders fine
// without numbers.
//
// Quota: channels.list costs 1 unit per CALL (not per channel). We batch all
// known channel-ID accounts into a single call (≤50 IDs), then do one call
// per handle-only account. With ~200 African YouTube accounts at weekly
// refresh, budget ≈ 5 calls/week — well within the 10 000 unit/day free tier.
//
// Safe to run repeatedly: audience_metrics is append-only (one row per
// metric snapshot), and the rankings query always reads the latest row per
// metric — a re-run adds a fresh snapshot, never corrupts old ones.

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const RECHECK_DAYS = 7;
const MAX_PER_RUN = 50;

// Extract UC… channel ID from youtube.com/channel/UC…
function extractChannelId(url) {
  try {
    const m = new URL(url).pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/);
    return m ? m[1] : null;
  } catch { return null; }
}

// Extract handle from youtube.com/@handle, /c/Name, or legacy /Name paths.
// Returns the raw string without '@'.
function extractHandle(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/^\/@([^/?#]+)\/?$/);
    if (m) return m[1];
    const c = p.match(/^\/c\/([^/?#]+)\/?$/);
    if (c) return c[1];
    // Legacy single-segment: exclude known non-channel system paths
    const l = p.match(/^\/([A-Za-z0-9._-]+)\/?$/);
    const SYSTEM = new Set(['watch', 'shorts', 'live', 'feed', 'results', 'channel', 'c', 'user', 'playlist', 'embed']);
    if (l && !SYSTEM.has(l[1])) return l[1];
    return null;
  } catch { return null; }
}

// Batch up to 50 channel IDs in one call. Returns map { channelId → {snippet, statistics} }.
async function fetchByIds(ids, fetchImpl) {
  const url = `${API_BASE}/channels?part=snippet%2Cstatistics&id=${ids.join('%2C')}&maxResults=50&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const map = {};
  for (const item of (data.items || [])) {
    map[item.id] = { snippet: item.snippet || {}, statistics: item.statistics || {} };
  }
  return map;
}

// One call per handle (forHandle parameter).
async function fetchByHandle(handle, fetchImpl) {
  const url = `${API_BASE}/channels?part=snippet%2Cstatistics&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API HTTP ${res.status} (handle ${handle}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return { channelId: item.id, snippet: item.snippet || {}, statistics: item.statistics || {} };
}

async function saveMetrics(pool, accountId, channelId, snippet, statistics, now) {
  const handle = (snippet.customUrl || '').replace(/^@/, '') || null;
  await pool.query(
    `UPDATE social_accounts
        SET platform_account_id = $1,
            handle = COALESCE($2, handle),
            status = 'active',
            last_checked_at = $3,
            last_activity_at = $3
      WHERE id = $4`,
    [channelId, handle, now, accountId]
  );
  const entries = [
    ['subscribers',  statistics.subscriberCount, statistics.hiddenSubscriberCount !== true],
    ['total_views',  statistics.viewCount,        true],
    ['video_count',  statistics.videoCount,       true],
  ];
  for (const [metric, raw, visible] of entries) {
    if (!visible || raw == null) continue;
    const v = parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 0) continue;
    await pool.query(
      `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
       VALUES ($1, $2, $3, 'youtube_data_api', $4)`,
      [accountId, metric, v, now]
    );
  }
}

async function fetchYoutubeAudience(pool, { fetchImpl = (...a) => fetch(...a), log = console.log } = {}) {
  if (!YOUTUBE_API_KEY) {
    log('[youtube-audience] YOUTUBE_API_KEY not set — skipping (set it to populate audience_metrics)');
    return { skipped: true };
  }

  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400000);
  const { rows: accounts } = await pool.query(
    `SELECT sa.id, sa.url, sa.handle, sa.platform_account_id
       FROM social_accounts sa
       JOIN publishers p  ON p.id = sa.publisher_id
       JOIN countries  c  ON c.id = p.country_id
      WHERE sa.platform = 'youtube'
        AND sa.status   <> 'dead'
        AND (sa.last_checked_at IS NULL OR sa.last_checked_at < $1)
        AND c.region = ANY($2)
      ORDER BY sa.last_checked_at NULLS FIRST
      LIMIT $3`,
    [cutoff, ['West Africa','East Africa','Central Africa','North Africa','Southern Africa'], MAX_PER_RUN]
  );

  if (accounts.length === 0) {
    log('[youtube-audience] all channels up to date');
    return { updated: 0, errors: 0 };
  }
  log(`[youtube-audience] refreshing ${accounts.length} channel(s)`);

  const now = new Date();
  const byId  = {};  // channelId → account row
  const needHandle = [];

  for (const acc of accounts) {
    const cid = acc.platform_account_id || extractChannelId(acc.url);
    if (cid) { byId[cid] = acc; } else { needHandle.push(acc); }
  }

  let updated = 0;
  let errors  = 0;

  // --- Batch: known channel IDs ------------------------------------------
  if (Object.keys(byId).length > 0) {
    try {
      const stats = await fetchByIds(Object.keys(byId), fetchImpl);
      for (const [cid, { snippet, statistics }] of Object.entries(stats)) {
        await saveMetrics(pool, byId[cid].id, cid, snippet, statistics, now);
        updated++;
      }
      // Anything not returned by the API is gone/private → mark dead
      for (const [cid, acc] of Object.entries(byId)) {
        if (!stats[cid]) {
          await pool.query(
            `UPDATE social_accounts SET status = 'dead', last_checked_at = $1 WHERE id = $2`,
            [now, acc.id]
          );
          log(`  channel ${cid} not found in API — marked dead`);
        }
      }
    } catch (err) {
      log(`[youtube-audience] batch ID error: ${err.message}`);
      errors++;
    }
  }

  // --- Sequential: handle lookups ----------------------------------------
  for (const acc of needHandle) {
    const handle = acc.handle || extractHandle(acc.url);
    if (!handle) {
      await pool.query(
        `UPDATE social_accounts SET status = 'dead', last_checked_at = $1 WHERE id = $2`,
        [now, acc.id]
      );
      log(`  account ${acc.id} ${acc.url} — cannot extract channel ID or handle, marked dead`);
      continue;
    }
    try {
      const result = await fetchByHandle(handle, fetchImpl);
      if (!result) {
        await pool.query(
          `UPDATE social_accounts SET status = 'dead', last_checked_at = $1 WHERE id = $2`,
          [now, acc.id]
        );
        log(`  @${handle} not found — marked dead`);
      } else {
        await saveMetrics(pool, acc.id, result.channelId, result.snippet, result.statistics, now);
        updated++;
        log(`  @${handle} → ${result.channelId}: ${result.statistics.subscriberCount ?? '?'} subscribers`);
      }
    } catch (err) {
      log(`  @${handle} error: ${err.message}`);
      errors++;
      // bump last_checked_at so a transient error doesn't retry on every run
      await pool.query(
        `UPDATE social_accounts SET last_checked_at = $1 WHERE id = $2`,
        [now, acc.id]
      );
    }
  }

  log(`[youtube-audience] done — updated: ${updated}, errors: ${errors}`);
  return { updated, errors };
}

module.exports = { fetchYoutubeAudience };
