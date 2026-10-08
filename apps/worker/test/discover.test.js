// Integration test for the discovery pipeline against the local test DB
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
// with a fake fetch, so no real site is contacted.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { runDiscovery, addCandidates } = require('../src/discover');

const NOW = new Date('2026-10-08T12:00:00Z');
const pool = getPool();

const rss = (n, date) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${
  Array.from({ length: n }, (_, i) => `<item><title>Article ${i}</title><link>https://x/${i}</link><pubDate>${date}</pubDate></item>`).join('')
}</channel></rss>`;
const articles = (n) => Array.from({ length: n }, (_, i) => `<a href="/actualite/un-titre-assez-long-pour-un-article-${i}">a</a>`).join('');

const SITES = {
  // existing publisher whose homepage links to other outlets
  'https://referrer.ci/robots.txt': [404, ''],
  'https://referrer.ci/': [200, `<html><body>
    <a href="https://www.goodnews.ci/">Good News</a>
    <a href="https://nofeed.ci/">No feed</a>
    <a href="https://hijacked.ci/">Old partner</a>
    <a href="https://down.ci/">Down</a>
    <a href="https://private.ci/">Robots</a>
    <a href="https://already-a-publisher.ci/x">Known</a>
    <a href="https://facebook.com/referrer">fb</a>
    <a href="https://refresh.ci/">Old-style site</a>
    <a href="https://moved.ci/">Moved</a>
    <a href="https://mail.provider.ci/">Webmail</a>
    <a href="https://oldname.ci/">Old name of a known outlet</a>
    <a href="https://telecom.ci/">Telecom company blog</a>
  </body></html>`],
  'https://www.goodnews.ci/robots.txt': [200, 'User-agent: *\nDisallow: /wp-admin/'],
  'https://www.goodnews.ci/': [200, `<html lang="fr"><head><title>Good News CI</title>
    <link rel="alternate" type="application/rss+xml" href="https://www.goodnews.ci/feed/"></head>
    <body>${articles(25)}<a href="/contact">contact</a><a href="https://www.facebook.com/GoodNewsCI">fb</a>
    <a href="https://www.youtube.com/@GoodNewsCI">yt</a></body></html>`],
  'https://www.goodnews.ci/feed/': [200, rss(12, 'Wed, 08 Oct 2026 09:00:00 GMT')],
  'https://nofeed.ci/robots.txt': [404, ''],
  'https://nofeed.ci/': [200, `<html lang="fr"><head><title>No Feed Info</title></head><body>${articles(10)}</body></html>`],
  'https://nofeed.ci/sitemap.xml': [200, '<?xml version="1.0"?><urlset><url><loc>https://nofeed.ci/a</loc></url></urlset>'],
  'https://hijacked.ci/robots.txt': [404, ''],
  'https://hijacked.ci/': [200, '<html><head><title>Slot Gacor Casino Online</title></head><body>judi togel poker online</body></html>'],
  'https://private.ci/robots.txt': [200, 'User-agent: *\nDisallow: /'],
  // root is only a meta refresh; the real page is ISO-8859-1
  'https://refresh.ci/robots.txt': [404, ''],
  'https://refresh.ci/': [200, `<html><head><title>L'Ancien</title><meta http-equiv="refresh" content="0; URL='https://www.refresh.ci/news/'"></head></html>`],
  'https://www.refresh.ci/news/': [200, Buffer.from(`<html><head><title>L'Ancien Quotidien - Actualité ivoirienne</title></head><body>${articles(9)}</body></html>`, 'latin1'),
    { 'content-type': 'text/html; charset=iso-8859-1' }],
  // old domain of an outlet we already carry
  'https://oldname.ci/robots.txt': [404, ''],
  'https://oldname.ci/': [200, `<html><head><title>Known</title></head><body>${articles(20)}</body></html>`, {}, 'https://www.already-a-publisher.ci/'],
  // a company with a WordPress blog: one old post, a few links
  'https://telecom.ci/robots.txt': [404, ''],
  'https://telecom.ci/': [200, `<html><head><title>CI Telecom - Forfaits internet</title></head><body>${articles(2)}<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></body></html>`],
  'https://telecom.ci/feed': [200, rss(1, 'Mon, 27 Jan 2026 09:00:00 GMT')],
  // expired domain now redirecting to a shop
  'https://moved.ci/robots.txt': [404, ''],
  'https://moved.ci/': [200, `<html><head><title>Ella & Ollies Boutique</title></head><body>${articles(5)}</body></html>`, {}, 'https://ellaandollies.com/'],
};

function fakeFetch(url) {
  const hit = SITES[url];
  if (url.startsWith('https://down.ci/')) return Promise.reject(new Error('getaddrinfo ENOTFOUND down.ci'));
  const [status, body, headers = {}, finalUrl] = hit || [404, ''];
  const res = {
    ok: status >= 200 && status < 300,
    status,
    url: finalUrl || url,
    headers: { get: (k) => headers[k.toLowerCase()] || null },
    text: () => Promise.resolve(Buffer.isBuffer(body) ? body.toString('utf8') : body),
  };
  if (Buffer.isBuffer(body)) res.arrayBuffer = () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.length));
  return Promise.resolve(res);
}

let ci;
let referrerId;

before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE articles, feeds, publishers, countries, publisher_submissions RESTART IDENTITY CASCADE');
  const { rows } = await pool.query(
    `INSERT INTO countries (iso_code, name, region) VALUES ('CI', 'Côte d''Ivoire', 'West Africa'), ('FR', 'France', 'Western Europe') RETURNING id, iso_code`
  );
  ci = rows.find((r) => r.iso_code === 'CI').id;
  const { rows: pubs } = await pool.query(
    `INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language) VALUES
       ($1, 'Referrer', 'https://referrer.ci/', 'referrer.ci', 'active', 'fr'),
       ($1, 'Known', 'https://www.already-a-publisher.ci/', 'www.already-a-publisher.ci', 'active', 'fr')
     RETURNING id`,
    [ci]
  );
  referrerId = pubs[0].id;
});

after(async () => {
  await pool.end();
});

const quiet = () => {};

test('first run: mines the referrer, dedupes, checks and scores every candidate', async () => {
  const res = await runDiscovery(pool, { fetchImpl: fakeFetch, now: NOW, log: quiet, mineLimit: 5, checkLimit: 20 });
  assert.equal(res.mined.mined, 2, 'both active West African publishers mined');
  assert.equal(res.mined.added, 9, 'already-a-publisher.ci (www.-insensitive), facebook and the webmail host skipped');

  const { rows } = await pool.query('SELECT * FROM discovered_sources ORDER BY domain');
  const by = Object.fromEntries(rows.map((r) => [r.domain, r]));
  assert.deepEqual(Object.keys(by), ['down.ci', 'goodnews.ci', 'hijacked.ci', 'moved.ci', 'nofeed.ci', 'oldname.ci', 'private.ci', 'refresh.ci', 'telecom.ci']);
  for (const r of rows) {
    assert.equal(r.country_id, ci);
    assert.equal(r.discovered_from_publisher_id, referrerId);
    assert.equal(r.discovery_method, 'outlink');
  }

  const good = by['goodnews.ci'];
  assert.equal(good.status, 'under_review');
  assert.equal(good.health, 'ok');
  assert.equal(good.name, 'Good News CI', 'name taken from the site title');
  assert.equal(good.feed_url, 'https://www.goodnews.ci/feed/');
  assert.equal(good.feed_type, 'rss');
  assert.equal(good.item_count, 12);
  assert.equal(good.language, 'fr');
  assert.equal(good.facebook_url, 'https://facebook.com/GoodNewsCI');
  assert.equal(good.youtube_url, 'https://youtube.com/@GoodNewsCI');
  assert.ok(good.score >= 80, `fresh feed + ccTLD + identity scores high (got ${good.score})`);

  const nofeed = by['nofeed.ci'];
  assert.equal(nofeed.status, 'under_review', 'a site without RSS is still a candidate');
  assert.equal(nofeed.feed_url, null);
  assert.equal(nofeed.feed_type, 'sitemap');
  assert.ok(nofeed.flags.includes('no_feed'));
  assert.ok(nofeed.score < good.score);

  assert.equal(by['hijacked.ci'].status, 'rejected');
  assert.equal(by['hijacked.ci'].health, 'spam_suspect');
  assert.equal(by['hijacked.ci'].score, 0);
  assert.match(by['hijacked.ci'].notes, /auto-rejected/);

  assert.equal(by['down.ci'].health, 'unreachable');
  assert.equal(by['down.ci'].consecutive_failures, 1);
  assert.equal(by['down.ci'].status, 'discovered');

  assert.equal(by['private.ci'].health, 'blocked_by_robots');

  const refresh = by['refresh.ci'];
  assert.equal(refresh.site_title, "L'Ancien Quotidien - Actualité ivoirienne", 'meta refresh followed, latin-1 decoded');
  assert.equal(refresh.final_url, 'https://www.refresh.ci/news/');
  assert.equal(refresh.article_link_count, 9);
  assert.equal(refresh.health, 'ok');

  const moved = by['moved.ci'];
  assert.ok(moved.flags.includes('redirects_elsewhere'));
  assert.equal(moved.final_url, 'https://ellaandollies.com/');
  assert.equal(moved.status, 'under_review', 'flagged for a human, not auto-rejected');
  assert.ok(moved.score < 20, `redirect penalty applied (got ${moved.score})`);

  assert.equal(by['oldname.ci'].status, 'rejected', 'redirects to a publisher we already carry');
  assert.ok(by['oldname.ci'].flags.includes('duplicate'));
  assert.match(by['oldname.ci'].notes, /duplicate, redirects to publisher/);

  assert.equal(by['telecom.ci'].health, 'not_news', 'one stale blog post is not a news outlet');
  assert.equal(by['telecom.ci'].feed_type, 'rss');

  const { rows: scores } = await pool.query('SELECT count(*)::int AS n FROM source_scores');
  assert.equal(scores[0].n, 7, 'one score row per fully checked candidate');
});

test('second run: no duplicates, nothing re-mined or re-checked before it is due', async () => {
  const res = await runDiscovery(pool, { fetchImpl: fakeFetch, now: new Date(NOW.getTime() + 3600000), log: quiet });
  assert.equal(res.mined.mined, 0);
  assert.equal(res.checked.checked, 0);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM discovered_sources');
  assert.equal(rows[0].n, 9);
});

test('failures back off and finally mark the site dead, without deleting it', async () => {
  let t = NOW;
  for (let i = 0; i < 4; i += 1) {
    t = new Date(t.getTime() + 15 * 86400000);
    await runDiscovery(pool, { fetchImpl: fakeFetch, now: t, log: quiet, mineLimit: 0 });
  }
  const { rows: [down] } = await pool.query(`SELECT * FROM discovered_sources WHERE domain = 'down.ci'`);
  assert.equal(down.health, 'dead');
  assert.ok(down.consecutive_failures >= 4);
  assert.ok(down.next_check_at > t, 'still re-checked later (monthly)');
});

test('addCandidates: same site found from a second referrer is counted, not duplicated', async () => {
  const added = await addCandidates(pool, [{ homepage: 'https://goodnews.ci/', country: 'CI' }], { method: 'outlink', from: 'https://other.ci/' });
  assert.equal(added, 0);
  const { rows: [g] } = await pool.query(`SELECT times_seen FROM discovered_sources WHERE domain = 'goodnews.ci'`);
  assert.equal(g.times_seen, 2);
});

test('outreach records and domain-less duplicates are never touched by the worker', async () => {
  const { rows } = await pool.query(
    `INSERT INTO discovered_sources (name, homepage_url, domain, country_id, status, notes, flags) VALUES
       ('Contacted outlet', 'https://contacted.ci/', 'contacted.ci', $1, 'contacted', 'VERIFIED FACT: hand research', '{}'),
       ('Second entry', 'https://www.goodnews.ci', NULL, $1, 'under_review', 'dup', '{duplicate_domain}')
     RETURNING id`,
    [ci]
  );
  await runDiscovery(pool, { fetchImpl: fakeFetch, now: new Date(NOW.getTime() + 90 * 86400000), log: quiet, mineLimit: 0 });
  const { rows: after } = await pool.query('SELECT status, notes, check_count, health FROM discovered_sources WHERE id = ANY($1) ORDER BY id', [rows.map((r) => r.id)]);
  assert.deepEqual(after.map((r) => [r.status, r.check_count, r.health]), [['contacted', 0, 'unchecked'], ['under_review', 0, 'unchecked']]);
  assert.equal(after[0].notes, 'VERIFIED FACT: hand research');
});
