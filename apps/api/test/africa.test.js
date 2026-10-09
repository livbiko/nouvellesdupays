const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;

before(async () => {
  const fixtures = await resetFixtures();
  // A future-dated row (local time labelled UTC) must not count as "latest".
  await getPool().query(
    `INSERT INTO articles (feed_id, publisher_id, country_id, headline, original_url, category, published_at, dedup_hash)
     SELECT f.id, f.publisher_id, $1, 'Future CI', 'https://example.com/ci/future', 'other', now() + interval '3 hours', 'ci-future'
     FROM feeds f WHERE f.publisher_id = $2`,
    [fixtures.countryIds.ci, fixtures.publisherIds.pubCi]
  );
  await getPool().query(
    `INSERT INTO countries (iso_code, name, region) VALUES ('KE', 'Kenya', 'East Africa'), ('FR', 'France', 'Western Europe')`
  );
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('GET /api/africa/summary: the five African regions in order, with per-country counts', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/africa/summary' });
  assert.equal(res.statusCode, 200);
  const { regions } = res.json();
  assert.deepEqual(regions.map((r) => r.region), ['West Africa', 'East Africa', 'Central Africa', 'North Africa', 'Southern Africa']);
  const west = regions[0].countries;
  assert.deepEqual(west.map((c) => c.iso_code), ['CI', 'NG']);
  const ci = west[0];
  assert.equal(ci.publishers, 1);
  assert.equal(ci.articles_24h, 2, 'future-dated row not counted');
  assert.ok(new Date(ci.latest_at) <= new Date(), 'latest_at never in the future');
  assert.equal(ci.national_tv, 0);
  assert.equal(regions[1].countries[0].iso_code, 'KE');
  assert.equal(regions[1].countries[0].publishers, 0);
  assert.ok(!JSON.stringify(regions).includes('"FR"'), 'non-African countries excluded');
});

test('GET /api/africa/regions/:region/articles: one per publisher, newest first, no future dates', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/africa/regions/west%20africa/articles' });
  assert.equal(res.statusCode, 200);
  const rows = res.json();
  assert.equal(rows.length, 2, 'one row per publisher (CI, NG)');
  assert.deepEqual(rows.map((r) => r.headline).sort(), ['CI Article One', 'NG Article One']);
  assert.ok(rows.every((r) => r.country_iso && r.country_name));
  assert.ok(rows.every((r) => new Date(r.published_at) <= new Date()));
});

test('GET /api/africa/regions/:region/articles: unknown or non-African region is a 404', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/africa/regions/Western%20Europe/articles' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/api/africa/regions/nowhere/articles' })).statusCode, 404);
});
