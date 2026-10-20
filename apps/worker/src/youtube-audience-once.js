// One-shot entry point for the k8s CronJob nouvellesdupays-youtube-audience.
// Mirrors the poll-once.js / discover-once.js pattern: exits with code 0 on
// success, 1 on error, without waiting on pool.end() (avoids hanging pods).
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { fetchYoutubeAudience } = require('./youtube-audience');

fetchYoutubeAudience(getPool())
  .then(({ skipped, updated = 0, errors = 0 }) => {
    if (skipped) {
      console.log('Skipped: YOUTUBE_API_KEY not set.');
    } else {
      console.log(`Done: ${updated} channel(s) updated, ${errors} error(s).`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
