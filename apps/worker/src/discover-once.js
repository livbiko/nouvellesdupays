const { getPool } = require('@nouvellesdupays/shared/src/db');
const { runDiscovery } = require('./discover');

// One-shot job pod (k8s CronJob nouvellesdupays-discovery): exits as soon as
// the run is done, without waiting on pool.end() -- same reasoning as
// poll-once.js.
runDiscovery(getPool())
  .then(({ known, mined, checked, dryRun }) => {
    if (dryRun) {
      console.log(`\nDry run: would mine ${mined.mined} publisher homepages and check ${checked.checked} candidates; nothing fetched or written.`);
      process.exit(0);
    }
    console.log(`\nDone: ${known} already-publisher candidates closed, mined ${mined.mined} publisher homepages (${mined.added} new candidates), checked ${checked.checked} candidates ${JSON.stringify(checked.results)}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
