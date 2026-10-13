// Read-only. Runs in the API pod with /tmp/categories-old.js (main) and /tmp/categories-new.js (the fix).
// For every article whose stored category equals what the OLD categorizer gives for its headline alone
// (i.e. the category was headline-derived, not from the feed's own <category>), writes
//   id,old,new
// to /tmp/category-map.csv when the NEW categorizer gives something different. Summary to stdout.
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
      'SELECT id, headline, category FROM articles WHERE id > $1 ORDER BY id LIMIT 20000', [last]);
    if (rows.length === 0) break;
    for (const r of rows) {
      stats.scanned++;
      const o = oldCat([], r.headline);
      if (r.category !== o) continue;
      stats.headlineDerived++;
      const n = newCat([], r.headline);
      if (n === o) continue;
      stats.changed++;
      fs.writeSync(out, `${r.id},${o},${n}\n`);
      const k = `${o} -> ${n}`;
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
