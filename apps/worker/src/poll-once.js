const { pollAllFeeds } = require('./poll');
const { getPool } = require('@nouvellesdupays/shared/src/db');

pollAllFeeds()
  .then(async (results) => {
    const ok = results.filter((r) => r.ok).length;
    const inserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    console.log(`\nDone: ${ok}/${results.length} feeds ok, ${inserted} new articles total.`);
    await getPool().end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
