const { Pool } = require('pg');
const { scorePublishers } = require('./publisher-scores');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
scorePublishers(pool)
  .then(({ scored }) => { console.log(`[publisher-scores-once] scored ${scored} publishers`); process.exit(0); })
  .catch((err) => { console.error('[publisher-scores-once]', err); process.exit(1); });
