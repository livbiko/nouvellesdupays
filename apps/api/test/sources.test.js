const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

// /api/sources (migration 016). The fixture publishers get slugs here; the TRUNCATE in resetFixtures
// cascades to social_accounts and audience_metrics through their foreign keys.
let app;
let fixtures;

before(async () => {
  fixtures = await resetFixtures();
  const pool = getPool();
  await pool.query(`UPDATE publishers SET slug = 'test-publisher-ci' WHERE id = $1`, [fixtures.publisherIds.pubCi]);
  await pool.query(`UPDATE publishers SET slug = 'test-publisher-ng', feed_status = 'suspended' WHERE id = $1`, [fixtures.publisherIds.pubNg]);
  const { rows } = await pool.query(
    `INSERT INTO social_accounts (publisher_id, platform, url, verification)
     VALUES ($1, 'youtube', 'https://www.youtube.com/@testci', 'verified'),
            ($1, 'facebook', 'https://www.facebook.com/testci', 'unverified'),
            ($1, 'x', 'https://x.com/testci', 'rejected')
     RETURNING id, platform`,
    [fixtures.publisherIds.pubCi]
  );
  const yt = rows.find((r) => r.platform === 'youtube').id;
  await pool.query(
    `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
     VALUES ($1, 'subscribers', 1000, 'youtube_data_api', now() - interval '2 days'),
            ($1, 'subscribers', 1200, 'youtube_data_api', now() - interval '1 hour'),
            ($1, 'total_views', 50000, 'youtube_data_api', now() - interval '1 hour')`,
    [yt]
  );
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('GET /api/sources/:slug: organisation, feeds, accounts with latest audience, articles', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/sources/test-publisher-ci' });
  assert.equal(res.statusCode, 200);
  const s = res.json();
  assert.equal(s.name, 'Test Publisher CI');
  assert.equal(s.country_iso, 'CI');
  assert.equal(s.creator_kind, 'organisation');
  assert.equal(s.feeds.length, 1);
  assert.deepEqual(s.social_accounts.map((a) => a.platform), ['youtube', 'facebook'], 'rejected account hidden, platform order kept');
  const yt = s.social_accounts[0];
  assert.deepEqual(yt.audience.map((m) => [m.metric, Number(m.value)]).sort(), [['subscribers', 1200], ['total_views', 50000]], 'latest value per metric only');
  assert.deepEqual(s.social_accounts[1].audience, [], 'no figures -> empty, never estimated');
  assert.deepEqual(s.articles.map((a) => a.headline), ['CI Article One', 'CI Article Two'], 'newest first');
});

test('GET /api/sources/:slug: suspended, unknown and malformed slugs are 404', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/sources/test-publisher-ng' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/sources/nope' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/sources/Bad%20Slug!' })).statusCode, 404);
});

test('GET /api/sources: slugs of active/pending publishers only', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/sources' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().map((s) => s.slug), ['test-publisher-ci']);
});

test('GET /api/countries/:iso/publishers: carries the slug for the source link', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/CI/publishers' });
  assert.equal(res.json()[0].slug, 'test-publisher-ci');
});
