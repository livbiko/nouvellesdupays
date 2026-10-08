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
