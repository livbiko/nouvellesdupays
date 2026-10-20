const cron = require('node-cron');
const { pollAllFeeds } = require('./poll');
const { fetchYoutubeAudience } = require('./youtube-audience');
const { getPool } = require('@nouvellesdupays/shared/src/db');

const SCHEDULE = process.env.POLL_SCHEDULE || '*/5 * * * *';
// Weekly YouTube audience refresh: Sunday 03:00 UTC. Overridable for testing.
const YT_SCHEDULE = process.env.YT_AUDIENCE_SCHEDULE || '0 3 * * 0';

console.log(`Worker starting, schedule: ${SCHEDULE}, yt-audience: ${YT_SCHEDULE}`);

pollAllFeeds().catch((err) => console.error('Initial poll failed:', err));

cron.schedule(SCHEDULE, () => {
  console.log(`\n[${new Date().toISOString()}] Running scheduled poll...`);
  pollAllFeeds().catch((err) => console.error('Scheduled poll failed:', err));
});

cron.schedule(YT_SCHEDULE, () => {
  console.log(`\n[${new Date().toISOString()}] Running YouTube audience refresh...`);
  fetchYoutubeAudience(getPool()).catch((err) => console.error('YouTube audience fetch failed:', err));
});
