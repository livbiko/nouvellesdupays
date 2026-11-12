// Creator rankings (Build #235) against the test database with a fake YouTube API (no network, no key).
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { collectRecentActivity, computeCreatorRankings, scoreChannel, SCORE } = require('../src/creator-rankings');

const pool = getPool();
const quiet = () => {};
const NOW = new Date('2026-11-12T08:00:00Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000);
const UC = (n) => `UC${String(n).padStart(22, 'x')}`;
const ids = {};
const W = { popularity: 25, engagement: 25, content: 25, growth: 15, activity: 10 };

// Fake API: uploads per channel id ([videoId, daysAgo]), statistics per video id, records every call.
function fakeYoutube({ uploads = {}, videos = {}, missing = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const kind = u.pathname.split('/').pop();
    calls.push({ kind, params: Object.fromEntries(u.searchParams) });
    if (kind === 'playlistItems') {
      const ch = `UC${u.searchParams.get('playlistId').slice(2)}`;
      if (missing.includes(ch)) return { ok: false, status: 404, text: async () => '{"error": "playlistNotFound"}' };
      return { ok: true, json: async () => ({ items: (uploads[ch] || []).map(([id, d]) => ({ contentDetails: { videoId: id, videoPublishedAt: daysAgo(d).toISOString() } })) }) };
    }
    if (kind === 'videos') {
      return { ok: true, json: async () => ({ items: u.searchParams.get('id').split(',').filter((id) => videos[id]).map((id) => ({ id, statistics: videos[id] })) }) };
    }
    return { ok: true, json: async () => ({ items: [] }) };
  };
  return { calls, fetchImpl };
}

async function creator(slug, iso, { status = 'approved', minor = false, region = null, cats = [] } = {}) {
  const { rows: [c] } = await pool.query(
    `INSERT INTO creators (slug, display_name, country_id, region, review_status, possible_minor, confidence, approved_at)
     VALUES ($1, $1, $2, $3, $4, $5, 'HIGH_CONFIDENCE', now()) RETURNING id`, [slug, iso ? ids[iso] : null, region, status, minor]);
  for (const [i, cat] of cats.entries()) {
    await pool.query(`INSERT INTO creator_category_links (creator_id, category_id, is_primary)
                      SELECT $1, id, $3 FROM creator_categories WHERE slug = $2`, [c.id, cat, i === 0]);
  }
  return c.id;
}

async function account(creatorId, n, { verification = 'linked_from_site', status = 'active' } = {}) {
  const { rows: [a] } = await pool.query(
    `INSERT INTO social_accounts (creator_id, platform, url, platform_account_id, verification, status)
     VALUES ($1, 'youtube', $2, $3, $4, $5) RETURNING id`, [creatorId, `https://youtube.com/channel/${UC(n)}`, UC(n), verification, status]);
  return a.id;
}

const metric = (acc, name, value, at = NOW) =>
  pool.query(`INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at) VALUES ($1, $2, $3, 'youtube_data_api', $4)`,
    [acc, name, value, at]);

before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE articles, feeds, publishers, countries, publisher_submissions, discovery_jobs, agent_runs, creator_rankings RESTART IDENTITY CASCADE');
  const { rows } = await pool.query(
    `INSERT INTO countries (iso_code, name, region) VALUES ('SN', 'Senegal', 'West Africa'), ('KE', 'Kenya', 'East Africa'),
       ('FR', 'France', 'Western Europe') RETURNING id, iso_code`);
  for (const r of rows) ids[r.iso_code.trim()] = r.id;
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 8000 WHERE agent = 'youtube'`);

  ids.big = await creator('big-sn', 'SN', { cats: ['news-current-affairs', 'politics'] });
  ids.bigAcc = await account(ids.big, 1);
  ids.bigOld = await account(ids.big, 9); // a smaller second channel: not the one ranked
  ids.small = await creator('small-ke', 'KE', { cats: ['comedy'] });
  ids.smallAcc = await account(ids.small, 2);
  ids.regional = await creator('regional', null, { region: 'West Africa' });
  ids.regionalAcc = await account(ids.regional, 3);
  ids.fr = await creator('paris', 'FR');
  ids.frAcc = await account(ids.fr, 4);
  ids.empty = await creator('no-videos', 'SN');
  ids.emptyAcc = await account(ids.empty, 5);
  ids.candidate = await creator('candidate', 'SN', { status: 'candidate' });
  ids.candAcc = await account(ids.candidate, 6);
  ids.minor = await creator('minor', 'SN', { minor: true });
  ids.minorAcc = await account(ids.minor, 7);
  ids.rejAcc = await account(ids.small, 8, { verification: 'rejected' });

  await metric(ids.bigAcc, 'subscribers', 733000);
  await metric(ids.bigAcc, 'subscribers', 700000, daysAgo(30));
  await metric(ids.bigOld, 'subscribers', 1000);
  await metric(ids.smallAcc, 'subscribers', 5000);
  await metric(ids.regionalAcc, 'subscribers', 90000, daysAgo(10)); // recent enough to use, too recent for a growth base
  await metric(ids.frAcc, 'subscribers', 2000000, daysAgo(30)); // stale (> 14 days): not used
  await metric(ids.candAcc, 'subscribers', 9000000);
  await metric(ids.minorAcc, 'subscribers', 9000000);
});

after(async () => {
  await pool.end();
});

test('fixed scales: audience sizes are logarithmic, every score stays within 0-100', () => {
  assert.equal(Math.round(SCORE.popularity(10_000_000)), 100);
  assert.equal(Math.round(SCORE.popularity(9_999)), 57);
  assert.equal(SCORE.popularity(1e12), 100);
  assert.equal(Math.round(SCORE.content(1_000_000)), 100);
  assert.equal(SCORE.engagement(500), 50);
  assert.equal(SCORE.activity(30), 100);
  assert.equal(SCORE.activity(90), 100);
  assert.equal(SCORE.activity(0), 0);
  assert.equal(SCORE.growth(-5), 0);
  assert.equal(SCORE.growth(5), 50);
});

test('missing metrics are left out and the remaining weights rescaled; one metric alone gives no overall score', () => {
  const full = scoreChannel({ subscribers: 1e6, avg_recent_views: 1e4, engagement_rate_bp: 400, recent_uploads_30d: 30, growth_pct_30d: 10 }, W);
  assert.deepEqual(full.missing, []);
  const expected = (full.scores.popularity * 25 + full.scores.content * 25 + full.scores.engagement * 25 + 100 * 15 + 100 * 10) / 100;
  assert.ok(Math.abs(full.scores.overall - expected) < 0.01);

  const partial = scoreChannel({ subscribers: 1e6, recent_uploads_30d: 30 }, W);
  assert.deepEqual(partial.missing, ['engagement', 'content', 'growth']);
  const exp2 = (partial.scores.popularity * 25 + 100 * 10) / 35;
  assert.ok(Math.abs(partial.scores.overall - exp2) < 0.01, 'only popularity and activity weights count');

  const alone = scoreChannel({ subscribers: 1e6 }, W);
  assert.equal(alone.scores.overall, undefined);
  assert.ok(alone.scores.popularity > 0);
});

test('recent activity: approved creators only, uploads in 30 days, average and engagement of 2-90 day old videos', async () => {
  const yt = fakeYoutube({
    uploads: {
      [UC(1)]: [['v-new', 0.5], ['v1', 3], ['v2', 10], ['v3', 40], ['v-old', 200]],
      [UC(2)]: [['k1', 5]],
      [UC(3)]: [['r1', 100]],
    },
    videos: {
      v1: { viewCount: '1000', likeCount: '80', commentCount: '20' }, v2: { viewCount: '3000', likeCount: '100' },
      v3: { viewCount: '2000' }, // likes hidden: counts for views, not for engagement
      k1: { viewCount: '500', likeCount: '5', commentCount: '0' },
    },
    missing: [UC(5)],
  });
  const r = await collectRecentActivity(pool, { apiKey: 'secret-key', fetchImpl: yt.fetchImpl, log: quiet, now: NOW });
  assert.equal(r.status, 'ok');
  assert.equal(r.checked, 6, 'big (2 channels), small, regional, paris, no-videos; not the candidate, minor or rejected account');
  const asked = yt.calls.filter((c) => c.kind === 'playlistItems').map((c) => c.params.playlistId).sort();
  assert.ok(!asked.includes(`UU${UC(6).slice(2)}`) && !asked.includes(`UU${UC(7).slice(2)}`) && !asked.includes(`UU${UC(8).slice(2)}`));
  assert.equal(yt.calls.filter((c) => c.kind === 'videos').length, 1, 'sampled videos of all channels in one call');
  assert.equal(r.quota, 6 + 1);
  assert.ok(yt.calls.every((c) => c.params.key === 'secret-key'));

  const m = async (acc) => Object.fromEntries((await pool.query(
    `SELECT metric, value::int AS value, window_days FROM audience_metrics WHERE social_account_id = $1 AND metric IN ('recent_uploads_30d', 'avg_recent_views', 'engagement_rate_bp')`,
    [acc])).rows.map((x) => [x.metric, [x.value, x.window_days]]));
  assert.deepEqual(await m(ids.bigAcc), {
    recent_uploads_30d: [3, 30], // v-new, v1, v2
    avg_recent_views: [2000, 90], // v1 v2 v3 (v-new too young, v-old too old)
    engagement_rate_bp: [500, 90], // (100 + 100) / (1000 + 3000)
  });
  assert.deepEqual(await m(ids.regionalAcc), { recent_uploads_30d: [0, 30] }, 'only a 100-day-old video: no average, no engagement');
  assert.deepEqual(await m(ids.emptyAcc), { recent_uploads_30d: [0, 30] }, 'no uploads playlist: 0 uploads, no average invented');
  const { rows: [run] } = await pool.query(`SELECT status, quota_units, message FROM agent_runs WHERE agent = 'youtube'`);
  assert.equal(run.status, 'ok');
  assert.equal(run.quota_units, 7);

  // Checked less than 20 h ago: the next run asks nothing.
  const yt2 = fakeYoutube();
  assert.equal((await collectRecentActivity(pool, { apiKey: 'k', fetchImpl: yt2.fetchImpl, log: quiet, now: NOW })).checked, 0);
  assert.equal(yt2.calls.length, 0);
});

test('recent activity respects the paused agent and the 24 h budget', async () => {
  await pool.query(`UPDATE discovery_agents SET paused = true WHERE agent = 'youtube'`);
  assert.deepEqual(await collectRecentActivity(pool, { apiKey: 'k', fetchImpl: fakeYoutube().fetchImpl, log: quiet, now: daysAgo(-2) }), { skipped: 'paused' });
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 1 WHERE agent = 'youtube'`);
  // Due again 21 h later, but 1 unit is not enough for a channel (uploads + videos).
  const r = await collectRecentActivity(pool, { apiKey: 'k', fetchImpl: fakeYoutube().fetchImpl, log: quiet, now: new Date(NOW.getTime() + 21 * 3600000) });
  assert.match(r.skipped, /quota budget used/);
  await pool.query(`UPDATE discovery_agents SET daily_quota_units = 8000 WHERE agent = 'youtube'`);
});

test('rankings: approved creators only, per scope, overall from the available dimensions, growth over ~30 days', async () => {
  const r = await computeCreatorRankings(pool, { now: NOW, log: quiet });
  assert.equal(r.creators, 5, 'big, small, regional, no-videos, paris (only its upload count: its subscribers are stale)');
  const rows = (await pool.query(
    `SELECT scope, scope_key, dimension, creator_id, social_account_id, rank, score::float8 AS score, inputs FROM creator_rankings`)).rows;
  const find = (scope, key, dim, cid) => rows.find((x) => x.scope === scope && x.scope_key === key && x.dimension === dim && x.creator_id === cid);

  const g = find('global', '', 'overall', ids.big);
  assert.equal(g.rank, 1);
  assert.equal(g.social_account_id, ids.bigAcc, 'the creator\'s largest channel');
  assert.deepEqual(g.inputs.missing, []);
  assert.ok(Math.abs(g.inputs.metrics.growth_pct_30d - (33000 / 700000) * 100) < 0.01);
  assert.ok(find('country', 'SN', 'overall', ids.big));
  assert.ok(find('region', 'West Africa', 'overall', ids.big));
  assert.ok(find('africa', '', 'overall', ids.big));
  assert.ok(find('category', 'politics', 'popularity', ids.big));
  assert.ok(find('category', 'news-current-affairs', 'overall', ids.big));

  const reg = find('region', 'West Africa', 'popularity', ids.regional);
  assert.ok(reg, 'a creator without a country is ranked in its region');
  assert.equal(rows.filter((x) => x.creator_id === ids.regional && x.scope === 'country').length, 0);
  assert.equal(find('global', '', 'growth', ids.regional), undefined, 'no snapshot 25-40 days old: growth unavailable, not zero');

  assert.equal(find('country', 'KE', 'overall', ids.small).rank, 1);
  assert.equal(find('global', '', 'popularity', ids.small).rank, 3, 'big 733k, regional 90k, small 5k');

  const paris = rows.filter((x) => x.creator_id === ids.fr);
  assert.deepEqual([...new Set(paris.map((x) => x.dimension))], ['activity'], 'stale subscribers not used');
  assert.equal(paris.some((x) => x.scope === 'africa'), false, 'Europe is not in the Africa ranking');
  for (const cid of [ids.candidate, ids.minor]) assert.equal(rows.filter((x) => x.creator_id === cid).length, 0);
});

test('rankings are recomputed only when due: daily, or when an approved creator changed', async () => {
  // Fixtures were stamped with the database clock; put them before the test clock's last run, whatever the time of day.
  await pool.query(`UPDATE creators SET updated_at = $1`, [new Date(NOW.getTime() - 3600000)]);
  assert.deepEqual(await computeCreatorRankings(pool, { now: new Date(NOW.getTime() + 3600000), log: quiet }), { skipped: 'up to date' });
  await pool.query(`UPDATE creators SET review_status = 'rejected', updated_at = $2 WHERE id = $1`, [ids.small, new Date(NOW.getTime() + 2 * 3600000)]);
  const later = new Date(NOW.getTime() + 3 * 3600000);
  const r = await computeCreatorRankings(pool, { now: later, log: quiet });
  assert.equal(r.creators, 4);
  const { rows } = await pool.query(`SELECT DISTINCT creator_id FROM creator_rankings WHERE computed_at = $1`, [later]);
  assert.ok(!rows.some((x) => x.creator_id === ids.small), 'a rejected creator leaves the next ranking');
  const { rows: [{ n }] } = await pool.query(`SELECT count(DISTINCT computed_at)::int AS n FROM creator_rankings`);
  assert.equal(n, 2, 'history kept: earlier computation not overwritten');
});
