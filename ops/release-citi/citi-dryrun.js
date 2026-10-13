// Read-only dry run of the worker's own crawlSource against Citi Newsroom with
// candidate source configs held in memory -- no DB access, nothing stored.
const path = require.resolve('@nouvellesdupays/shared/src/crawler', { paths: ['/app/apps/api', '/app'] });
const { crawlSource } = require(path);
const UA = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; approved-source crawler, robots.txt compliant)';

async function sitemapOrder() {
  const idx = await (await fetch('https://www.citinewsroom.com/wp-sitemap.xml', { headers: { 'User-Agent': UA } })).text();
  const posts = [...idx.matchAll(/<loc>([^<]*posts-post-\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  console.log('posts sitemaps:', posts.length);
  for (const u of [posts[0], posts[posts.length - 1]]) {
    const x = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
    const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    console.log(' ', u.split('/').pop(), locs.length, 'urls; lastmod tags:', (x.match(/<lastmod>/g) || []).length,
      '| first', locs[0], '| last', locs[locs.length - 1]);
  }
}

async function run(name, source) {
  const t = Date.now();
  try {
    const r = await crawlSource(source, { maxArticles: 8, delayMs: 1000, deadline: Date.now() + 120000 });
    console.log(`== ${name}: ${r.items.length} item(s), fetched ${r.fetched}, candidates ${r.candidates}, ${Date.now() - t} ms`);
    for (const l of r.log) console.log('   log:', l);
    for (const i of r.items) console.log(`   ${i.isoDate || 'NO DATE'} | ${String(i.title).slice(0, 90)} | ${i.link}`);
  } catch (e) {
    console.log(`== ${name}: ERROR ${e.message}`);
  }
}

(async () => {
  await sitemapOrder();
  const common = { respect_robots_txt: true, allowed_domains: ['citinewsroom.com'], parser_config: {} };
  await run('html, homepage + breaking-news, pattern /20*/*/*', {
    ...common, feed_type: 'html', feed_url: 'https://citinewsroom.com/',
    category_urls: ['https://citinewsroom.com/category/breaking-news/'], article_url_patterns: ['/20*/*/*'],
  });
  await run('sitemap (wp-sitemap.xml), pattern /20*/*/*', {
    ...common, feed_type: 'sitemap', feed_url: 'https://citinewsroom.com/wp-sitemap.xml',
    category_urls: [], article_url_patterns: ['/20*/*/*'],
  });
  console.log('__END__');
})();
