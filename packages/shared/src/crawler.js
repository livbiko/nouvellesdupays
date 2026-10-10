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
  return {
    status: res.status, ok: res.ok, url: res.url || url,
    text: res.ok ? (await res.text()).slice(0, MAX_BODY_BYTES) : '',
  };
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

// --- Generic-title guard -------------------------------------------------
// Some sites give every page the same link-preview title (the site name, a
// section name, or an error page served with HTTP 200). On 2026-10-09/10,
// L'Essor, Inforpress and Trust Radio produced "articles" titled "Lessor -
// Toute l'actualité en continu", "Inforpress - Sociedade" and "Ccontent Not
// Found | Trust Radio". Such a title is replaced by the article's JSON-LD
// headline or its single <h1> when those are real headlines; otherwise the
// page is skipped (and counted in the crawl log).
const ERROR_TITLE_RE = /\b(c?content not found|page not found|not found|page introuvable|introuvable|p[aá]gina n[aã]o encontrada|erreur 404|error 404|something went wrong|etwas ist schief|access denied|forbidden|search results|r[eé]sultats de (la )?recherche|resultados d[ae] (la )?pesquisa|resultados de b[uú]squeda)\b|^\s*(404|403|500)\b/i;

function normTitle(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// ctx: { generic: Set of normalised listing-page titles, siteNames: Set of normalised site names }
function isGenericTitle(title, ctx = {}) {
  const n = normTitle(title);
  if (!n) return true;
  if (ERROR_TITLE_RE.test(title)) return true;
  if (ctx.generic && ctx.generic.has(n)) return true;
  for (const site of ctx.siteNames || []) {
    if (!site) continue;
    if (n === site) return true;
    // "Inforpress - Sociedade": the site name plus at most two words (a section label).
    let rest = null;
    if (n.startsWith(`${site} `)) rest = n.slice(site.length + 1);
    else if (n.endsWith(` ${site}`)) rest = n.slice(0, -(site.length + 1));
    if (rest !== null && rest.split(' ').filter(Boolean).length <= 2) return true;
  }
  return false;
}

function jsonLdHeadline(html) {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : (data && Array.isArray(data['@graph'])) ? data['@graph'] : [data];
    for (const node of nodes) {
      const type = [].concat((node && node['@type']) || []).join(' ');
      if (node && typeof node.headline === 'string' && /Article|Posting|Report/i.test(type)) {
        return cleanText(decodeEntities(node.headline), 500);
      }
    }
  }
  return null;
}

function h1Texts(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => cleanText(decodeEntities(m[1].replace(/<[^>]+>/g, ' ')), 500))
    .filter(Boolean);
}

// True when an article URL ended up on the homepage or on one of the listing pages.
function redirectedToListing(askedUrl, finalUrl, listingPages) {
  if (!finalUrl || finalUrl === askedUrl) return false;
  try {
    const asked = new URL(askedUrl).pathname.replace(/\/+$/, '');
    const landed = new URL(finalUrl).pathname.replace(/\/+$/, '');
    if (landed === asked) return false;
    return landed === '' || listingPages.has(finalUrl);
  } catch {
    return false;
  }
}

// Reads link-preview metadata -- and, only when that title is generic, the
// article's JSON-LD headline or single <h1> -- never the article body.
// titleSource: 'meta' | 'jsonld' | 'h1' | null (null: no usable headline, skip the page).
function extractArticleMeta(html, url, parserConfig = {}, ctx = {}) {
  const meta = metaTags(html);
  const titleTag = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
  const siteNames = new Set([...(ctx.siteNames || []), normTitle(meta['og:site_name'])].filter(Boolean));
  const gctx = { generic: ctx.generic, siteNames };
  const metaTitle = cleanText(meta['og:title'] || meta['twitter:title'] || titleTag || '', 500);
  let title = metaTitle;
  let titleSource = 'meta';
  if (isGenericTitle(metaTitle, gctx)) {
    const ld = jsonLdHeadline(html);
    const h1s = h1Texts(html).filter((h) => !isGenericTitle(h, gctx));
    if (ld && !isGenericTitle(ld, gctx)) {
      title = ld;
      titleSource = 'jsonld';
    } else if (h1s.length === 1 && h1s[0].split(/\s+/).length >= 4) {
      title = h1s[0];
      titleSource = 'h1';
    } else {
      title = '';
      titleSource = null;
    }
  }
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
  return { title, titleSource, description, image, published, author };
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
  const listingTitles = new Set();
  const listingPages = new Set();
  const siteNames = new Set();
  const skipped = { generic: 0, redirected: 0, repeated: 0 };
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
    pages.forEach((p) => listingPages.add(p));
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
      // A listing page's own title (homepage, section) is never an article headline.
      const lm = metaTags(res.text);
      const lt = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(res.text) || [])[1];
      for (const t of [lm['og:title'], lm['twitter:title'], lt]) {
        if (!t) continue;
        const nt = normTitle(decodeEntities(t));
        listingTitles.add(nt);
        // A short listing title ("Inforpress", "Inforpress - Notícias") names the site.
        const head = normTitle(decodeEntities(t).split(/\s[-|–—:]\s/)[0]);
        for (const cand of [nt, head]) if (cand && cand.split(' ').length <= 3) siteNames.add(cand);
      }
      if (lm['og:site_name']) siteNames.add(normTitle(lm['og:site_name']));
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
      // An article URL that lands on the homepage or a listing page is not an article (L'Essor).
      if (redirectedToListing(url, res.url, listingPages)) {
        skipped.redirected += 1;
        continue;
      }
      const meta = extractArticleMeta(res.text, url, source.parser_config || {}, { generic: listingTitles, siteNames });
      if (!meta.title) {
        skipped.generic += 1;
        continue;
      }
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

  // The same title on several different URLs in one run is a template title, not a headline.
  const counts = new Map();
  for (const it of items) counts.set(normTitle(it.title), (counts.get(normTitle(it.title)) || 0) + 1);
  const kept = items.filter((it) => counts.get(normTitle(it.title)) < 2);
  skipped.repeated = items.length - kept.length;
  if (skipped.generic || skipped.redirected || skipped.repeated) {
    log.push(`skipped: ${skipped.generic} with no real headline (generic or error title), `
      + `${skipped.redirected} redirected to a listing page, ${skipped.repeated} with a title repeated across pages`);
  }

  return { items: kept, log, fetched, candidates: filtered.length, skipped };
}

module.exports = {
  crawlSource,
  extractArticleMeta,
  isGenericTitle,
  normTitle,
  fetchText,
  loadRobots,
  extractLinks,
  parseSitemap,
  matchesArticlePatterns,
  patternToRegex,
  looksLikeArticlePath,
  USER_AGENT,
};
