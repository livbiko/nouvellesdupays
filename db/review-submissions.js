// Moderation for self-service publisher submissions
// (apps/api/src/publisherRegistration.js). Deliberately a CLI run via
// `kubectl exec`, not a web admin panel -- this project has no
// accounts/auth system at all (Phase 1 explicitly deferred it), so this
// reuses the same kubectl/psql access pattern already used for every other
// admin-only operation here instead of adding a new auth surface.
//
// Reads all answers from stdin up front (one per line) rather than
// readline.question()'s interactive prompt-then-wait -- there's no real TTY
// available when this runs via `kubectl exec -i` piped input (the realistic
// way this gets invoked), and readline's interface can close before a
// piped answer resolves once stdin hits EOF right after the write (a real
// bug hit while testing this: ERR_USE_AFTER_CLOSE). Reading synchronously
// up front sidesteps that timing race entirely.
//
// Usage: echo "a" | kubectl exec -i deploy/nouvellesdupays-api -n nouvellesdupays -- node db/review-submissions.js
// For a reject with a reason, provide two lines: "r\nreason text"

const fs = require('fs');
const { getPool } = require('../packages/shared/src/db');

const answers = fs.readFileSync(0, 'utf8').split('\n');
let answerIndex = 0;
function ask(question) {
  console.log(question);
  const answer = answers[answerIndex++] || '';
  console.log(`> ${answer}`);
  return Promise.resolve(answer);
}

function domainFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

async function approve(pool, sub) {
  const domain = domainFromUrl(sub.homepage_url);

  const { rows: pubRows } = await pool.query(
    `INSERT INTO publishers (country_id, name, homepage_url, feed_status, language, domain)
     VALUES ($1, $2, $3, 'active', $4, $5)
     ON CONFLICT (country_id, name) DO UPDATE SET homepage_url = EXCLUDED.homepage_url
     RETURNING id`,
    [sub.country_id, sub.name, sub.homepage_url, sub.language, domain]
  );
  const publisherId = pubRows[0].id;

  await pool.query(
    `INSERT INTO feeds (publisher_id, feed_url) VALUES ($1, $2)
     ON CONFLICT (feed_url) DO NOTHING`,
    [publisherId, sub.feed_url]
  );

  await pool.query(
    `UPDATE publisher_submissions SET status = 'approved', reviewed_at = now() WHERE id = $1`,
    [sub.id]
  );
}

async function reject(pool, sub, note) {
  await pool.query(
    `UPDATE publisher_submissions SET status = 'rejected', reviewer_note = $2, reviewed_at = now() WHERE id = $1`,
    [sub.id, note || null]
  );
}

async function main() {
  const pool = getPool();
  const { rows: submissions } = await pool.query(
    `SELECT s.*, c.name AS country_name, c.iso_code
     FROM publisher_submissions s
     JOIN countries c ON c.id = s.country_id
     WHERE s.status = 'pending'
     ORDER BY s.submitted_at ASC`
  );

  if (submissions.length === 0) {
    console.log('No pending submissions.');
    await pool.end();
    return;
  }

  console.log(`${submissions.length} pending submission(s).\n`);

  for (const sub of submissions) {
    console.log('---');
    console.log(`#${sub.id} — ${sub.name} (${sub.country_name}, ${sub.language})`);
    console.log(`  Homepage: ${sub.homepage_url}`);
    console.log(`  Feed:     ${sub.feed_url}`);
    console.log(`  Contact:  ${sub.contact_email || '(none)'}`);
    console.log(`  Verified: ${sub.verification_detail}`);
    console.log(`  Submitted: ${sub.submitted_at}`);

    const answer = (await ask('  [a]pprove / [r]eject / [s]kip? ')).trim().toLowerCase();
    if (answer === 'a') {
      await approve(pool, sub);
      console.log('  -> approved, now live.');
    } else if (answer === 'r') {
      const note = await ask('  Reason (optional): ');
      await reject(pool, sub, note);
      console.log('  -> rejected.');
    } else {
      console.log('  -> skipped.');
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
