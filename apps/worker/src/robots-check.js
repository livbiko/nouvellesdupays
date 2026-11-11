// Daily robots.txt check for polled feeds (Build #222). The 5-minute poller never reads robots.txt; owner policy
// 2026-11-11 is to respect a robots.txt that blocks the whole site for our bot (feed-path-only blocks stay on). Build
// #220 turned off the first 4 such feeds by hand; this job keeps it true over time:
// - a feed whose site disallows both its front page and the feed URL for NouvellesDuPaysBot is turned off and marked
//   last_status 'robots_blocked';
// - a feed marked 'robots_blocked' whose site no longer blocks it is turned back on;
// - an unreadable robots.txt (timeout, 5xx) changes nothing -- a temporary error never turns a feed off;
// - crawled sources (feed_type sitemap/html, e.g. KOACI) are left out: the crawler obeys robots.txt itself;
// - GhanaWeb is left out (owner: leave alone).
// More than MAX_TURN_OFF feeds turned off in one run is refused as a likely parser or network fault.
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { parseRobots, isAllowed } = require('@nouvellesdupays/shared/src/robots');
const { USER_AGENT } = require('./poll');

const MAX_TURN_OFF = 10;
const LANES = 4;
const PAUSE_MS = 300;
const TIMEOUT_MS = 15000;
const SKIP_HOST = /(^|\.)ghanaweb\.com$/i;

// robots.txt of one origin: parsed groups, 'allow-all' (4xx, or an HTML page in its place), or null (unreadable).
async function loadRobots(origin, fetchImpl) {
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 400 && res.status < 500) return 'allow-all';
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, 512 * 1024);
    if (/<html|<!doctype/i.test(text.slice(0, 500))) return 'allow-all';
    return parseRobots(text);
  } catch {
    return null;
  }
}

function wholeSiteBlocked(robots, feedUrl) {
  return !isAllowed(robots, `${new URL(feedUrl).origin}/`) && !isAllowed(robots, feedUrl);
}

async function checkRobots(pool = getPool(), { fetchImpl = fetch, dryRun = false, log = console.log, pauseMs = PAUSE_MS } = {}) {
  const { rows: feeds } = await pool.query(
    `SELECT f.id, f.feed_url, f.enabled, p.name AS publisher_name
     FROM feeds f JOIN publishers p ON p.id = f.publisher_id
     WHERE p.feed_status = 'active' AND f.feed_type IN ('rss', 'atom', 'sitemap-news')
       AND (f.enabled OR f.last_status = 'robots_blocked')
     ORDER BY f.id`
  );
  const byOrigin = new Map();
  for (const f of feeds) {
    let u;
    try { u = new URL(f.feed_url); } catch { continue; }
    if (SKIP_HOST.test(u.hostname)) continue;
    if (!byOrigin.has(u.origin)) byOrigin.set(u.origin, []);
    byOrigin.get(u.origin).push(f);
  }

  const turnOff = [];
  const turnOn = [];
  let unreadable = 0;
  const origins = [...byOrigin.keys()];
  let next = 0;
  async function lane() {
    while (next < origins.length) {
      const origin = origins[next++];
      const robots = await loadRobots(origin, fetchImpl);
      if (robots === null) unreadable++;
      else {
        for (const f of byOrigin.get(origin)) {
          const blocked = wholeSiteBlocked(robots, f.feed_url);
          if (blocked && f.enabled) turnOff.push(f);
          else if (!blocked && !f.enabled) turnOn.push(f);
        }
      }
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(LANES, origins.length) }, lane));

  const summary = { origins: origins.length, unreadable, turnedOff: [], turnedOn: [], refused: false, dryRun };
  if (turnOff.length > MAX_TURN_OFF) {
    summary.refused = true;
    log(`[robots] REFUSED: ${turnOff.length} feeds would be turned off (limit ${MAX_TURN_OFF}) -- nothing changed: ${turnOff.map((f) => f.id).join(', ')}`);
    return summary;
  }
  for (const f of turnOff) {
    log(`[robots] ${dryRun ? 'would turn off' : 'turned off'} ${f.id} ${f.publisher_name} (${f.feed_url}): robots.txt blocks the whole site`);
    if (!dryRun) {
      await pool.query(
        `UPDATE feeds SET enabled = false, last_status = 'robots_blocked', last_error_at = now(),
           last_error = 'robots.txt disallows the whole site for NouvellesDuPaysBot' WHERE id = $1 AND enabled`,
        [f.id]
      );
    }
    summary.turnedOff.push(f.id);
  }
  for (const f of turnOn) {
    log(`[robots] ${dryRun ? 'would turn on' : 'turned on'} ${f.id} ${f.publisher_name} (${f.feed_url}): robots.txt no longer blocks it`);
    if (!dryRun) {
      await pool.query(
        `UPDATE feeds SET enabled = true, last_status = 'robots_cleared' WHERE id = $1 AND NOT enabled AND last_status = 'robots_blocked'`,
        [f.id]
      );
    }
    summary.turnedOn.push(f.id);
  }
  log(`[robots] ${origins.length} site(s) checked, ${unreadable} unreadable (left as they are), ${summary.turnedOff.length} turned off, ${summary.turnedOn.length} turned on${dryRun ? ' (dry run, nothing changed)' : ''}`);
  return summary;
}

module.exports = { checkRobots, wholeSiteBlocked, loadRobots, MAX_TURN_OFF };
