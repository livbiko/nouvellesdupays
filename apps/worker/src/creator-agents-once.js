const { getPool } = require('@nouvellesdupays/shared/src/db');
const { planDiscovery, runYoutubeAgent } = require('./creator-agents');
const { collectRecentActivity, computeCreatorRankings } = require('./creator-rankings');

// One-shot job pod (k8s CronJob nouvellesdupays-creator-agents): the global agent plans, then the YouTube agent runs,
// then (Build #235) approved creators' recent-video numbers are collected with the quota left and the rankings are
// recomputed when due (daily, or when an approved creator changed). Paused agents return at once (they all start
// paused). A failing ranking step does not stop discovery but fails the pod so it shows. Exits without waiting on
// pool.end(), as poll-once.js.
(async () => {
  const pool = getPool();
  const plan = await planDiscovery(pool);
  if (plan.skipped) console.log(`global agent: ${plan.skipped}`);
  const yt = await runYoutubeAgent(pool);
  if (yt.skipped) console.log(`youtube agent: ${yt.skipped}`);
  let failed = yt.status === 'failed';
  try {
    const recent = await collectRecentActivity(pool);
    if (recent.skipped) console.log(`recent activity: ${recent.skipped}`);
    if (recent.status === 'failed') failed = true;
    const ranks = await computeCreatorRankings(pool);
    if (ranks.skipped) console.log(`rankings: ${ranks.skipped}`);
  } catch (err) {
    console.error('[creators/rankings]', err);
    failed = true;
  }
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
