// Kept in its own file/app instance so its 100+ requests don't push the
// shared app instance in routes.test.js into 429s and break unrelated tests.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, isInClusterCall } = require('../src/app');
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

// CR-2026-11-18-05: server-side rendering calls from the cluster pod network are not rate limited; anything that came
// through the ingress (X-Forwarded-For) still is.
const req = (remoteAddress, headers = {}) => ({ headers, socket: { remoteAddress } });

test('isInClusterCall: only pod-network sockets without a proxy header', () => {
  assert.equal(isInClusterCall(req('10.42.0.145')), true);
  assert.equal(isInClusterCall(req('::ffff:10.42.0.145')), true);
  assert.equal(isInClusterCall(req('10.42.0.145', { 'x-forwarded-for': '192.168.1.101' })), false);
  assert.equal(isInClusterCall(req('10.42.0.145', { 'x-real-ip': '1.2.3.4' })), false);
  assert.equal(isInClusterCall(req('192.168.1.101')), false);
  assert.equal(isInClusterCall(req('10.43.0.10')), false);
  assert.equal(isInClusterCall(req('110.42.0.1')), false);
  assert.equal(isInClusterCall(req(undefined)), false);
});

test('101 calls: in-cluster never refused, a proxied client gets 429', async () => {
  const run = async (headers) => {
    let last;
    for (let i = 0; i < 101; i += 1) last = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.42.0.145', headers });
    return last.statusCode;
  };
  assert.equal(await run({}), 200, 'in-cluster rendering calls are not limited');
  assert.equal(await run({ 'x-forwarded-for': '203.0.113.7' }), 429, 'a visitor through the ingress is still limited');
});
