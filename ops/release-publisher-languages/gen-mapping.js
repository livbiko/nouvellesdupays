// Scope narrowed after the first rehearsal (2026-10-15): 244 Global Publishers (sw) and 6748 Sun.mv (dv) stay 'en' -
// their headlines are full of English loanwords (AI, iPhone, film, FIFA, HIV, Congress) that only the English keyword
// list categorizes; switching them moved 184 mostly-correct articles back to other.
// Read-only. Runs in the API pod with /tmp/categories.js (main f75b7c3 = Build #65's live categorizer; no code change
// in this release). For the two publishers whose language is being corrected, and for every one of their articles
// whose stored category equals what the categorizer gives for headline + OLD language + URL (i.e. the category was
// headline/URL-derived, not from the feed's own <category>), writes
//   id,old,new
// to /tmp/category-map.csv when headline + NEW language + URL gives something different.
// Unlike the keyword releases this is not last-pass only: the base keyword map is per language, so any transition
// can appear (e.g. a French-keyword politics hit on an English headline going back to other). Summary to stdout.
const fs = require('fs');
const { Pool } = require(require.resolve('pg', { paths: ['/app/apps/api', '/app'] }));
const { categorize } = require('/tmp/categories.js');

const CHANGES = { 1054: ['en', 'ar'], 1537: ['fr', 'en'] };

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
      `SELECT id, publisher_id, headline, category, original_url FROM articles
        WHERE publisher_id = ANY($2::int[]) AND id > $1 ORDER BY id LIMIT 5000`, [last, Object.keys(CHANGES)]);
    if (rows.length === 0) break;
    for (const r of rows) {
      stats.scanned++;
      const [from, to] = CHANGES[r.publisher_id];
      const o = categorize([], r.headline, from, r.original_url);
      if (r.category !== o) continue;
      stats.headlineDerived++;
      const n = categorize([], r.headline, to, r.original_url);
      if (n === o) continue;
      stats.changed++;
      fs.writeSync(out, `${r.id},${o},${n}\n`);
      const k = `${o} -> ${n} [${r.publisher_id} ${from}->${to}]`;
      trans.set(k, (trans.get(k) || 0) + 1);
      if (!ex.has(k)) ex.set(k, []);
      if (ex.get(k).length < 3) ex.get(k).push(String(r.headline).replace(/\s+/g, ' ').slice(0, 90));
    }
    last = rows[rows.length - 1].id;
    stats.maxId = last;
  }
  fs.closeSync(out);
  const { rows: per } = await pool.query(
    `SELECT publisher_id, count(*) n, count(*) FILTER (WHERE category = 'other') other FROM articles
      WHERE publisher_id = ANY($1::int[]) GROUP BY publisher_id ORDER BY publisher_id`, [Object.keys(CHANGES)]);
  await pool.end();
  console.log('stats|' + JSON.stringify(stats));
  for (const p of per) console.log(`pub|${p.publisher_id}|${p.n} articles|${p.other} other`);
  for (const [k, n] of [...trans].sort((a, b) => b[1] - a[1])) {
    console.log(`trans|${n}|${k}`);
    for (const e of ex.get(k)) console.log(`   ex| ${e}`);
  }
  console.log('__END__');
})().catch((e) => { console.log('ERR', e.stack); console.log('__END__'); });
