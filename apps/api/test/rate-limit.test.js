// CR-2026-11-18-05: server-side rendering calls from the cluster pod network are not rate limited; anything that came
// through the ingress (X-Forwarded-For) still is. (DATABASE_URL must point at nouvellesdupays_test)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp, isInClusterCall } = require('../src/app');

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
  const app = buildApp({ logger: false });
  await app.ready();
  try {
    const run = async (headers) => {
      let last;
      for (let i = 0; i < 101; i += 1) last = await app.inject({ method: 'GET', url: '/api/countries', remoteAddress: '10.42.0.145', headers });
      return last.statusCode;
    };
    assert.equal(await run({}), 200, 'in-cluster rendering calls are not limited');
    assert.equal(await run({ 'x-forwarded-for': '203.0.113.7' }), 429, 'a visitor through the ingress is still limited');
  } finally {
    await app.close();
  }
});
