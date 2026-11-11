const { test } = require('node:test');
const assert = require('node:assert');
const { getPool } = require('../src/db');

test('an idle-client error is logged, not thrown', async () => {
  const pool = getPool();
  const logged = [];
  const orig = console.error;
  console.error = (msg) => logged.push(msg);
  try {
    const err = Object.assign(new Error('read ETIMEDOUT'), { code: 'ETIMEDOUT' });
    assert.doesNotThrow(() => pool.emit('error', err, { connectionParameters: { password: 'secret' } }));
  } finally {
    console.error = orig;
  }
  assert.strictEqual(logged.length, 1);
  assert.match(logged[0], /ETIMEDOUT read ETIMEDOUT/);
  assert.doesNotMatch(logged[0], /secret/);
  await pool.end();
});
