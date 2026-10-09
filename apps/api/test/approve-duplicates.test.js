const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

// Approval used to merge a submission into an existing same-named publisher
// (ON CONFLICT DO UPDATE homepage_url): beninintelligent.bj took over the
// beninintelligent.com publisher on 2026-10-09. A duplicate must now stop the
// approval and change nothing.
let app;
let auth;
let fixtures;
const pool = () => getPool();

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  auth = { authorization: `Bearer ${login.json().token}` };
  await pool().query(
    `INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language)
     VALUES ($1, 'Plain Site', 'https://plainsite.ng/', 'plainsite.ng', 'active', 'en')`,
    [fixtures.countryIds.ng]
  );
});

after(async () => {
  await app.close();
  await getPool().end();
});

async function submission({ name, homepage, feed, country = fixtures.countryIds.ci }) {
  const { rows } = await pool().query(
    `INSERT INTO publisher_submissions (name, homepage_url, feed_url, feed_type, country_id, language, feed_verified, status)
     VALUES ($1, $2, $3, 'rss', $4, 'fr', true, 'pending') RETURNING id`,
    [name, homepage, feed, country]
  );
  return rows[0].id;
}

const approve = (id) => app.inject({ method: 'POST', url: `/api/admin/submissions/${id}/approve`, headers: auth, payload: {} });
const snapshot = async () => (await pool().query(
  `SELECT (SELECT string_agg(id || name || homepage_url, ',' ORDER BY id) FROM publishers) AS pubs,
          (SELECT string_agg(id || feed_url, ',' ORDER BY id) FROM feeds) AS feeds`
)).rows[0];

async function expectDuplicate(id, kind) {
  const before = await snapshot();
  const res = await approve(id);
  assert.equal(res.statusCode, 409, res.body);
  assert.equal(res.json().conflict.kind, kind);
  assert.match(res.json().error, /Doublon/);
  assert.deepEqual(await snapshot(), before, 'publishers and feeds unchanged');
  const { rows: [s] } = await pool().query('SELECT status, publisher_id FROM publisher_submissions WHERE id = $1', [id]);
  assert.equal(s.status, 'pending', 'submission left for the admin');
  assert.equal(s.publisher_id, null);
}

test('same name in the same country: refused, the existing publisher keeps its homepage', async () => {
  const id = await submission({ name: 'test publisher ci', homepage: 'https://other-site.ci/', feed: 'https://other-site.ci/feed' });
  await expectDuplicate(id, 'name');
  const { rows: [p] } = await pool().query(`SELECT homepage_url FROM publishers WHERE name = 'Test Publisher CI'`);
  assert.equal(p.homepage_url, 'https://example.com/ci');
});

test('same site under another name (www. and path ignored): refused', async () => {
  const id = await submission({ name: 'Plain Site Weekly', homepage: 'https://www.plainsite.ng/news/', feed: 'https://www.plainsite.ng/news/feed' });
  await expectDuplicate(id, 'domain');
});

test('same feed as an existing publisher: refused (it used to approve with no feed attached)', async () => {
  const id = await submission({ name: 'Copycat', homepage: 'https://copycat.ci/', feed: 'https://example.com/ci/feed' });
  await expectDuplicate(id, 'feed');
});

test('a genuinely new outlet still approves and goes live', async () => {
  const id = await submission({ name: 'Brand New Daily', homepage: 'https://brandnew.ci/', feed: 'https://brandnew.ci/feed' });
  const res = await approve(id);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().live, true);
  const { rows: [p] } = await pool().query('SELECT name, feed_status, domain FROM publishers WHERE id = $1', [res.json().publisher_id]);
  assert.deepEqual(p, { name: 'Brand New Daily', feed_status: 'active', domain: 'brandnew.ci' });
});
