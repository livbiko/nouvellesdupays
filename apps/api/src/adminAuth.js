// Minimal admin auth for the new admin panel (replaces the kubectl-exec-only
// moderation flow for publisher_submissions). Deliberately dependency-free
// (Node's built-in crypto covers both password hashing and token signing)
// rather than pulling in bcrypt/jsonwebtoken -- this project has stayed
// lean on dependencies everywhere else (see publisherRegistration.js's own
// hand-rolled <link> tag parsing rather than an HTML parser lib).
//
// This is intentionally NOT a multi-user/RBAC system -- there is exactly
// one admin credential (ADMIN_PASSWORD_HASH), matching the single-operator
// reality of this project today. Revisit if/when there's more than one
// admin.
const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h -- long enough for a moderation session, short enough that a leaked token doesn't stay valid indefinitely.

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = (storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  // Lengths must match before timingSafeEqual (it throws on mismatched
  // lengths rather than returning false) -- a malformed/truncated stored
  // hash should fail closed, not crash the request.
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

// Signed, stateless token: base64url(payload).base64url(hmac) -- no
// session store needed, matching this project's no-queue/no-Redis
// philosophy elsewhere. Payload just carries an expiry; there's only one
// admin, so no subject/role claims are needed.
function createToken(secret) {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const payloadB64 = base64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(sig || '');
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  return typeof payload.exp === 'number' && payload.exp > Date.now();
}

// Fastify preHandler -- attach to any admin route. Reads
// ADMIN_TOKEN_SECRET from the environment at call time (not module load)
// so tests can set it per-run via test-support/env.js.
function requireAdmin(req, reply, done) {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!secret || !verifyToken(token, secret)) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken, requireAdmin };
