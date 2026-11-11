const { getPool } = require('@nouvellesdupays/shared/src/db');
const { planDiscovery, runYoutubeAgent } = require('./creator-agents');

// One-shot job pod (k8s CronJob nouvellesdupays-creator-agents): the global agent plans, then the YouTube agent runs.
// Both return at once while paused (they all start paused). Exits without waiting on pool.end(), as poll-once.js.
(async () => {
  const pool = getPool();
  const plan = await planDiscovery(pool);
  if (plan.skipped) console.log(`global agent: ${plan.skipped}`);
  const yt = await runYoutubeAgent(pool);
  if (yt.skipped) console.log(`youtube agent: ${yt.skipped}`);
  process.exit(yt.status === 'failed' ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
