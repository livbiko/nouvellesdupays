// Daily robots.txt check against the test database with a fake fetch (no network).
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { checkRobots, wholeSiteBlocked, MAX_TURN_OFF } = require('../src/robots-check');
const { parseRobots } = require('@nouvellesdupays/shared/src/robots');
const { USER_AGENT } = require('../src/poll');

const pool = getPool();
const quiet = () => {};
let pub;

// robots.txt bodies per origin; a number = that HTTP status, 'throw' = network error. Records every request.
function fakeFetch(sites) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, ua: opts.headers['User-Agent'] });
    const body = sites[new URL(url).origin];
    if (body === 'throw' || body === undefined) throw new Error('fetch failed');
    if (typeof body === 'number') return { ok: body < 400, status: body, text: async () => '' };
    return { ok: true, status: 200, text: async () => body };
  };
  return { calls, fetchImpl };
}

const BLOCK_ALL = 'User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /\n';
const BLOCK_FEED = 'User-agent: *\nDisallow: /feed\n';
const ALLOW_FEED_ONLY = 'User-agent: *\nDisallow: /\nAllow: /feed\n';

async function feed(url, { enabled = true, status = 'ok', type = 'rss' } = {}) {
  const { rows: [f] } = await pool.query(
    `INSERT INTO feeds (publisher_id, feed_url, feed_type, enabled, last_status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [pub, url, type, enabled, status]);
  return f.id;
}
const state = async (id) => (await pool.query('SELECT enabled, last_status, last_error FROM feeds WHERE id = $1', [id])).rows[0];

before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE articles, feeds, publishers, countries, publisher_submissions RESTART IDENTITY CASCADE');
  const { rows: [c] } = await pool.query(`INSERT INTO countries (iso_code, name, region) VALUES ('NA', 'Namibia', 'Southern Africa') RETURNING id`);
  const { rows: [p] } = await pool.query(
    `INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language)
     VALUES ($1, 'Test', 'https://a.example/', 'a.example', 'active', 'en') RETURNING id`, [c.id]);
  pub = p.id;
});

after(async () => {
  await pool.end();
});

test('wholeSiteBlocked: front page and feed both disallowed; a feed-only block or an allowed feed is not', () => {
  assert.equal(wholeSiteBlocked(parseRobots(BLOCK_ALL), 'https://a.example/feed'), true);
  assert.equal(wholeSiteBlocked(parseRobots(BLOCK_FEED), 'https://a.example/feed'), false);
  assert.equal(wholeSiteBlocked(parseRobots(ALLOW_FEED_ONLY), 'https://a.example/feed'), false);
  assert.equal(wholeSiteBlocked(parseRobots('User-agent: nouvellesdupaysbot\nDisallow: /\n'), 'https://a.example/rss?x=1'), true);
  assert.equal(wholeSiteBlocked('allow-all', 'https://a.example/feed'), false);
});

test('turns off whole-site blocks, turns cleared ones back on, leaves the rest alone', async () => {
  await pool.query('TRUNCATE feeds RESTART IDENTITY CASCADE');
  const blocked = await feed('https://blocked.example/feed');
  const feedPath = await feed('https://path.example/feed');
  const unreadable = await feed('https://down.example/feed');
  const notFound = await feed('https://nofile.example/feed');
  const cleared = await feed('https://cleared.example/feed', { enabled: false, status: 'robots_blocked' });
  const stillBlocked = await feed('https://still.example/feed', { enabled: false, status: 'robots_blocked' });
  const offOther = await feed('https://other.example/feed', { enabled: false, status: 'ok' });
  const crawled = await feed('https://crawl.example/', { type: 'html' });
  const ghana = await feed('https://www.ghanaweb.com/feed');
  const { calls, fetchImpl } = fakeFetch({
    'https://blocked.example': BLOCK_ALL, 'https://path.example': BLOCK_FEED, 'https://down.example': 503,
    'https://nofile.example': 404, 'https://cleared.example': BLOCK_FEED, 'https://still.example': BLOCK_ALL,
    'https://other.example': '', 'https://crawl.example': BLOCK_ALL, 'https://www.ghanaweb.com': BLOCK_ALL,
  });
  const s = await checkRobots(pool, { fetchImpl, log: quiet, pauseMs: 0 });
  assert.deepEqual(s.turnedOff, [blocked]);
  assert.deepEqual(s.turnedOn, [cleared]);
  assert.equal(s.unreadable, 1);
  assert.deepEqual(await state(blocked), { enabled: false, last_status: 'robots_blocked', last_error: 'robots.txt disallows the whole site for NouvellesDuPaysBot' });
  assert.equal((await state(cleared)).enabled, true);
  assert.equal((await state(cleared)).last_status, 'robots_cleared');
  assert.equal((await state(stillBlocked)).enabled, false);
  for (const id of [feedPath, unreadable, notFound]) assert.equal((await state(id)).enabled, true);
  assert.equal((await state(offOther)).enabled, false);
  assert.equal((await state(crawled)).enabled, true);
  assert.equal((await state(ghana)).enabled, true);
  // Only the RSS feeds' origins were asked, once each, with the feed poller's user agent; never crawled or GhanaWeb sites.
  const asked = calls.map((c) => new URL(c.url).origin).sort();
  assert.deepEqual(asked, ['https://blocked.example', 'https://cleared.example', 'https://down.example', 'https://nofile.example', 'https://path.example', 'https://still.example']);
  assert.ok(calls.every((c) => c.ua === USER_AGENT && c.url.endsWith('/robots.txt')));
});

test('an unreadable robots.txt never turns a blocked feed back on', async () => {
  await pool.query('TRUNCATE feeds RESTART IDENTITY CASCADE');
  const id = await feed('https://flaky.example/feed', { enabled: false, status: 'robots_blocked' });
  const { fetchImpl } = fakeFetch({ 'https://flaky.example': 'throw' });
  const s = await checkRobots(pool, { fetchImpl, log: quiet, pauseMs: 0 });
  assert.deepEqual(s.turnedOn, []);
  assert.equal((await state(id)).enabled, false);
});

test('dry run reports without changing anything', async () => {
  await pool.query('TRUNCATE feeds RESTART IDENTITY CASCADE');
  const id = await feed('https://blocked.example/feed');
  const { fetchImpl } = fakeFetch({ 'https://blocked.example': BLOCK_ALL });
  const s = await checkRobots(pool, { fetchImpl, log: quiet, pauseMs: 0, dryRun: true });
  assert.deepEqual(s.turnedOff, [id]);
  assert.equal((await state(id)).enabled, true);
});

test(`more than ${MAX_TURN_OFF} feeds to turn off in one run: refused, nothing changed`, async () => {
  await pool.query('TRUNCATE feeds RESTART IDENTITY CASCADE');
  const sites = {};
  for (let i = 0; i <= MAX_TURN_OFF; i++) {
    await feed(`https://s${i}.example/feed`);
    sites[`https://s${i}.example`] = BLOCK_ALL;
  }
  const { fetchImpl } = fakeFetch(sites);
  const s = await checkRobots(pool, { fetchImpl, log: quiet, pauseMs: 0 });
  assert.equal(s.refused, true);
  assert.deepEqual(s.turnedOff, []);
  const { rows: [n] } = await pool.query('SELECT count(*)::int AS n FROM feeds WHERE enabled');
  assert.equal(n.n, MAX_TURN_OFF + 1);
});
