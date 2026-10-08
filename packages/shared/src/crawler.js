const { XMLParser } = require('fast-xml-parser');
const { parseRobots, isAllowed, crawlDelaySeconds } = require('./robots');
const { validatePublicHttpUrl, domainOf, hostMatches } = require('./urlSafety');

// Controlled crawler for news websites that publish NO RSS/Atom/API feed
// (feeds.feed_type 'sitemap' or 'html'). It only runs for sources an admin
// has explicitly approved AND activated, and every run is bounded:
//
//   * robots.txt is honoured by default (feeds.respect_robots_txt), including
//     Crawl-delay; an unreachable robots.txt means "don't crawl";
//   * only URLs on the source's allowed domains are ever fetched;
//   * article URLs must match the admin-configured patterns (or a
//     conservative slug heuristic when none are configured);
//   * at most `maxArticles` article pages are fetched per run, one at a time,
//     with a politeness delay between requests;
//   * already-ingested URLs are skipped before any request is made.
//
// It never stores page bodies: from each article page it reads only the
// standard metadata a site publishes for link previews (OpenGraph /
// <title> / meta description / article:published_time), which is the same
// headline + summary + link-out model the RSS pipeline already uses.
//
// Output shape matches rss-parser's ({ items: [{ title, link, isoDate,
// contentSnippet, enclosure }] }) so apps/worker/src/poll.js's existing
// buildArticleRow handles crawled items with no changes.

const USER_AGENT = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; approved-source crawler, robots.txt compliant)';
const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_CHILD_SITEMAPS = 3;
const MAX_DELAY_MS = 10000;

const xmlParser = new XMLParser({ ignoreAttributes: false });

function sleep(ms) {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

const { decodeEntities, cleanText } = require('./text');

async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  const len = Number(res.headers?.get?.('content-length') || 0);
  if (len > MAX_BODY_BYTES) throw new Error(`Response too large (${len} bytes)`);
  return { status: res.status, ok: res.ok, text: res.ok ? (await res.text()).slice(0, MAX_BODY_BYTES) : '' };
}

// Glob-style article URL pattern ("/article/*", "*/2026/*") -> RegExp
// matched against the URL's path. Everything except `*` is literal, so an
// admin-supplied pattern can never become an arbitrary (or catastrophic)
// regular expression.
function patternToRegex(pattern) {
  const body = String(pattern)
    .slice(0, 200)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body.startsWith('/') || body.startsWith('.*') ? '' : '.*'}${body}`);
}

// Default when an admin hasn't configured patterns yet: a path whose last
// segment looks like an article slug (hyphenated words, or a numeric id),
// which excludes nav pages like /contact, /about, /category/politique.
function looksLikeArticlePath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1].replace(/\.(html?|php|aspx?)$/, '');
  return (last.split('-').length >= 4 && last.length >= 20) || /\d{4,}/.test(last);
}

function matchesArticlePatterns(url, patterns) {
  let pathname;
  try {
    const u = new URL(url);
    pathname = u.pathname + u.search;
  } catch {
    return false;
  }
  if (!patterns || patterns.length === 0) return looksLikeArticlePath(pathname.split('?')[0]);
  return patterns.some((p) => patternToRegex(p).test(pathname));
}

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// Standard sitemap (urlset) or sitemap index. Returns { urls: [{loc,lastmod}], children: [loc] }.
function parseSitemap(xml) {
  let doc;
  try {
    doc = xmlParser.parse(xml);
  } catch (err) {
    throw new Error(`Not valid XML: ${err.message}`);
  }
  if (doc.sitemapindex) {
    const children = asArray(doc.sitemapindex.sitemap)
      .filter((s) => s && s.loc)
      .map((s) => ({ loc: String(s.loc).trim(), lastmod: s.lastmod ? String(s.lastmod) : null }))
      .sort((a, b) => String(b.lastmod || '').localeCompare(String(a.lastmod || '')));
    return { urls: [], children: children.map((c) => c.loc) };
  }
  if (doc.urlset) {
    const urls = asArray(doc.urlset.url)
      .filter((u) => u && u.loc)
      .map((u) => ({ loc: String(u.loc).trim(), lastmod: u.lastmod ? String(u.lastmod) : null }));
    return { urls, children: [] };
  }
  throw new Error('XML is neither a <urlset> nor a <sitemapindex>');
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(decodeEntities(m[1]), baseUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        u.hash = '';
        links.add(u.toString());
      }
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...links];
}

// Quote-aware: content="L'Assemblée ..." used to stop at the apostrophe
// (headline "L", description cut at "d'"), and a '>' inside a quoted value
// used to end the tag early.
function metaTags(html) {
  const out = {};
  const re = /<meta\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const key = (/(?:property|name|itemprop)\s*=\s*(["'])([^"']+)\1/i.exec(tag) || [])[2];
    const content = (/content\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag) || [])[2];
    if (key && content !== undefined && !(key.toLowerCase() in out)) out[key.toLowerCase()] = decodeEntities(content);
  }
  return out;
}

function validDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Optional per-source date rule (feeds.parser_config), for sites whose meta /
// <time> dates are wrong -- e.g. Garowe Online's template stamps every page
// <time datetime="2020-06-30"> while the visible "Posted On 07-10-2026,
// 10:48AM" is correct. Config: { date_after_label, date_format: 'DD-MM-YYYY'
// | 'MM-DD-YYYY' | 'YYYY-MM-DD', utc_offset: '+03:00' }. Takes the first date
// (optionally followed by a time, 12h or 24h) within 300 chars after the label.
function labelledDate(html, cfg) {
  if (!cfg || !cfg.date_after_label) return null;
  const at = html.indexOf(String(cfg.date_after_label));
  if (at < 0) return null;
  const window = cleanText(html.slice(at, at + 300), 300);
  const m = /(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[,\s]+(\d{1,2}):(\d{2})\s*([AP]M)?)?/i.exec(window);
  if (!m) return null;
  const n = (i) => parseInt(m[i], 10);
  const order = String(cfg.date_format || 'DD-MM-YYYY').toUpperCase();
  const [y, mo, d] = order.startsWith('YYYY') ? [n(1), n(2), n(3)]
    : order.startsWith('MM') ? [n(3), n(1), n(2)] : [n(3), n(2), n(1)];
  let h = m[4] ? n(4) : 0;
  if (m[6]) h = (h % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
  const offset = /^[+-]\d{2}:\d{2}$/.test(cfg.utc_offset || '') ? cfg.utc_offset : 'Z';
  const pad = (v) => String(v).padStart(2, '0');
  return validDate(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${m[5] || '00'}:00${offset}`);
}

// Reads link-preview metadata only -- never the article body.
function extractArticleMeta(html, url, parserConfig = {}) {
  const meta = metaTags(html);
  const titleTag = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
  const title = cleanText(meta['og:title'] || meta['twitter:title'] || titleTag || '', 500);
  const description = cleanText(meta['og:description'] || meta.description || meta['twitter:description'] || '', 1000);
  let image = meta['og:image'] || meta['twitter:image'] || null;
  if (image) {
    try {
      image = new URL(image, url).toString();
    } catch {
      image = null;
    }
  }
  const jsonLdDate = (/"datePublished"\s*:\s*"([^"]+)"/.exec(html) || [])[1];
  const timeTag = (/<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i.exec(html) || [])[1];
  const published = labelledDate(html, parserConfig)
    || validDate(meta['article:published_time'] || meta.datepublished || jsonLdDate || timeTag);
  const author = meta.author && !/^https?:/.test(meta.author) ? cleanText(meta.author, 200) : null;
  return { title, description, image, published, author };
}

async function loadRobots(origin, fetchImpl) {
  try {
    const { status, ok, text } = await fetchText(`${origin}/robots.txt`, fetchImpl);
    if (ok) return parseRobots(text);
    if (status >= 400 && status < 500) return 'allow-all';
    return 'disallow-all';
  } catch {
    return 'disallow-all';
  }
}

/**
 * @param {object} source  feeds row: feed_url, feed_type ('sitemap'|'html'),
 *   category_urls, article_url_patterns, allowed_domains, respect_robots_txt
 * @param {object} opts    { fetchImpl, maxArticles, delayMs, filterUnknown(urls) => Promise<string[]>, dryRun }
 */
async function crawlSource(source, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const maxArticles = Math.max(1, Math.min(opts.maxArticles || 20, 100));
  const baseDelay = opts.delayMs ?? 1000;
  const filterUnknown = opts.filterUnknown || (async (urls) => urls);
  const log = [];

  const start = validatePublicHttpUrl(source.feed_url);
  if (!start.ok) throw new Error(`Invalid source URL: ${start.error}`);
  const startUrl = start.url;
  const allowedDomains = (source.allowed_domains && source.allowed_domains.length > 0)
    ? source.allowed_domains
    : [domainOf(startUrl)];
  const respectRobots = source.respect_robots_txt !== false;

  const robotsCache = new Map();
  async function robotsFor(url) {
    if (!respectRobots) return 'allow-all';
    const origin = new URL(url).origin;
    if (!robotsCache.has(origin)) robotsCache.set(origin, await loadRobots(origin, fetchImpl));
    return robotsCache.get(origin);
  }
  async function allowed(url) {
    return isAllowed(await robotsFor(url), url);
  }

  // 1. Discover candidate URLs.
  let candidates = [];
  if (source.feed_type === 'sitemap') {
    if (!(await allowed(startUrl))) throw new Error(`robots.txt disallows ${startUrl}`);
    const { ok, status, text } = await fetchText(startUrl, fetchImpl);
    if (!ok) throw new Error(`Sitemap returned HTTP ${status}`);
    let parsed = parseSitemap(text);
    let urls = parsed.urls;
    for (const child of parsed.children.slice(0, MAX_CHILD_SITEMAPS)) {
      if (!hostMatches(child, allowedDomains) || !(await allowed(child))) continue;
      const res = await fetchText(child, fetchImpl);
      if (!res.ok) continue;
      try {
        urls = urls.concat(parseSitemap(res.text).urls);
      } catch (err) {
        log.push(`child sitemap ${child}: ${err.message}`);
      }
    }
    urls.sort((a, b) => String(b.lastmod || '').localeCompare(String(a.lastmod || '')));
    candidates = urls.map((u) => u.loc);
    log.push(`sitemap: ${candidates.length} URL(s) listed`);
  } else if (source.feed_type === 'html') {
    const pages = [startUrl, ...(source.category_urls || [])];
    for (const page of pages) {
      const v = validatePublicHttpUrl(page);
      if (!v.ok || !hostMatches(v.url, allowedDomains)) continue;
      if (!(await allowed(v.url))) {
        log.push(`robots.txt disallows listing page ${v.url}`);
        continue;
      }
      const res = await fetchText(v.url, fetchImpl);
      if (!res.ok) {
        log.push(`listing page ${v.url}: HTTP ${res.status}`);
        continue;
      }
      candidates.push(...extractLinks(res.text, v.url));
    }
    log.push(`html: ${candidates.length} link(s) found on ${pages.length} listing page(s)`);
  } else {
    throw new Error(`crawlSource does not handle feed_type "${source.feed_type}"`);
  }

  // 2. Filter: allowed domain, article pattern, de-duplicated.
  const seen = new Set();
  let filtered = [];
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (!validatePublicHttpUrl(url).ok) continue;
    if (!hostMatches(url, allowedDomains)) continue;
    if (!matchesArticlePatterns(url, source.article_url_patterns)) continue;
    filtered.push(url);
  }
  log.push(`${filtered.length} candidate article URL(s) after domain/pattern filtering`);

  filtered = await filterUnknown(filtered);
  let skippedRobots = 0;
  const items = [];
  let fetched = 0;

  // 3. Fetch article metadata, bounded and polite.
  for (const url of filtered) {
    if (fetched >= maxArticles) break;
    if (!(await allowed(url))) {
      skippedRobots += 1;
      continue;
    }
    const robots = await robotsFor(url);
    const robotsDelay = (crawlDelaySeconds(robots) || 0) * 1000;
    if (fetched > 0) await sleep(Math.min(Math.max(baseDelay, robotsDelay), MAX_DELAY_MS));
    fetched += 1;
    try {
      const res = await fetchText(url, fetchImpl);
      if (!res.ok) {
        log.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const meta = extractArticleMeta(res.text, url, source.parser_config || {});
      if (!meta.title) continue;
      items.push({
        title: meta.title,
        link: url,
        isoDate: meta.published,
        contentSnippet: meta.description,
        creator: meta.author,
        enclosure: meta.image ? { url: meta.image } : undefined,
      });
    } catch (err) {
      log.push(`${url}: ${err.message}`);
    }
  }
  if (skippedRobots > 0) log.push(`${skippedRobots} URL(s) skipped by robots.txt`);

  return { items, log, fetched, candidates: filtered.length };
}

module.exports = {
  crawlSource,
  extractArticleMeta,
  fetchText,
  loadRobots,
  extractLinks,
  parseSitemap,
  matchesArticlePatterns,
  patternToRegex,
  looksLikeArticlePath,
  USER_AGENT,
};
