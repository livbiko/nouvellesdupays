// Build #249: a creator linked to the news publisher it also is. Its own file, so its own app and rate-limit window
// (creators-admin.test.js is close to the 100 requests a minute limit).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
let fixtures;
let auth;

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  auth = { authorization: `Bearer ${login.json().token}` };
});

after(async () => {
  await app.close();
  await getPool().end();
});

const get = (url) => app.inject({ method: 'GET', url, headers: auth });
const post = (url, payload) => app.inject({ method: 'POST', url, headers: auth, payload });
const patch = (url, payload) => app.inject({ method: 'PATCH', url, headers: auth, payload });

test('a creator can be linked to the news publisher it also is (Build #249)', async () => {
  const res0 = await post('/api/admin/creators', { display_name: 'Test Publisher CI Videos', country_iso: 'CI', categories: ['politics'] });
  assert.equal(res0.statusCode, 200, res0.body);
  const url = `/api/admin/creators/${res0.json().id}`;
  const acc = await post(`${url}/accounts`, { platform: 'youtube', url: 'https://www.youtube.com/@TestPublisherCIVideos',
    evidence_kind: 'reviewer', note: 'same newsroom, checked 11-13' });
  assert.equal(acc.statusCode, 200, acc.body);

  for (const publisher_id of [0, 'x', 1.5, 99999999]) {
    assert.equal((await patch(url, { publisher_id })).statusCode, 400, String(publisher_id));
  }
  const pubId = fixtures.publisherIds.pubCi;
  let res = await patch(url, { publisher_id: pubId, confidence: 'PROVISIONAL', review_status: 'approved' });
  assert.equal(res.statusCode, 200, res.body);
  const c = (await get(url)).json();
  assert.deepEqual([c.publisher_id, c.publisher_name], [pubId, 'Test Publisher CI']);

  const { rows: [pub] } = await getPool().query('SELECT slug FROM publishers WHERE id = $1', [pubId]);
  let p = (await app.inject({ method: 'GET', url: `/api/creators/${c.slug}` })).json();
  assert.deepEqual([p.publisher_slug, p.publisher_name], [pub.slug, 'Test Publisher CI']);

  assert.equal((await patch(url, { display_name: 'Test Publisher CI Videos' })).statusCode, 200);
  assert.equal((await get(url)).json().publisher_id, pubId, 'a PATCH without publisher_id keeps the link');
  assert.equal((await patch(url, { publisher_id: null })).statusCode, 200);
  p = (await app.inject({ method: 'GET', url: `/api/creators/${c.slug}` })).json();
  assert.equal(p.publisher_slug, null, 'null clears the link');
});
