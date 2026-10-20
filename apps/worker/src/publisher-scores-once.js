const { getPool } = require('@nouvellesdupays/shared/src/db');
const { scorePublishers } = require('./publisher-scores');

scorePublishers(getPool())
  .then(({ scored }) => { console.log(`[publisher-scores-once] scored ${scored} publishers`); process.exit(0); })
  .catch((err) => { console.error('[publisher-scores-once]', err); process.exit(1); });
