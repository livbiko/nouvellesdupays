const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
let fixtures;
let auth;
const ids = {};

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  auth = { authorization: `Bearer ${login.json().token}` };

  // What the worker leaves behind after a check (see apps/worker/test/discover.test.js).
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO discovered_sources (name, homepage_url, domain, country_id, language, status, health, feed_url, feed_type, item_count,
       score, discovery_method, discovered_from, facebook_url)
     VALUES
       ('Good News CI', 'https://www.goodnews.ci/', 'goodnews.ci', $1, 'fr', 'under_review', 'ok', 'https://www.goodnews.ci/feed/', 'rss', 12, 85, 'outlink', 'https://example.com/ci', 'https://facebook.com/GoodNewsCI'),
       ('No Feed', 'https://nofeed.ci/', 'nofeed.ci', $1, NULL, 'under_review', 'ok', NULL, 'sitemap', NULL, 40, 'outlink', NULL, NULL),
       ('Casino', 'https://hijacked.ci/', 'hijacked.ci', $1, 'fr', 'under_review', 'spam_suspect', NULL, NULL, NULL, 0, 'outlink', NULL, NULL),
       ('Naija', 'https://naija.ng/', 'naija.ng', $2, 'en', 'discovered', 'unchecked', NULL, NULL, NULL, NULL, 'outlink', NULL, NULL)
     RETURNING id, domain`,
    [fixtures.countryIds.ci, fixtures.countryIds.ng]
  );
  for (const r of rows) ids[r.domain] = r.id;
  await pool.query(
    `INSERT INTO source_scores (discovered_source_id, total_score, score_breakdown, score_band) VALUES ($1, 85, '{"feed":20}', 'priority')`,
    [ids['goodnews.ci']]
  );
});

after(async () => {
  await app.close();
  await getPool().end();
});

const get = (url) => app.inject({ method: 'GET', url, headers: auth });
const post = (url, payload) => app.inject({ method: 'POST', url, headers: auth, payload });
const patch = (url, payload) => app.inject({ method: 'PATCH', url, headers: auth, payload });

test('discovery routes need an admin token', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/discovered-sources' });
  assert.equal(res.statusCode, 401);
});

test('list: best score first, latest score breakdown attached, filters work', async () => {
  const all = (await get('/api/admin/discovered-sources')).json();
  assert.equal(all.length, 4);
  assert.equal(all[0].domain, 'goodnews.ci');
  assert.deepEqual(all[0].score_breakdown, { feed: 20 });
  assert.equal(all[0].iso_code, 'CI');
  assert.equal((await get('/api/admin/discovered-sources?country=ng')).json().length, 1);
  assert.equal((await get('/api/admin/discovered-sources?has_feed=true')).json().length, 1);
  assert.equal((await get('/api/admin/discovered-sources?health=spam_suspect')).json().length, 1);
  assert.equal((await get('/api/admin/discovered-sources?status=open')).json().length, 4);
  assert.equal((await get('/api/admin/discovered-sources?status=bogus')).statusCode, 400);
});

test('summary: per-country coverage for the region', async () => {
  const body = (await get('/api/admin/discovered-sources/summary?region=West%20Africa')).json();
  const ci = body.countries.find((c) => c.iso_code === 'CI');
  assert.equal(ci.live_publishers, 1);
  assert.equal(ci.to_review, 3);
  assert.equal(ci.to_review_with_feed, 1);
  assert.equal(body.totals.candidates, 4);
  assert.equal(body.totals.with_feed, 1);
});

test('manual add: normalised, and refused for known publishers/candidates', async () => {
  const ok = await post('/api/admin/discovered-sources', { url: 'https://www.newsite.ci/some/page', country_iso: 'ci' });
  assert.equal(ok.statusCode, 200);
  const { rows: [row] } = await getPool().query('SELECT * FROM discovered_sources WHERE id = $1', [ok.json().id]);
  assert.equal(row.domain, 'newsite.ci');
  assert.equal(row.homepage_url, 'https://www.newsite.ci/');
  assert.equal(row.discovery_method, 'manual');
  assert.equal((await post('/api/admin/discovered-sources', { url: 'https://goodnews.ci/' })).statusCode, 409);
  assert.equal((await post('/api/admin/discovered-sources', { url: 'https://example.com/anything' })).statusCode, 409, 'existing publisher domain');
  assert.equal((await post('/api/admin/discovered-sources', { url: 'http://192.168.1.1/' })).statusCode, 400);
});

test('edit: validated fields only', async () => {
  assert.equal((await patch(`/api/admin/discovered-sources/${ids['nofeed.ci']}`, { language: 'fr', editorial_orientation: 'independent' })).statusCode, 200);
  assert.equal((await patch(`/api/admin/discovered-sources/${ids['nofeed.ci']}`, { status: 'verified' })).statusCode, 400);
  assert.equal((await patch(`/api/admin/discovered-sources/${ids['nofeed.ci']}`, { editorial_orientation: 'pro-government' })).statusCode, 400);
  assert.equal((await patch(`/api/admin/discovered-sources/${ids['nofeed.ci']}`, { country_iso: 'ZZ' })).statusCode, 400);
});

test('promote with a feed: pending submission carrying the feed + socials, then the normal approve makes it live', async () => {
  const res = await post(`/api/admin/discovered-sources/${ids['goodnews.ci']}/promote`, {});
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.submission_status, 'pending');
  assert.equal(body.ingestion_method, 'feed');
  const { rows: [sub] } = await getPool().query('SELECT * FROM publisher_submissions WHERE id = $1', [body.submission_id]);
  assert.equal(sub.feed_url, 'https://www.goodnews.ci/feed/');
  assert.equal(sub.feed_verified, true);
  assert.equal(sub.facebook_url, 'https://facebook.com/GoodNewsCI');
  assert.match(sub.verification_detail, /Discovery worker/);
  const { rows: [cand] } = await getPool().query('SELECT status, promoted_submission_id FROM discovered_sources WHERE id = $1', [ids['goodnews.ci']]);
  assert.equal(cand.status, 'verified');
  assert.equal(cand.promoted_submission_id, body.submission_id);

  assert.equal((await post(`/api/admin/discovered-sources/${ids['goodnews.ci']}/promote`, {})).statusCode, 409, 'only once');
  const approve = await post(`/api/admin/submissions/${body.submission_id}/approve`, {});
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().live, true);
});

test('promote without a feed: submitted for a crawled source', async () => {
  const res = await post(`/api/admin/discovered-sources/${ids['nofeed.ci']}/promote`, {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().submission_status, 'submitted');
  assert.equal(res.json().ingestion_method, 'html');
});

test('promote refuses spam suspects and candidates without a language', async () => {
  assert.equal((await post(`/api/admin/discovered-sources/${ids['hijacked.ci']}/promote`, {})).statusCode, 409);
  const { rows: [n] } = await getPool().query(
    `INSERT INTO discovered_sources (name, homepage_url, domain, country_id, status) VALUES ('X', 'https://nolang.ci/', 'nolang.ci', $1, 'under_review') RETURNING id`,
    [fixtures.countryIds.ci]
  );
  assert.equal((await post(`/api/admin/discovered-sources/${n.id}/promote`, {})).statusCode, 400);
});

test('reject and re-check', async () => {
  assert.equal((await patch(`/api/admin/discovered-sources/${ids['naija.ng']}`, { status: 'rejected', notes: 'duplicate brand' })).statusCode, 200);
  assert.equal((await post(`/api/admin/discovered-sources/${ids['naija.ng']}/recheck`, {})).statusCode, 200);
  const { rows: [n] } = await getPool().query('SELECT status, next_check_at FROM discovered_sources WHERE id = $1', [ids['naija.ng']]);
  assert.equal(n.status, 'discovered');
  assert.ok(n.next_check_at);
  assert.equal((await post(`/api/admin/discovered-sources/${ids['goodnews.ci']}/recheck`, {})).statusCode, 404, 'promoted ones are not re-queued');
});
