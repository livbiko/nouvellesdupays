const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

// Public creator directory (Build #231): only approved creators, never a candidate, a rejected or merged one, or a
// possible minor. The TRUNCATE ... CASCADE in resetFixtures empties creators and their accounts through the
// countries foreign key.
let app;
let fixtures;
const ids = {};

async function creator(slug, name, { status = 'approved', minor = false, country = 'ci', kind = 'individual', region = null } = {}) {
  const pool = getPool();
  const countryId = country ? fixtures.countryIds[country] : null;
  const { rows: [c] } = await pool.query(
    `INSERT INTO creators (slug, display_name, country_id, region, languages, creator_kind, confidence, review_status,
                           possible_minor, reviewer_note, discovered_from, approved_at)
     VALUES ($1, $2, $3, $4, '{fr}', $5, 'HIGH_CONFIDENCE', $6, $7, 'private reviewer note', 'youtube search', now())
     RETURNING id`,
    [slug, name, countryId, region, kind, status, minor]
  );
  return c.id;
}

async function channel(creatorId, url, subscribers, { verification = 'linked_from_site', status = 'active' } = {}) {
  const pool = getPool();
  const { rows: [sa] } = await pool.query(
    `INSERT INTO social_accounts (creator_id, platform, url, verification, status) VALUES ($1, 'youtube', $2, $3, $4) RETURNING id`,
    [creatorId, url, verification, status]
  );
  if (subscribers != null) {
    await pool.query(
      `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
       VALUES ($1, 'subscribers', $2::bigint - 10, 'youtube_data_api', now() - interval '2 days'),
              ($1, 'subscribers', $2::bigint, 'youtube_data_api', now() - interval '1 hour'),
              ($1, 'total_views', $2::bigint * 100, 'youtube_data_api', now() - interval '1 hour')`,
      [sa.id, subscribers]
    );
  }
  return sa.id;
}

before(async () => {
  fixtures = await resetFixtures();
  const pool = getPool();
  const big = await creator('dakar-matin', 'Dakar Matin', { kind: 'media_brand' });
  const acc = await channel(big, 'https://youtube.com/channel/UCbig', 700000);
  await channel(big, 'https://youtube.com/channel/UCgone', 999999999, { status: 'dead' });
  await channel(big, 'https://youtube.com/channel/UCfake', 888888888, { verification: 'rejected' });
  await pool.query(
    `INSERT INTO creator_verifications (creator_id, social_account_id, evidence_kind, evidence_url, note, recorded_by)
     VALUES ($1, $2, 'official_website', 'https://dakarmatin.com/', 'private evidence note', 'build-230'),
            ($1, $2, 'name_match_only', NULL, NULL, 'agent')`,
    [big, acc]
  );
  const { rows: [cat] } = await pool.query(`SELECT id FROM creator_categories WHERE slug = 'news-current-affairs'`);
  await pool.query(`INSERT INTO creator_category_links (creator_id, category_id, is_primary) VALUES ($1, $2, true)`, [big, cat.id]);

  ids.big = big;
  ids.bigAcc = acc;
  ids.small = await creator('small-ng', 'Small Nigeria', { country: 'ng' });
  ids.smallAcc = await channel(ids.small, 'https://youtube.com/channel/UCsmall', 5000);
  await creator('no-numbers', 'No Numbers');
  await creator('regional', 'Regional Channel', { country: null, region: 'West Africa' });
  await creator('candidate-one', 'Candidate', { status: 'candidate' });
  await creator('rejected-one', 'Rejected', { status: 'rejected' });
  await creator('minor-one', 'Minor', { minor: true });

  // Two ranking computations: only the latest counts. The candidate has a stale row from before it was un-approved.
  const inputs = { used: ['popularity', 'activity'], missing: ['engagement', 'content', 'growth'], weights: { popularity: 25 }, metrics: { subscribers: 1 } };
  const cand = (await pool.query(`SELECT id FROM creators WHERE slug = 'candidate-one'`)).rows[0].id;
  const candAcc = await channel(cand, 'https://youtube.com/channel/UCcand', 9000000);
  for (const [at, rows] of [
    ['2026-11-11T00:00:00Z', [[ids.small, ids.smallAcc, 'global', '', 'overall', 1, 90]]],
    ['2026-11-12T00:00:00Z', [[ids.big, ids.bigAcc, 'global', '', 'overall', 2, 61.5], [ids.small, ids.smallAcc, 'global', '', 'overall', 3, 20],
      [cand, candAcc, 'global', '', 'overall', 1, 99], [ids.big, ids.bigAcc, 'country', 'CI', 'overall', 1, 61.5],
      [ids.big, ids.bigAcc, 'country', 'CI', 'popularity', 1, 84.1]]],
  ]) {
    for (const [cid, aid, scope, key, dim, rank, score] of rows) {
      await pool.query(
        `INSERT INTO creator_rankings (computed_at, platform, scope, scope_key, dimension, creator_id, social_account_id, rank, score, inputs)
         VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, $8, $9)`, [at, scope, key, dim, cid, aid, rank, score, inputs]);
    }
  }
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

const get = (url) => app.inject({ method: 'GET', url });

test('list: approved creators only, largest audience first, dead and rejected accounts ignored', async () => {
  const res = await get('/api/creators');
  assert.equal(res.statusCode, 200);
  const list = res.json();
  assert.deepEqual(list.map((c) => c.slug), ['dakar-matin', 'small-ng', 'no-numbers', 'regional']);
  assert.equal(list[0].subscribers, 700000);
  assert.equal(list[0].primary_category, 'Actualité');
  assert.equal(list[0].country_iso, 'CI');
  assert.equal(list[2].subscribers, null, 'no number is shown as missing, never guessed');
  assert.equal(list[3].region, 'West Africa');
  assert.equal(list[3].country_iso, null);
  for (const c of list) assert.equal(c.reviewer_note, undefined);
});

test('rankings: list ordered by the latest overall score; profile has its ranks with totals, never raw inputs', async () => {
  const list = (await get('/api/creators')).json();
  assert.deepEqual(list.map((c) => [c.slug, c.score, c.rank]),
    [['dakar-matin', 61.5, 2], ['small-ng', 20, 3], ['no-numbers', null, null], ['regional', null, null]],
    'the old 90 of small-ng is ignored; the candidate ranked 1st is never shown');
  const p = (await get('/api/creators/dakar-matin')).json();
  assert.deepEqual(p.rankings.map((r) => [r.scope, r.scope_key, r.dimension, r.rank, r.score, r.total]), [
    ['country', 'CI', 'overall', 1, 61.5, 1], ['country', 'CI', 'popularity', 1, 84.1, 1], ['global', '', 'overall', 2, 61.5, 3],
  ]);
  assert.deepEqual(p.ranking_inputs.missing, ['engagement', 'content', 'growth']);
  assert.equal(p.rankings[0].inputs, undefined);
  assert.equal(p.ranking_inputs.metrics, undefined);
  assert.deepEqual((await get('/api/creators/no-numbers')).json().rankings, []);
});

test('list filters: country and kind; bad values are refused', async () => {
  assert.deepEqual((await get('/api/creators?country=ng')).json().map((c) => c.slug), ['small-ng']);
  assert.deepEqual((await get('/api/creators?kind=media_brand')).json().map((c) => c.slug), ['dakar-matin']);
  assert.equal((await get('/api/creators?country=xyz')).statusCode, 400);
  assert.equal((await get('/api/creators?kind=bank')).statusCode, 400);
});

test('profile: channels with their latest numbers, public evidence kinds, no private fields', async () => {
  const res = await get('/api/creators/dakar-matin');
  assert.equal(res.statusCode, 200);
  const p = res.json();
  assert.equal(p.display_name, 'Dakar Matin');
  assert.equal(p.creator_kind, 'media_brand');
  assert.deepEqual(p.categories.map((c) => c.slug), ['news-current-affairs']);
  assert.deepEqual(p.accounts.map((a) => a.url), ['https://youtube.com/channel/UCbig']);
  const subs = p.accounts[0].audience.find((m) => m.metric === 'subscribers');
  assert.equal(subs.value, 700000);
  assert.deepEqual(p.evidence, ['official_website'], 'a name match is not shown as evidence');
  const body = res.body;
  for (const secret of ['private reviewer note', 'private evidence note', 'youtube search', '"id"']) {
    assert.ok(!body.includes(secret), `profile leaks ${secret}`);
  }
});

test('profile: candidates, rejected creators, possible minors and unknown slugs answer 404', async () => {
  for (const slug of ['candidate-one', 'rejected-one', 'minor-one', 'nobody', 'Bad Slug!']) {
    assert.equal((await get(`/api/creators/${encodeURIComponent(slug)}`)).statusCode, 404, slug);
  }
});
