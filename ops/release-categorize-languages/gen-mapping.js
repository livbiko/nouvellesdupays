// Read-only. Runs in the API pod with /tmp/categories-old.js (main, c007704 = 649845c's categorizer) and
// /tmp/categories-new.js (the fix, branch HEAD: publisher-language keywords as a last pass). Both take the headline,
// the publisher language and the article URL.
// For every article whose stored category equals what the OLD categorizer gives for headline + language + URL
// (i.e. the category was headline/URL-derived, not from the feed's own <category>), writes
//   id,old,new
// to /tmp/category-map.csv when the NEW categorizer gives something different. With the last-pass design every
// change should be other -> something; the summary shows the transitions to check that.
// Summary to stdout.
const fs = require('fs');
const { Pool } = require(require.resolve('pg', { paths: ['/app/apps/api', '/app'] }));
const oldCat = require('/tmp/categories-old.js').categorize;
const newCat = require('/tmp/categories-new.js').categorize;

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const out = fs.openSync('/tmp/category-map.csv', 'w');
  fs.writeSync(out, 'id,old,new\n');
  const stats = { scanned: 0, headlineDerived: 0, changed: 0, maxId: 0 };
  const trans = new Map();
  const ex = new Map();
  let last = 0;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT a.id, a.headline, a.category, a.original_url, p.language FROM articles a JOIN publishers p ON p.id = a.publisher_id
        WHERE a.id > $1 ORDER BY a.id LIMIT 20000`, [last]);
    if (rows.length === 0) break;
    for (const r of rows) {
      stats.scanned++;
      const o = oldCat([], r.headline, r.language, r.original_url);
      if (r.category !== o) continue;
      stats.headlineDerived++;
      const n = newCat([], r.headline, r.language, r.original_url);
      if (n === o) continue;
      stats.changed++;
      fs.writeSync(out, `${r.id},${o},${n}\n`);
      const k = `${o} -> ${n} [${r.language}]`;
      trans.set(k, (trans.get(k) || 0) + 1);
      if (!ex.has(k)) ex.set(k, []);
      if (ex.get(k).length < 2) ex.get(k).push(String(r.headline).replace(/\s+/g, ' ').slice(0, 90));
    }
    last = rows[rows.length - 1].id;
    stats.maxId = last;
  }
  fs.closeSync(out);
  await pool.end();
  console.log('stats|' + JSON.stringify(stats));
  for (const [k, n] of [...trans].sort((a, b) => b[1] - a[1])) {
    console.log(`trans|${n}|${k}`);
    for (const e of ex.get(k)) console.log(`   ex| ${e}`);
  }
  console.log('__END__');
})().catch((e) => { console.log('ERR', e.stack); console.log('__END__'); });
