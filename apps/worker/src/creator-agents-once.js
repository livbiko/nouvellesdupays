const { getPool } = require('@nouvellesdupays/shared/src/db');
const { planDiscovery, runYoutubeAgent } = require('./creator-agents');
const { collectRecentActivity, computeCreatorRankings } = require('./creator-rankings');
const { refreshChannelLogos } = require('./channel-logos');

// One-shot job pod (k8s CronJob nouvellesdupays-creator-agents): the global agent plans, approved creators' recent-video
// numbers are collected first (Build #259; discovery leaves RECENT_ACTIVITY_RESERVE units for them), then the YouTube
// agent refreshes and discovers, and the rankings are recomputed when due (daily, or when an approved creator
// changed). Paused agents return at once (they all start paused). A failing step does not stop the others but fails
// the pod so it shows. Exits without waiting on
// pool.end(), as poll-once.js.
(async () => {
  const pool = getPool();
  const plan = await planDiscovery(pool);
  if (plan.skipped) console.log(`global agent: ${plan.skipped}`);
  let failed = false;
  try {
    const recent = await collectRecentActivity(pool);
    if (recent.skipped) console.log(`recent activity: ${recent.skipped}`);
    if (recent.status === 'failed') failed = true;
  } catch (err) {
    console.error('[creators/recent]', err);
    failed = true;
  }
  // CR-2026-11-17-04: directory channel logos, once a day (~7 units), before discovery spends the budget.
  try {
    const logos = await refreshChannelLogos(pool);
    if (logos.skipped) console.log(`channel logos: ${logos.skipped}`);
    if (logos.status === 'failed') failed = true;
  } catch (err) {
    console.error('[channel-logos]', err);
    failed = true;
  }
  const yt = await runYoutubeAgent(pool);
  if (yt.skipped) console.log(`youtube agent: ${yt.skipped}`);
  if (yt.status === 'failed') failed = true;
  try {
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
