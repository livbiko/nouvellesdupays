const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

// GET /api/rankings and GET /api/rankings/:platform (spec section 16).
// Verifies: empty lists when no audience_metrics, correct ordering, suspended
// publishers excluded, rejected social accounts excluded.
let app;
let fixtures;
let ytAccountId;

before(async () => {
  fixtures = await resetFixtures();
  const pool = getPool();
  await pool.query(`UPDATE publishers SET slug = 'test-pub-ci' WHERE id = $1`, [fixtures.publisherIds.pubCi]);

  // One verified YouTube account for the CI publisher (West Africa)
  const { rows: sa } = await pool.query(
    `INSERT INTO social_accounts (publisher_id, platform, url, handle, verification)
     VALUES ($1, 'youtube', 'https://www.youtube.com/@testci', 'testci', 'verified')
     RETURNING id`,
    [fixtures.publisherIds.pubCi]
  );
  ytAccountId = sa[0].id;

  // A rejected account — must not appear in rankings
  await pool.query(
    `INSERT INTO social_accounts (publisher_id, platform, url, verification)
     VALUES ($1, 'facebook', 'https://www.facebook.com/testci', 'rejected')`,
    [fixtures.publisherIds.pubCi]
  );

  // Audience metrics: two snapshots; ranking should use the LATEST
  await pool.query(
    `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
     VALUES ($1, 'subscribers', 900,  'youtube_data_api', now() - interval '3 days'),
            ($1, 'subscribers', 1500, 'youtube_data_api', now() - interval '1 hour'),
            ($1, 'total_views', 75000,'youtube_data_api', now() - interval '1 hour')`,
    [ytAccountId]
  );

  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('GET /api/rankings — shape and at least one entry in youtube_by_subscribers', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rankings' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.youtube_by_subscribers), 'youtube_by_subscribers is array');
  assert.ok(Array.isArray(body.youtube_by_views),       'youtube_by_views is array');
  assert.ok(Array.isArray(body.all_by_followers),       'all_by_followers is array');
  // Our CI publisher should appear (it has metrics and is in West Africa)
  assert.ok(body.youtube_by_subscribers.length > 0, 'at least one entry');
  const entry = body.youtube_by_subscribers[0];
  assert.equal(entry.metric_value, 1500, 'uses the latest snapshot (1500, not 900)');
  assert.equal(entry.metric_name,  'subscribers');
  assert.equal(entry.platform,     'youtube');
  assert.equal(entry.slug,         'test-pub-ci');
});

test('GET /api/rankings — rejected account not in all_by_followers', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rankings' });
  const body = JSON.parse(res.body);
  const hasFb = body.all_by_followers.some((e) => e.platform === 'facebook');
  assert.equal(hasFb, false, 'rejected facebook account must not appear');
});

test('GET /api/rankings/:platform — youtube', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rankings/youtube' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
  assert.equal(body[0].metric_value, 1500);
});

test('GET /api/rankings/:platform — unknown platform → 404', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rankings/snapchat' });
  assert.equal(res.statusCode, 404);
});

test('GET /api/rankings — empty when no metrics exist (suspended publishers excluded)', async () => {
  const pool = getPool();
  // Suspend the publisher so it disappears from rankings
  await pool.query(`UPDATE publishers SET feed_status = 'suspended' WHERE id = $1`, [fixtures.publisherIds.pubCi]);
  const res = await app.inject({ method: 'GET', url: '/api/rankings' });
  const body = JSON.parse(res.body);
  assert.equal(body.youtube_by_subscribers.length, 0, 'suspended publisher not ranked');
  // Restore
  await pool.query(`UPDATE publishers SET feed_status = 'active' WHERE id = $1`, [fixtures.publisherIds.pubCi]);
});

test('GET /api/rankings/:platform — metric param total_views', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rankings/youtube?metric=total_views' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.length > 0);
  assert.equal(body[0].metric_name, 'total_views');
  assert.equal(body[0].metric_value, 75000);
});
