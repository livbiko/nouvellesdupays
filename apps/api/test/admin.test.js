const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
let fixtures;
let adminToken;

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();

  const login = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { password: 'test-admin-password' },
  });
  adminToken = login.json().token;
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('POST /api/admin/login rejects a wrong password', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { password: 'not-the-password' },
  });
  assert.equal(res.statusCode, 401);
});

test('POST /api/admin/login returns a usable token for the right password', async () => {
  assert.ok(adminToken);
  assert.match(adminToken, /^[\w-]+\.[\w-]+$/);
});

test('admin routes reject requests with no token', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/submissions' });
  assert.equal(res.statusCode, 401);
});

test('admin routes reject a garbage token', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/submissions',
    headers: { authorization: 'Bearer not-a-real-token' },
  });
  assert.equal(res.statusCode, 401);
});

test('GET /api/admin/submissions returns the pending fixture with a valid token', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/submissions',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].id, fixtures.submissionIds.pending);
  assert.equal(body[0].status, 'pending');
});

test('POST /api/admin/submissions/:id/approve creates a publisher+feed and marks approved', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/admin/submissions/${fixtures.submissionIds.pending}/approve`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.status, 'approved');
  assert.ok(body.publisher_id);

  const pool = getPool();
  const { rows: pubRows } = await pool.query('SELECT * FROM publishers WHERE id = $1', [body.publisher_id]);
  assert.equal(pubRows[0].name, 'Pending Test Submission');
  assert.equal(pubRows[0].feed_status, 'active');

  const { rows: feedRows } = await pool.query('SELECT * FROM feeds WHERE publisher_id = $1', [body.publisher_id]);
  assert.equal(feedRows.length, 1);
  assert.equal(feedRows[0].feed_url, 'https://example.com/pending/feed');

  const { rows: subRows } = await pool.query('SELECT status FROM publisher_submissions WHERE id = $1', [fixtures.submissionIds.pending]);
  assert.equal(subRows[0].status, 'approved');
});

test('approving an already-approved submission returns 404 (not double-applied)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: `/api/admin/submissions/${fixtures.submissionIds.pending}/approve`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.statusCode, 404);
});

test('GET /api/admin/publishers lists publishers with source_type/license fields', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/publishers',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const testPub = body.find((p) => p.name === 'Test Publisher CI');
  assert.ok(testPub);
  assert.equal(testPub.source_type, 'OTHER'); // default from the migration
  assert.equal(testPub.license_status, 'unclear');
});

test('PATCH /api/admin/publishers/:id updates allowed fields only', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/admin/publishers/${fixtures.publisherIds.pubCi}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { source_type: 'NEWSPAPER', not_a_real_field: 'ignored' },
  });
  assert.equal(res.statusCode, 200);

  const pool = getPool();
  const { rows } = await pool.query('SELECT source_type FROM publishers WHERE id = $1', [fixtures.publisherIds.pubCi]);
  assert.equal(rows[0].source_type, 'NEWSPAPER');
});

test('PATCH /api/admin/publishers/:id rejects an invalid source_type via the CHECK constraint', async () => {
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/admin/publishers/${fixtures.publisherIds.pubNg}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { source_type: 'NOT_A_REAL_TYPE' },
  });
  assert.equal(res.statusCode, 500); // DB CHECK violation surfaces as a 500 -- Fastify's default error handling, no custom mapping added for this yet
});

test('GET /api/admin/discovered-sources returns an empty list (nothing discovered yet)', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/admin/discovered-sources',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), []);
});
