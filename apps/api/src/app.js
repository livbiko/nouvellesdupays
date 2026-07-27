const Fastify = require('fastify');
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const routes = require('./routes');

const ALLOWED_ORIGINS = [
  'https://nouvellesdupays.com',
  'https://www.nouvellesdupays.com',
  'http://localhost:3000',
];

// Split out from index.js so tests can build a fully-configured instance
// via fastify.inject() without binding a real port (the standard Fastify
// testing pattern) -- index.js is the only thing that calls .listen().
function buildApp(opts = {}) {
  // trustProxy is required for rate-limit to key off the real client IP --
  // requests arrive via ingress-nginx (X-Forwarded-For), not directly.
  const fastify = Fastify({ logger: true, trustProxy: true, ...opts });
  fastify.pg = getPool();

  fastify.register(cors, {
    origin: (origin, cb) => {
      // No Origin header means a non-browser request (curl, server-to-server,
      // health checks) -- CORS only governs browser fetches, so allow those.
      // For disallowed browser origins, resolve `false` (not an Error): the
      // request still completes normally, just without an
      // Access-Control-Allow-Origin header, so the browser's own same-origin
      // policy blocks JS from reading the response. Passing an Error here
      // instead turns every disallowed-origin request into a 500, which is
      // both the wrong status code and unnecessarily breaks any non-browser
      // caller that happens to send an Origin header.
      cb(null, !origin || ALLOWED_ORIGINS.includes(origin));
    },
  });
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  fastify.register(routes);

  return fastify;
}

module.exports = { buildApp, ALLOWED_ORIGINS };
