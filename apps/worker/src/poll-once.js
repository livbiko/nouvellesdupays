const { pollAllFeeds } = require('./poll');

// This is a one-shot job pod -- k8s tears down the whole container the
// moment this process exits, so there's nothing to gain from waiting on
// pool.end() to drain gracefully. It was also a real bug: if any query
// left a client in a bad state, pool.end() could hang indefinitely,
// keeping the pod "Running" with no more work to do until the CronJob's
// activeDeadlineSeconds killed it -- discovered when a run that had
// already logged "Done" in its own output was still showing Running.
pollAllFeeds()
  .then((results) => {
    const ok = results.filter((r) => r.ok).length;
    const inserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    console.log(`\nDone: ${ok}/${results.length} feeds ok, ${inserted} new articles total.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
