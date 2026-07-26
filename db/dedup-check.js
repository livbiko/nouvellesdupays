// Informational dedup scan -- flags publishers worth a human look, never
// auto-merges anything. Two signals:
//   1. Same domain registered in more than one country -- often legitimate
//      (a real international brand's per-country edition, e.g. theguardian.com
//      for both GB and AU), but worth eyeballing in case it's actually an
//      accidental re-registration of the same country's publisher.
//   2. Near-duplicate names within the same country (simple substring/prefix
//      check, not full fuzzy matching -- catches the "BBC" vs "BBC News"
//      class of near-miss the DB's exact-name constraint can't).
const { getPool } = require('../packages/shared/src/db');

function namesLookAlike(a, b) {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  return na !== nb && (na.includes(nb) || nb.includes(na));
}

async function main() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.domain, c.iso_code
     FROM publishers p JOIN countries c ON c.id = p.country_id
     ORDER BY p.domain, c.iso_code`
  );

  console.log(`Scanned ${rows.length} publishers.\n`);

  const byDomain = {};
  for (const r of rows) {
    (byDomain[r.domain] ||= []).push(r);
  }
  const crossCountry = Object.entries(byDomain).filter(([, list]) => list.length > 1);

  console.log(`=== Same domain, multiple countries (${crossCountry.length}) ===`);
  if (crossCountry.length === 0) console.log('  none');
  for (const [domain, list] of crossCountry) {
    console.log(`  ${domain}: ${list.map((r) => `${r.name} (${r.iso_code})`).join(', ')}`);
  }

  console.log(`\n=== Near-duplicate names, same country ===`);
  let found = 0;
  for (const [iso, group] of Object.entries(
    rows.reduce((acc, r) => ((acc[r.iso_code] ||= []).push(r), acc), {})
  )) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (namesLookAlike(group[i].name, group[j].name)) {
          console.log(`  [${iso}] "${group[i].name}" vs "${group[j].name}"`);
          found++;
        }
      }
    }
  }
  if (found === 0) console.log('  none');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
