// Kept in its own file/app instance so its 100+ requests don't push the
// shared app instance in routes.test.js into 429s and break unrelated tests.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;

before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('rate limit: allows up to the configured max, then returns 429', async () => {
  let lastStatus;
  for (let i = 0; i < 100; i++) {
    const res = await app.inject({ method: 'GET', url: '/health' });
    lastStatus = res.statusCode;
  }
  assert.equal(lastStatus, 200, 'the 100th request within the window should still succeed');

  const overLimit = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(overLimit.statusCode, 429);
});
