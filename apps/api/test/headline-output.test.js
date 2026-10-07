// Articles stored before ingestion-time cleanup still carry raw feed titles
// ("teachers&#39; strike", leading newlines); the public API cleans them on
// output so no bulk rewrite of the articles table is needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app, articleId;

before(async () => {
  await resetFixtures();
  const pool = getPool();
  const { rows: [f] } = await pool.query(
    `SELECT f.id AS feed_id, p.id AS publisher_id, p.country_id FROM feeds f
     JOIN publishers p ON p.id = f.publisher_id JOIN countries c ON c.id = p.country_id
     WHERE c.iso_code = 'NG' LIMIT 1`
  );
  const { rows: [a] } = await pool.query(
    `INSERT INTO articles (feed_id, publisher_id, country_id, headline, original_url, category, published_at, dedup_hash)
     VALUES ($1, $2, $3, $4, 'https://example.com/ng/dirty', 'politics', now(), 'dirty-headline-test')
     RETURNING id`,
    [f.feed_id, f.publisher_id, f.country_id, "\n        Government to act if teachers&#39; strike continues  "]
  );
  articleId = a.id;
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

const CLEAN = "Government to act if teachers' strike continues";

test('country articles list returns the cleaned headline', async () => {
  const rows = (await app.inject({ method: 'GET', url: '/api/countries/NG/articles?limit=100' })).json();
  assert.equal(rows.find((r) => r.id === articleId).headline, CLEAN);
});

test('distinct-publisher list and article detail return the cleaned headline', async () => {
  const rows = (await app.inject({ method: 'GET', url: '/api/countries/NG/articles?distinct_publisher=1' })).json();
  assert.ok(rows.every((r) => r.headline === r.headline.trim() && !/&#\d+;/.test(r.headline)));
  const one = (await app.inject({ method: 'GET', url: `/api/articles/${articleId}` })).json();
  assert.equal(one.headline, CLEAN);
});
