const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
let fixtures;

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('GET /health returns ok', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', db: 'connected' });
});

test('GET /api/countries returns the seeded countries', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const isoCodes = body.map((c) => c.iso_code).sort();
  assert.deepEqual(isoCodes, ['CI', 'NG']);
});

test('GET /api/countries/:iso returns the matching country', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci' }); // lowercase on purpose
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.iso_code, 'CI');
  assert.equal(body.name, "Côte d'Ivoire");
});

test('GET /api/countries/:iso returns 404 for an unknown country', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/zz' });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.json(), { error: 'country not found' });
});

test('GET /api/countries/:iso/publishers returns publishers for that country', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci/publishers' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].name, 'Test Publisher CI');
});

test('GET /api/countries/:iso/articles returns that country\'s articles, newest first', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci/articles' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.length, 2);
  assert.equal(body[0].headline, 'CI Article One'); // published 1h ago, newer than the 2h-ago one
  assert.equal(body[1].headline, 'CI Article Two');
});

test('GET /api/countries/:iso/articles respects the limit parameter', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci/articles?limit=1' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().length, 1);
});

test('GET /api/countries/:iso/articles filters by category', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci/articles?category=sports' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].headline, 'CI Article Two');
});

test('GET /api/countries/:iso/articles caps limit at 100', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/ci/articles?limit=99999' });
  assert.equal(res.statusCode, 200);
  // With only 2 fixture rows this doesn't prove the cap directly, but confirms
  // an absurd limit doesn't error the request.
  assert.ok(res.json().length <= 100);
});

test('GET /api/articles/:id returns the matching article', async () => {
  const list = await app.inject({ method: 'GET', url: '/api/countries/ci/articles' });
  const id = list.json()[0].id;
  const res = await app.inject({ method: 'GET', url: `/api/articles/${id}` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().id, id);
});

test('GET /api/articles/:id returns 404 for an unknown id', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/articles/999999999' });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.json(), { error: 'article not found' });
});

test('CORS: allowed origin gets Access-Control-Allow-Origin', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/countries',
    headers: { origin: 'https://nouvellesdupays.com' },
  });
  assert.equal(res.headers['access-control-allow-origin'], 'https://nouvellesdupays.com');
});

test('CORS: disallowed origin gets a normal 200 with no ACAO header, not an error', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/countries',
    headers: { origin: 'https://evil-scraper.example.com' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('CORS: requests with no Origin header (curl, server-to-server) are unaffected', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries' });
  assert.equal(res.statusCode, 200);
});
