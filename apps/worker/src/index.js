const cron = require('node-cron');
const { pollAllFeeds } = require('./poll');

const SCHEDULE = process.env.POLL_SCHEDULE || '*/5 * * * *';

console.log(`Worker starting, schedule: ${SCHEDULE}`);

pollAllFeeds().catch((err) => console.error('Initial poll failed:', err));

cron.schedule(SCHEDULE, () => {
  console.log(`\n[${new Date().toISOString()}] Running scheduled poll...`);
  pollAllFeeds().catch((err) => console.error('Scheduled poll failed:', err));
});
