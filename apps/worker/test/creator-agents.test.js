// Creator agents against the test database with a fake YouTube API (no network, no key).
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { planDiscovery, runYoutubeAgent } = require('../src/creator-agents');

const pool = getPool();
const ids = {};
const quiet = () => {};

// Fake YouTube API: channels known by id/handle, search results per region; records every call and its URL.
function fakeYoutube({ channels = {}, search = {}, fail = null } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const kind = u.pathname.split('/').pop();
    calls.push({ kind, params: Object.fromEntries(u.searchParams) });
    if (fail && fail(kind, u)) return { ok: false, status: fail(kind, u), text: async () => `{"error": "boom", "url": "${url}"}` };
    let items = [];
    if (kind === 'channels') {
      const p = u.searchParams;
      items = p.get('forHandle') ? Object.values(channels).filter((c) => c.snippet.customUrl === `@${p.get('forHandle')}`)
        : p.get('id').split(',').map((id) => channels[id]).filter(Boolean);
    } else if (kind === 'search') {
      const pages = search[u.searchParams.get('regionCode')] || [[]];
      const i = Number(u.searchParams.get('pageToken') || 0);
      return { ok: true, json: async () => ({ items: pages[i].map((id) => ({ id: { channelId: id } })), nextPageToken: pages[i + 1] ? String(i + 1) : undefined }) };
    }
    return { ok: true, json: async () => ({ items }) };
  };
  return { calls, fetchImpl };
}

const channel = (id, { title = id, country = 'CI', subs = '50000', hidden = false, handle, topics = [] } = {}) => ({
  id,
  snippet: { title, country, customUrl: handle ? `@${handle}` : undefined, defaultLanguage: 'fr', thumbnails: { default: { url: `https://yt3.example/${id}.jpg` } } },
  statistics: { subscriberCount: subs, viewCount: '9000000', videoCount: '300', hiddenSubscriberCount: hidden },
  topicDetails: { topicCategories: topics.map((t) => `https://en.wikipedia.org/wiki/${t}`) },
});
const UC = (n) => `UC${String(n).padStart(22, 'x')}`;

before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE articles, feeds, publishers, countries, publisher_submissions, discovery_jobs, agent_runs RESTART IDENTITY CASCADE');
  const { rows } = await pool.query(
    `INSERT INTO countries (iso_code, name, region) VALUES ('CI', 'Côte d''Ivoire', 'West Africa'), ('NG', 'Nigeria', 'West Africa'),
       ('KE', 'Kenya', 'East Africa'), ('FR', 'France', 'Western Europe'), ('NE', 'Niger', 'West Africa') RETURNING id, iso_code`);
  for (const r of rows) ids[r.iso_code] = r.id;
  await pool.query(`UPDATE discovery_agents SET paused = true, daily_quota_units = 8000`);
  // A creator with an approved YouTube channel known by id, one known only by handle, one rejected account.
  const { rows: [cr] } = await pool.query(
    `INSERT INTO creators (slug, display_name, country_id, review_status, confidence) VALUES ('le-samourai', 'Le Samouraï', $1, 'approved', 'HIGH_CONFIDENCE') RETURNING id`, [ids.CI]);
  ids.creator = cr.id;
  const { rows: accs } = await pool.query(
    `INSERT INTO social_accounts (creator_id, platform, url, verification) VALUES
       ($1, 'youtube', 'https://youtube.com/channel/${UC(1)}', 'verified'),
       ($1, 'youtube', 'https://youtube.com/@bantumedia', 'unverified'),
       ($1, 'youtube', 'https://youtube.com/@fakesamourai', 'rejected')
     RETURNING id, url`, [cr.id]);
  ids.accById = accs[0].id;
  ids.accByHandle = accs[1].id;
  ids.accRejected = accs[2].id;
});

after(async () => {
  await pool.end();
});

test('paused agents and a missing key do nothing', async () => {
  const yt = fakeYoutube();
  assert.deepEqual(await planDiscovery(pool, { log: quiet }), { skipped: 'paused' });
  assert.deepEqual(await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet }), { skipped: 'paused' });
  await pool.query(`UPDATE discovery_agents SET paused = false WHERE agent = 'youtube'`);
  assert.deepEqual(await runYoutubeAgent(pool, { apiKey: '', fetchImpl: yt.fetchImpl, log: quiet }), { skipped: 'no YOUTUBE_API_KEY' });
  assert.equal(yt.calls.length, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM agent_runs')).rows[0].n, 0);
});

test('global agent queues countries in priority order, once per week', async () => {
  await pool.query(`UPDATE discovery_agents SET paused = false WHERE agent = 'global'`);
  const r = await planDiscovery(pool, { log: quiet, maxJobs: 3 });
  assert.equal(r.queued, 3);
  const { rows } = await pool.query(
    `SELECT c.iso_code FROM discovery_jobs j JOIN countries c ON c.id = j.country_id ORDER BY j.id`);
  assert.deepEqual(rows.map((x) => x.iso_code), ['CI', 'NG', 'NE'], 'priority list first, then the rest of West Africa');
  assert.equal((await planDiscovery(pool, { log: quiet, maxJobs: 3 })).queued, 0, 'no room: 3 jobs already open');
  await pool.query(`UPDATE discovery_jobs SET status = 'done'`);
  const again = await planDiscovery(pool, { log: quiet, maxJobs: 10 });
  assert.equal(again.queued, 2, 'only KE and FR are due: the others were searched this week');
  await pool.query(`DELETE FROM discovery_jobs WHERE status = 'queued'`);
});

test('youtube agent: refreshes creator accounts, adds only matching channels as candidates, counts quota', async () => {
  await pool.query(`UPDATE discovery_jobs SET status = 'done' WHERE status <> 'done'`);
  await pool.query(
    `INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key) VALUES
       ('youtube', 'discover', $1, '{"pages": 2, "min_subscribers": 10000}', 'test:ci')`, [ids.CI]);
  const channels = {
    [UC(1)]: channel(UC(1), { title: 'Le Samouraï', subs: '120000' }),
    [UC(2)]: channel(UC(2), { title: 'Bantu Media', handle: 'bantumedia', subs: '80000' }),
    [UC(10)]: channel(UC(10), { title: 'Gbairai TV', subs: '250000', topics: ['Humour', 'Entertainment'] }),
    [UC(11)]: channel(UC(11), { title: 'Paris Vlog', country: 'FR', subs: '900000' }),
    [UC(12)]: channel(UC(12), { title: 'Tiny CI', subs: '900' }),
    [UC(13)]: channel(UC(13), { title: 'Hidden CI', hidden: true }),
    [UC(14)]: channel(UC(14), { title: 'Abidjan Music', subs: '40000', topics: ['Music'] }),
  };
  const yt = fakeYoutube({ channels, search: { CI: [[UC(10), UC(11), UC(12)], [UC(13), UC(14), UC(1)]] } });
  const r = await runYoutubeAgent(pool, { apiKey: 'secret-key', fetchImpl: yt.fetchImpl, log: quiet });
  assert.equal(r.status, 'ok');
  assert.equal(r.refreshed, 2, 'id + handle accounts; the rejected one is not refreshed');
  assert.equal(r.jobs, 1);
  assert.equal(r.added, 2, 'Gbairai TV and Abidjan Music; not the French, tiny, hidden or already-known channels');
  assert.equal(r.quota, 1 + 1 + (100 + 1) * 2, 'channels by id + by handle + 2 x (search + channels)');

  const { rows: metrics } = await pool.query(
    `SELECT sa.id, am.metric, am.value::int AS value, am.source FROM audience_metrics am JOIN social_accounts sa ON sa.id = am.social_account_id
     WHERE sa.id = $1 ORDER BY am.metric`, [ids.accByHandle]);
  assert.deepEqual(metrics.map((m) => [m.metric, m.value, m.source]),
    [['subscribers', 80000, 'youtube_data_api'], ['total_views', 9000000, 'youtube_data_api'], ['video_count', 300, 'youtube_data_api']]);
  const { rows: [acc] } = await pool.query('SELECT platform_account_id, display_name, verification, status FROM social_accounts WHERE id = $1', [ids.accByHandle]);
  assert.deepEqual(acc, { platform_account_id: UC(2), display_name: 'Bantu Media', verification: 'unverified', status: 'active' },
    'statistics fetched, but the API saying a channel exists is not ownership evidence');
  const { rows: [rej] } = await pool.query('SELECT last_checked_at FROM social_accounts WHERE id = $1', [ids.accRejected]);
  assert.equal(rej.last_checked_at, null);

  const { rows: cands } = await pool.query(
    `SELECT cr.display_name, cr.slug, cr.review_status, cr.confidence, cr.languages, cr.possible_minor,
       (SELECT array_agg(cc.slug ORDER BY l.is_primary DESC, cc.slug) FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id WHERE l.creator_id = cr.id) AS cats,
       (SELECT count(*)::int FROM audience_metrics am JOIN social_accounts sa ON sa.id = am.social_account_id WHERE sa.creator_id = cr.id) AS metric_rows
     FROM creators cr WHERE cr.id <> $1 ORDER BY cr.display_name`, [ids.creator]);
  assert.deepEqual(cands.map((c) => [c.display_name, c.slug, c.review_status, c.confidence, c.languages, c.cats, c.metric_rows]), [
    ['Abidjan Music', 'abidjan-music', 'candidate', 'REQUIRES_REVIEW', ['fr'], ['music'], 3],
    ['Gbairai TV', 'gbairai-tv', 'candidate', 'REQUIRES_REVIEW', ['fr'], ['comedy', 'entertainment'], 3],
  ]);
  const { rows: [job] } = await pool.query(`SELECT status, result, quota_units_used, attempts FROM discovery_jobs WHERE idempotency_key = 'test:ci'`);
  assert.deepEqual([job.status, job.result.added, job.result.pages, job.quota_units_used, job.attempts], ['done', 2, 2, 202, 1]);
  const { rows: [run] } = await pool.query(`SELECT status, quota_units, items_new FROM agent_runs WHERE agent = 'youtube'`);
  assert.deepEqual(run, { status: 'ok', quota_units: 204, items_new: 2 });
  assert.ok(yt.calls.every((c) => c.params.key === 'secret-key'));
});

test('a re-run the same day refreshes nothing new and never duplicates candidates', async () => {
  await pool.query(`INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key) VALUES ('youtube', 'discover', $1, '{}', 'test:ci:2')`, [ids.CI]);
  const yt = fakeYoutube({ channels: { [UC(10)]: channel(UC(10), { subs: '250000' }) }, search: { CI: [[UC(10)]] } });
  const r = await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet });
  assert.equal(r.refreshed, 0, 'accounts were refreshed less than 20 h ago');
  assert.equal(r.added, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM creators')).rows[0].n, 3);
});

test('quota: the 24 h budget stops the run and the job resumes later without losing an attempt', async () => {
  // Earlier runs used 204 + 101 = 305 units in the last 24 h; a 455 budget leaves 150: one search page (100, no
  // results so no channels call), then the second page does not fit.
  await pool.query(`UPDATE discovery_agents SET daily_quota_units = 455 WHERE agent = 'youtube'`);
  await pool.query(`INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key) VALUES ('youtube', 'discover', $1, '{"pages": 3}', 'test:ng')`, [ids.NG]);
  const yt = fakeYoutube({ search: { NG: [[], [], []] } });
  const r = await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet });
  assert.match(r.stopped, /quota budget reached/);
  const { rows: [job] } = await pool.query(`SELECT status, attempts, checkpoint, quota_units_used FROM discovery_jobs WHERE idempotency_key = 'test:ng'`);
  assert.equal(job.status, 'queued');
  assert.equal(job.attempts, 0, 'a quota stop does not use up an attempt');
  assert.equal(job.checkpoint.page, 1, 'resumes at page 2');
  assert.equal(job.quota_units_used, 100);
  // 50 units left and the job waits an hour: the next run makes no search call.
  const yt2 = fakeYoutube({ search: { NG: [[], [], []] } });
  await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt2.fetchImpl, log: quiet });
  assert.equal(yt2.calls.length, 0);
  await pool.query(`UPDATE discovery_agents SET daily_quota_units = 405 WHERE agent = 'youtube'`);
  assert.match((await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt2.fetchImpl, log: quiet })).skipped, /quota budget used/);
  await pool.query(`UPDATE discovery_agents SET daily_quota_units = 8000 WHERE agent = 'youtube'`);
  await pool.query(`UPDATE discovery_jobs SET status = 'done' WHERE idempotency_key = 'test:ng'`);
});

test('API errors: retried with a delay, then failed; the key never appears in the error', async () => {
  await pool.query(`INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key, max_attempts) VALUES ('youtube', 'discover', $1, '{}', 'test:ke', 2)`, [ids.KE]);
  const yt = fakeYoutube({ fail: (kind) => (kind === 'search' ? 500 : null) });
  await runYoutubeAgent(pool, { apiKey: 'super-secret', fetchImpl: yt.fetchImpl, log: quiet });
  let { rows: [job] } = await pool.query(`SELECT status, attempts, last_error, next_run_at > now() AS later FROM discovery_jobs WHERE idempotency_key = 'test:ke'`);
  assert.deepEqual([job.status, job.attempts, job.later], ['queued', 1, true]);
  assert.match(job.last_error, /HTTP 500/);
  assert.doesNotMatch(job.last_error, /super-secret/);
  await pool.query(`UPDATE discovery_jobs SET next_run_at = now() WHERE idempotency_key = 'test:ke'`);
  await runYoutubeAgent(pool, { apiKey: 'super-secret', fetchImpl: yt.fetchImpl, log: quiet });
  ({ rows: [job] } = await pool.query(`SELECT status, attempts FROM discovery_jobs WHERE idempotency_key = 'test:ke'`));
  assert.deepEqual([job.status, job.attempts], ['failed', 2]);
});

test('a job left running by a killed pod is picked up again', async () => {
  await pool.query(
    `INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key, status, locked_by, locked_at, checkpoint, attempts)
     VALUES ('youtube', 'discover', $1, '{"pages": 2}', 'test:fr', 'running', 'dead-pod', now() - interval '2 hours', '{"page": 1, "pageToken": "1", "seen": 0, "added": 0}', 1)`, [ids.FR]);
  const yt = fakeYoutube({ search: { FR: [[], []] } });
  await runYoutubeAgent(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet });
  const { rows: [job] } = await pool.query(`SELECT status, result FROM discovery_jobs WHERE idempotency_key = 'test:fr'`);
  assert.equal(job.status, 'done');
  assert.equal(job.result.pages, 2);
  assert.deepEqual(yt.calls.filter((c) => c.kind === 'search').map((c) => c.params.pageToken), ['1'], 'resumed from the checkpoint');
});
