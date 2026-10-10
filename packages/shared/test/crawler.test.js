const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRobots, isAllowed, crawlDelaySeconds } = require('../src/robots');
const {
  crawlSource, extractArticleMeta, parseSitemap, matchesArticlePatterns, patternToRegex, extractLinks,
} = require('../src/crawler');
const { validatePublicHttpUrl, hostMatches } = require('../src/urlSafety');

function res(status, text, headers = {}) {
  return { ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k] ?? null }, text: async () => text };
}

test('robots.txt: groups, longest match, Allow wins ties, wildcards, crawl-delay', () => {
  const robots = parseRobots(`
User-agent: *
Disallow: /private
Allow: /private/public-page
Disallow: /*.pdf$
Crawl-delay: 3

User-agent: BadBot
Disallow: /
`);
  assert.equal(isAllowed(robots, 'https://x.com/news/a'), true);
  assert.equal(isAllowed(robots, '/private/secret'), false);
  assert.equal(isAllowed(robots, '/private/public-page'), true);
  assert.equal(isAllowed(robots, '/doc.pdf'), false);
  assert.equal(isAllowed(robots, '/doc.pdf?x=1'), true);
  assert.equal(crawlDelaySeconds(robots), 3);
  assert.equal(isAllowed(parseRobots('User-agent: NouvellesDuPaysBot\nDisallow: /'), '/anything'), false);
  assert.equal(isAllowed('disallow-all', '/'), false);
  assert.equal(isAllowed('allow-all', '/'), true);
});

test('article URL patterns are literal globs, never raw regex', () => {
  assert.ok(matchesArticlePatterns('https://x.com/article/hello-world', ['/article/*']));
  assert.ok(!matchesArticlePatterns('https://x.com/category/politics', ['/article/*']));
  assert.ok(matchesArticlePatterns('https://x.com/2026/09/30/story', ['/2026/*']));
  assert.ok(patternToRegex('(a+)+$').test('/x/(a+)+$'), 'regex metacharacters are escaped');
  // Without patterns, only slug-like paths count as articles.
  assert.ok(matchesArticlePatterns('https://x.com/news/le-gouvernement-annonce-un-nouveau-plan', []));
  assert.ok(!matchesArticlePatterns('https://x.com/contact', []));
  assert.ok(!matchesArticlePatterns('https://x.com/category/politique', []));
});

test('extractArticleMeta reads link-preview metadata only', () => {
  const html = `<html><head><title>Fallback &amp; title</title>
    <meta property="og:title" content="Le titre &#233;ditorial">
    <meta name="description" content="Résumé court.">
    <meta property="og:image" content="/img/a.jpg">
    <meta property="article:published_time" content="2026-09-30T08:00:00+00:00">
    <meta name="author" content="Ama K.">
  </head><body><p>Full body text is never read.</p></body></html>`;
  const m = extractArticleMeta(html, 'https://site.example/article/x');
  assert.equal(m.title, 'Le titre éditorial');
  assert.equal(m.description, 'Résumé court.');
  assert.equal(m.image, 'https://site.example/img/a.jpg');
  assert.equal(m.published, '2026-09-30T08:00:00.000Z');
  assert.equal(m.author, 'Ama K.');
  assert.equal(extractArticleMeta('<title>Only title</title>', 'https://s.example/').title, 'Only title');
});

test('parseSitemap handles urlset and sitemapindex', () => {
  const set = parseSitemap('<urlset><url><loc>https://s.example/a</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://s.example/b</loc></url></urlset>');
  assert.equal(set.urls.length, 2);
  const idx = parseSitemap('<sitemapindex><sitemap><loc>https://s.example/old.xml</loc><lastmod>2025-01-01</lastmod></sitemap><sitemap><loc>https://s.example/new.xml</loc><lastmod>2026-09-01</lastmod></sitemap></sitemapindex>');
  assert.deepEqual(idx.children, ['https://s.example/new.xml', 'https://s.example/old.xml']);
  assert.throws(() => parseSitemap('<html></html>'));
});

test('extractLinks resolves relative hrefs and drops fragments/non-http', () => {
  const links = extractLinks('<a href="/a#top">a</a><a href="mailto:x@y.z">m</a><a href=\'https://o.example/b\'>b</a>', 'https://s.example/news/');
  assert.deepEqual(links, ['https://s.example/a', 'https://o.example/b']);
});

test('crawlSource (html): robots.txt, allowed domains, patterns, known URLs and the per-run cap are all enforced', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    requested.push(u);
    if (u === 'https://site.example/robots.txt') return res(200, 'User-agent: *\nDisallow: /article/blocked');
    if (u === 'https://site.example/' || u === 'https://site.example/politique') {
      return res(200, `
        <a href="/article/one">1</a><a href="/article/two">2</a><a href="/article/three">3</a>
        <a href="/article/blocked">b</a><a href="/article/known">k</a>
        <a href="https://other.example/article/x">ext</a><a href="/about">about</a>`);
    }
    if (u.startsWith('https://site.example/article/')) {
      const slug = u.split('/').pop();
      return res(200, `<meta property="og:title" content="Story ${slug}">`);
    }
    return res(404, '');
  };
  const result = await crawlSource(
    {
      feed_url: 'https://site.example/', feed_type: 'html', category_urls: ['https://site.example/politique'],
      article_url_patterns: ['/article/*'], allowed_domains: [], respect_robots_txt: true,
    },
    { fetchImpl, delayMs: 0, maxArticles: 2, filterUnknown: async (urls) => urls.filter((u) => !u.endsWith('/known')) }
  );
  assert.deepEqual(result.items.map((i) => i.title), ['Story one', 'Story two']);
  assert.equal(result.items[0].link, 'https://site.example/article/one');
  assert.ok(!requested.some((u) => u.includes('other.example')), 'never leaves the allowed domain');
  assert.ok(!requested.includes('https://site.example/article/blocked'), 'robots.txt honoured');
  assert.ok(!requested.includes('https://site.example/article/known'), 'known URLs not re-fetched');
  assert.ok(!requested.includes('https://site.example/article/three'), 'per-run cap honoured');
});

test('crawlSource: an unreachable robots.txt means do not crawl', async () => {
  const fetchImpl = async (url) => (String(url).endsWith('/robots.txt') ? res(503, '') : res(200, '<a href="/article/x">x</a>'));
  const result = await crawlSource({ feed_url: 'https://down.example/', feed_type: 'html', article_url_patterns: ['/article/*'] }, { fetchImpl, delayMs: 0 });
  assert.equal(result.items.length, 0);
});

test('crawlSource (sitemap): newest URLs first, filtered by pattern', async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.endsWith('/robots.txt')) return res(404, '');
    if (u === 'https://map.example/sitemap.xml') {
      return res(200, `<urlset>
        <url><loc>https://map.example/news/old-story-from-last-year-here</loc><lastmod>2025-01-01</lastmod></url>
        <url><loc>https://map.example/news/new-story-from-this-week-here</loc><lastmod>2026-09-30</lastmod></url>
        <url><loc>https://map.example/tag/politics</loc><lastmod>2026-09-30</lastmod></url>
      </urlset>`);
    }
    return res(200, `<title>${u.split('/').pop()}</title>`);
  };
  const result = await crawlSource({ feed_url: 'https://map.example/sitemap.xml', feed_type: 'sitemap', article_url_patterns: ['/news/*'] }, { fetchImpl, delayMs: 0 });
  assert.deepEqual(result.items.map((i) => i.title), ['new-story-from-this-week-here', 'old-story-from-last-year-here']);
});

test('crawlSource refuses unsafe start URLs', async () => {
  await assert.rejects(crawlSource({ feed_url: 'http://127.0.0.1/', feed_type: 'html' }, { fetchImpl: async () => res(200, '') }));
});

test('hostMatches: exact domain and subdomains only', () => {
  assert.ok(hostMatches('https://www.site.example/a', ['site.example']));
  assert.ok(hostMatches('https://news.site.example/a', ['site.example']));
  assert.ok(!hostMatches('https://evilsite.example/a', ['site.example']));
  assert.equal(validatePublicHttpUrl('https://site.example').ok, true);
});

// parser_config date rule (2026-10-08): Garowe Online stamps every page with a
// wrong <time datetime="2020-06-30">; the real date follows "Posted On".
test('extractArticleMeta: parser_config date_after_label overrides a wrong <time> date', () => {
  const html = `<html><head><title>Ebola alert</title></head><body>
    <li><span>Posted On</span> <a href="javascript:(0);">07-10-2026, 10:48AM</a></li>
    <aside><time datetime="2020-06-30">08-10-2026, 06:05AM</time></aside></body></html>`;
  const cfg = { date_after_label: 'Posted On', date_format: 'DD-MM-YYYY', utc_offset: '+03:00' };
  assert.equal(extractArticleMeta(html, 'https://x/a', cfg).published, '2026-10-07T07:48:00.000Z');
  assert.equal(extractArticleMeta(html, 'https://x/a').published, '2020-06-30T00:00:00.000Z', 'without config: unchanged behaviour');
});

test('extractArticleMeta: date rule handles PM, 24h, MM-DD and a missing label', () => {
  const pm = '<title>t</title><span>Posted On</span> 08-02-2025, 04:15PM';
  assert.equal(extractArticleMeta(pm, 'https://x', { date_after_label: 'Posted On' }).published, '2025-02-08T16:15:00.000Z');
  const us = '<title>t</title>Published: 10/07/2026 18:30';
  assert.equal(extractArticleMeta(us, 'https://x', { date_after_label: 'Published:', date_format: 'MM-DD-YYYY' }).published, '2026-10-07T18:30:00.000Z');
  const none = '<title>t</title><meta property="article:published_time" content="2026-10-01T09:00:00Z">';
  assert.equal(extractArticleMeta(none, 'https://x', { date_after_label: 'Posted On' }).published, '2026-10-01T09:00:00.000Z', 'falls back to meta when label absent');
});

test('extractArticleMeta: apostrophes and ">" inside quoted meta values are kept whole', () => {
  const html = `<html><head>
    <meta property="og:title" content="L'Assemblée nationale adopte le budget d'investissement">
    <meta name="description" content="Le texte, voté par 180 > 20 voix, prévoit l'extension du réseau d'eau.">
    <meta property='og:image' content='https://site.example/img/l-assemblee.jpg'>
    <meta name="author" content='Koffi N"Guessan'>
  </head></html>`;
  const m = extractArticleMeta(html, 'https://site.example/politique/x');
  assert.equal(m.title, "L'Assemblée nationale adopte le budget d'investissement");
  assert.equal(m.description, "Le texte, voté par 180 > 20 voix, prévoit l'extension du réseau d'eau.");
  assert.equal(m.image, 'https://site.example/img/l-assemblee.jpg');
  assert.equal(m.author, 'Koffi N"Guessan', 'single-quoted value may contain a double quote');
});

// --- Generic-title guard (cases seen on 2026-10-09/10) ----------------------
const { isGenericTitle, normTitle } = require('../src/crawler');

test('isGenericTitle: error pages, site name, site name + section, listing titles', () => {
  const ctx = { generic: new Set([normTitle("Lessor - Toute l’actualité en continu")]), siteNames: new Set([normTitle('Inforpress')]) };
  assert.equal(isGenericTitle('Ccontent Not Found | Trust Radio', ctx), true);
  assert.equal(isGenericTitle('404', ctx), true);
  assert.equal(isGenericTitle('Page introuvable', ctx), true);
  assert.equal(isGenericTitle('Inforpress', ctx), true);
  assert.equal(isGenericTitle('Inforpress - Sociedade', ctx), true);
  assert.equal(isGenericTitle("Lessor - Toute l'actualité en continu", ctx), true, 'listing title, apostrophe variants ignored');
  assert.equal(isGenericTitle('', ctx), true);
  assert.equal(isGenericTitle('Inforpress: Governo aprova novo plano para a agricultura em Santiago', ctx), false, 'a real headline that starts with the site name');
  assert.equal(isGenericTitle('Mahama to cut sod for Accra convention centre project', ctx), false);
});

test('extractArticleMeta: a generic title falls back to the JSON-LD headline, then a single <h1>, else no title', () => {
  const ld = `<meta property="og:site_name" content="Inforpress"><meta property="og:title" content="Inforpress - Sociedade">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Inforpress"},
    {"@type":"NewsArticle","headline":"Governo capacita agricultores em agricultura biológica","datePublished":"2026-10-09T10:00:00Z"}]}</script>`;
  const a = extractArticleMeta(ld, 'https://inforpress.cv/x');
  assert.equal(a.title, 'Governo capacita agricultores em agricultura biológica');
  assert.equal(a.titleSource, 'jsonld');
  assert.equal(a.published, '2026-10-09T10:00:00.000Z');

  const h1 = '<meta property="og:site_name" content="Lessor"><meta property="og:title" content="Lessor"><h1>Fonction publique : 1.122 emplois mis en compétition</h1>';
  const b = extractArticleMeta(h1, 'https://lessor.ml/posts/x');
  assert.equal(b.title, 'Fonction publique : 1.122 emplois mis en compétition');
  assert.equal(b.titleSource, 'h1');

  const err = '<title>Ccontent Not Found | Trust Radio</title><h1>Home</h1><h1>404</h1>';
  const c = extractArticleMeta(err, 'https://trustradio.com.ng/x');
  assert.equal(c.title, '');
  assert.equal(c.titleSource, null);

  const twoH1 = '<meta property="og:site_name" content="Site"><title>Site</title><h1>First real looking heading here</h1><h1>Second real looking heading here</h1>';
  assert.equal(extractArticleMeta(twoH1, 'https://s.example/x').title, '', 'ambiguous: several <h1>, no guess');

  const normal = '<meta property="og:site_name" content="Modern Ghana"><meta property="og:title" content="1,568 new lawyers must use law to advance justice"><h1>Other</h1>';
  const d = extractArticleMeta(normal, 'https://www.modernghana.com/news/1/x.html');
  assert.equal(d.title, '1,568 new lawyers must use law to advance justice');
  assert.equal(d.titleSource, 'meta', 'a real link-preview title is kept as before');
});

test('crawlSource: skips redirects to the homepage, generic titles and titles repeated across pages', async () => {
  const listing = `<html><head><title>Lessor - Toute l’actualité en continu</title></head><body>
    <a href="/posts/redirected-to-the-homepage-story">r</a>
    <a href="/posts/generic-title-only-story-here">g</a>
    <a href="/posts/template-title-one-story-here">t1</a>
    <a href="/posts/template-title-two-story-here">t2</a>
    <a href="/posts/real-story-with-a-headline">ok</a></body></html>`;
  const page = (url, text) => ({ ...res(200, text), url });
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.endsWith('/robots.txt')) return res(404, '');
    if (u === 'https://lessor.example/') return page(u, listing);
    if (u.includes('redirected-to-the-homepage')) return page('https://lessor.example/', listing);
    if (u.includes('generic-title-only')) return page(u, '<meta property="og:title" content="Lessor - Toute l&#39;actualité en continu">');
    if (u.includes('template-title-')) return page(u, '<meta property="og:title" content="Breaking news and analysis from Mali today">');
    if (u.includes('real-story')) return page(u, '<meta property="og:title" content="Les FAMa intensifient leurs opérations au centre">');
    return res(404, '');
  };
  const result = await crawlSource(
    { feed_url: 'https://lessor.example/', feed_type: 'html', category_urls: [], article_url_patterns: ['/posts/*'], allowed_domains: [] },
    { fetchImpl, delayMs: 0, maxArticles: 10 }
  );
  assert.deepEqual(result.items.map((i) => i.title), ['Les FAMa intensifient leurs opérations au centre']);
  assert.deepEqual(result.skipped, { generic: 1, redirected: 1, repeated: 2 });
  assert.ok(result.log.some((l) => /skipped: 1 with no real headline/.test(l)), 'reported in the crawl log');
});

test('crawlSource: a short listing title names the site ("Inforpress - Sociedade" is a section page)', async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.endsWith('/robots.txt')) return res(404, '');
    if (u === 'https://inforpress.example/pt') {
      return { ...res(200, `<title>Inforpress</title>
        <a href="/governo-capacita-agricultores-em-agricultura-biologica">a</a>
        <a href="/sociedade-seccao-de-noticias-da-sociedade">s</a>
        <a href="/ghana-news-search-results-page-here">q</a>`), url: u };
    }
    if (u.includes('governo-capacita')) return { ...res(200, '<meta property="og:title" content="Governo capacita agricultores em agricultura biológica">'), url: u };
    if (u.includes('sociedade-seccao')) return { ...res(200, '<meta property="og:title" content="Inforpress - Sociedade">'), url: u };
    if (u.includes('search-results')) return { ...res(200, '<title>Search Results</title>'), url: u };
    return res(404, '');
  };
  const result = await crawlSource({ feed_url: 'https://inforpress.example/pt', feed_type: 'html', category_urls: [], article_url_patterns: [] }, { fetchImpl, delayMs: 0 });
  assert.deepEqual(result.items.map((i) => i.title), ['Governo capacita agricultores em agricultura biológica']);
  assert.equal(result.skipped.generic, 2);
});
