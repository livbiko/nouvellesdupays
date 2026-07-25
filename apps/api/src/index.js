const Fastify = require('fastify');
const cors = require('@fastify/cors');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const routes = require('./routes');

const fastify = Fastify({ logger: true });
fastify.pg = getPool();

fastify.register(cors, { origin: true });
fastify.register(routes);

const port = parseInt(process.env.PORT, 10) || 4000;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
