const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
    });
    // An idle client that loses its connection (network blip, DB restart) is emitted here and already dropped by
    // the pool. Without a listener Node treats it as an unhandled 'error' event and exits: the API crashed this way
    // at 2026-11-10 19:00 UTC (read ETIMEDOUT). Only code and message are logged - the error carries the client,
    // whose connection parameters must not reach the logs.
    pool.on('error', (err) => {
      console.error(`[db] idle client error, connection dropped: ${err.code || ''} ${err.message}`);
    });
  }
  return pool;
}

module.exports = { getPool };
