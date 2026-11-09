// Build #206 -- runs in a throwaway worker-image pod started by rotate.sh. Changes the app role's password over a
// connection made with FROM_URL, proves a NEW login works with the target password, and puts the old one back if it
// does not. The target is TO_PASSWORD (apply) or the password inside TO_URL (rollback). Postgres only ever receives
// a SCRAM-SHA-256 verifier, so even with DDL statement logging no plaintext password reaches the server log, and
// nothing secret is printed here.
const crypto = require('crypto');
const { Client } = require(require.resolve('pg', { paths: ['/app/apps/worker', '/app'] }));

function passwordOf(url) {
  return decodeURIComponent(new URL(url).password);
}
function withPassword(url, pw) {
  const u = new URL(url);
  u.password = encodeURIComponent(pw);
  return u.toString();
}
function scramVerifier(pw) {
  const salt = crypto.randomBytes(16);
  const iterations = 4096;
  const salted = crypto.pbkdf2Sync(Buffer.from(pw, 'utf8'), salt, iterations, 32, 'sha256');
  const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest();
  const storedKey = crypto.createHash('sha256').update(hmac(salted, 'Client Key')).digest();
  const serverKey = hmac(salted, 'Server Key');
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}
async function login(url) {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await c.connect();
  const { rows } = await c.query('SELECT current_user AS u');
  return { c, user: rows[0].u };
}

(async () => {
  const fromUrl = process.env.FROM_URL;
  const target = process.env.TO_PASSWORD || (process.env.TO_URL && passwordOf(process.env.TO_URL));
  if (!fromUrl || !target) throw new Error('FROM_URL and TO_PASSWORD/TO_URL are required');
  if (!/^[A-Za-z0-9_-]{16,}$/.test(target)) throw new Error('target password has unexpected characters or length');
  const { c: admin, user } = await login(fromUrl);
  console.log(`logged in as ${user} with the current password`);
  await admin.query(`ALTER ROLE CURRENT_USER PASSWORD '${scramVerifier(target)}'`);
  console.log('password changed (SCRAM verifier sent)');
  try {
    const { c, user: u2 } = await login(withPassword(fromUrl, target));
    await c.end();
    console.log(`new login OK as ${u2}`);
  } catch (err) {
    console.log(`NEW LOGIN FAILED (${err.message}) -- putting the previous password back`);
    await admin.query(`ALTER ROLE CURRENT_USER PASSWORD '${scramVerifier(passwordOf(fromUrl))}'`);
    const { c } = await login(fromUrl);
    await c.end();
    console.log('previous password restored and verified');
    process.exitCode = 1;
  }
  await admin.end();
})().catch((err) => {
  console.log(`ERROR ${err.message}`);
  process.exitCode = 1;
});
