const { buildApp } = require('./app');

const fastify = buildApp();
const port = parseInt(process.env.PORT, 10) || 4000;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
