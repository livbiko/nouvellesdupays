const { getPool } = require('@nouvellesdupays/shared/src/db');
const { checkRobots } = require('./robots-check');

// One-shot job pod (k8s CronJob nouvellesdupays-robots-check). ROBOTS_DRY_RUN=1 reports without changing anything.
// Exits 1 when the run was refused (too many feeds would be turned off) so the job shows as failed.
checkRobots(getPool(), { dryRun: process.env.ROBOTS_DRY_RUN === '1' })
  .then((s) => process.exit(s.refused ? 1 : 0))
  .catch((err) => { console.error('[robots-check-once]', err); process.exit(1); });
