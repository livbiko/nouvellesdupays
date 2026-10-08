// Pure analysis helpers for the media discovery worker
// (apps/worker/src/discover.js): no network, no DB, so every rule here is
// unit-tested on fixed HTML. The worker does the fetching (robots.txt
// respected) and the storing.
const { validatePublicHttpUrl } = require('./urlSafety');
const { extractLinks, looksLikeArticlePath } = require('./crawler');
const { decodeEntities, cleanText } = require('./text');

// Two-letter country-code TLDs that are mostly sold as generic domains, so
// they say nothing about where a site is from (.co, .tv, .me, .io, .ly ...).
// Not here on purpose: .ml .ga .cf .gq .cd (once free Freenom domains, but real
// African news TLDs -- spam on them is caught by the spam signals instead).
const GENERIC_CCTLDS = new Set(['co', 'tv', 'me', 'io', 'ly', 'fm', 'am', 'cc', 'ws', 'to', 'ai', 'gg', 'sh', 'la', 'nu', 'tk']);

// Hosts that are never a news candidate even when a news site links to them.
const IGNORED_HOSTS = [
  'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'linkedin.com', 'whatsapp.com', 'wa.me', 't.me', 'telegram.me', 'pinterest.com', 'snapchat.com', 'threads.net',
  'google.com', 'goo.gl', 'googleusercontent.com', 'gstatic.com', 'googleapis.com', 'doubleclick.net', 'googlesyndication.com',
  'apple.com', 'microsoft.com', 'bing.com', 'yahoo.com', 'wikipedia.org', 'wikimedia.org', 'archive.org',
  'wordpress.org', 'wordpress.com', 'wp.com', 'gravatar.com', 'w3.org', 'schema.org', 'cloudflare.com', 'jquery.com',
  'bit.ly', 'tinyurl.com', 'addtoany.com', 'sharethis.com', 'disqus.com', 'mailchimp.com', 'feedburner.com',
  'paypal.com', 'amazon.com', 'play.google.com', 'apps.apple.com', 'soundcloud.com', 'spotify.com', 'vimeo.com', 'dailymotion.com',
  'creativecommons.org', 'jetpack.com', 'tagdiv.com', 'themeforest.net', 'elementor.com', 'nouvellesdupays.com',
];

// A generic-TLD site (.com/.net/.info) linked from a regional outlet is only
// taken when its name or TLD looks like media; the check step then confirms
// it really publishes news (health 'not_news' otherwise).
const NEWSY_TLDS = new Set(['info', 'news', 'africa', 'press', 'media', 'online', 'tv', 'fm', 'radio']);
const NEWSY_NAME = /(online|news|info|actu|times|post|tribune|journal|media|m[eé]dia|t[eé]l[eé]|tv|radio|fm|presse|press|express|daily|herald|gazette|observ|mail|guardian|matin|soir|hebdo|quotidien|reporter|chronicle|voice|voix|echo|nouvelle|monitor|standard|nation|independent|punch|vanguard|leader|sun|star|mirror|courrier|inter|direct|live|24)/i;

const SOCIAL_RULES = {
  youtube_url: { hosts: ['youtube.com'], path: /^\/(@[\w.-]+|channel\/[\w-]+|c\/[^/]+|user\/[^/]+)\/?$/i },
  facebook_url: { hosts: ['facebook.com', 'fb.com'], path: /^\/(?!sharer|share|dialog|plugins|tr\b|groups\/?$|login|watch\/?$|events\/?$|profile\.php\/?$)[\w.-]{2,}\/?$/i },
  x_url: { hosts: ['twitter.com', 'x.com'], path: /^\/(?!intent|share|home|search|i\/)[A-Za-z0-9_]{1,15}\/?$/ },
  instagram_url: { hosts: ['instagram.com'], path: /^\/(?!p\/|reel\/|explore|accounts)[\w.]{1,30}\/?$/i },
  tiktok_url: { hosts: ['tiktok.com'], path: /^\/@[\w.-]{2,}\/?$/i },
};

// Strong hijacked/parked/spam markers. A real news site can mention betting
// in an article, so single words only count in the <title> / meta
// description; body text needs several distinct hits.
const SPAM_STRONG = /\b(casino|slot ?gacor|judi|togel|poker online|bet365|1xbet|melbet|sportsbook|xxx|porn|viagra|cialis|escort|replica watches|payday loans?|domain (?:is )?for sale|buy this domain|this domain (?:may be|is) for sale|parked free|hugedomains|sedo\.com|dan\.com)\b/gi;

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostIn(host, list) {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

// Candidate URL -> { ok, homepage, domain } with the same SSRF guard as every
// other URL this project fetches. The homepage is the site root: discovery is
// about sites, not individual pages.
function normalizeCandidateUrl(input) {
  const v = validatePublicHttpUrl(input);
  if (!v.ok) return { ok: false, error: v.error };
  const u = new URL(v.url);
  const domain = u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!domain.includes('.')) return { ok: false, error: 'Host must be a public domain name' };
  return { ok: true, homepage: `${u.protocol}//${u.host}/`, domain };
}

// ".ci" -> 'CI' when the TLD is a real country signal and that country is one
// we know (isoCodes: Set of upper-case ISO codes). Also handles .com.gh,
// .co.ke, .gov.ng style second-level domains.
function countryFromDomain(domain, isoCodes) {
  const tld = String(domain || '').split('.').pop().toLowerCase();
  if (tld.length !== 2 || GENERIC_CCTLDS.has(tld)) return null;
  const iso = tld === 'uk' ? 'GB' : tld.toUpperCase();
  return isoCodes && !isoCodes.has(iso) ? null : iso;
}

function firstMatch(re, html) {
  const m = re.exec(html);
  return m ? cleanText(decodeEntities(m[1]), 300) : null;
}

// Quote-aware on purpose: content="Quotidien d'information" must not stop at
// the apostrophe (nor a '>' inside a quoted value end the tag).
function metaContent(html, key) {
  const tagRe = /<meta\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
  const keyRe = new RegExp(`(?:property|name)\\s*=\\s*["']${key}["']`, 'i');
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (!keyRe.test(m[0])) continue;
    const c = /content\s*=\s*(["'])([\s\S]*?)\1/i.exec(m[0]);
    return c ? cleanText(decodeEntities(c[2]), 500) : null;
  }
  return null;
}

// Most-linked official account per platform. Share buttons, intents and
// single posts are excluded by the path rules, so what remains is the
// profile the site itself points to.
function extractSocialLinks(links) {
  const out = {};
  for (const [field, rule] of Object.entries(SOCIAL_RULES)) {
    const counts = new Map();
    for (const link of links) {
      let u;
      try {
        u = new URL(link);
      } catch {
        continue;
      }
      const host = u.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, '');
      if (!hostIn(host, rule.hosts) || !rule.path.test(u.pathname)) continue;
      const clean = `https://${rule.hosts[0] === 'twitter.com' ? 'x.com' : host}${u.pathname.replace(/\/$/, '')}`;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out[field] = best[0];
  }
  return out;
}

// <link rel="alternate" type="application/rss+xml|atom+xml" href> on the page.
function extractAnnouncedFeeds(html, baseUrl) {
  const feeds = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    if (!/rel\s*=\s*["'][^"']*alternate/i.test(tag)) continue;
    if (!/type\s*=\s*["']application\/(?:rss|atom)\+xml["']/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    try {
      const u = new URL(decodeEntities(href[1]), baseUrl).toString();
      if (!/comments?\/feed|\/comments\b/i.test(u) && !feeds.includes(u)) feeds.push(u);
    } catch {
      // ignore
    }
  }
  return feeds;
}

function spamSignals(html, title, description) {
  const head = `${title || ''} ${description || ''}`;
  const headHits = head.match(SPAM_STRONG) || [];
  const bodyText = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const bodyHits = new Set((bodyText.match(SPAM_STRONG) || []).map((s) => s.toLowerCase()));
  const signals = [];
  if (headHits.length) signals.push(`spam words in title/description: ${[...new Set(headHits.map((s) => s.toLowerCase()))].join(', ')}`);
  if (bodyHits.size >= 3) signals.push(`spam words in page: ${[...bodyHits].slice(0, 5).join(', ')}`);
  return signals;
}

// Everything the worker learns from one homepage fetch.
function analyseHomepage(html, url) {
  const host = hostOf(url);
  const links = extractLinks(html, url);
  const title = metaContent(html, 'og:site_name') || firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const description = metaContent(html, 'og:description') || metaContent(html, 'description');
  const langRaw = firstMatch(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i, html);
  const sameSite = links.filter((l) => hostOf(l) === host);
  const articleLinks = new Set(sameSite.filter((l) => {
    try {
      return looksLikeArticlePath(new URL(l).pathname);
    } catch {
      return false;
    }
  }));
  const hasIdentityPage = sameSite.some((l) => /\/(contact|contactez|nous-contacter|about|a-propos|apropos|qui-sommes|who-we-are|mentions-legales|impressum|equipe|team|redaction)/i.test(l));
  return {
    title,
    description,
    lang: langRaw ? langRaw.slice(0, 2).toLowerCase() : null,
    socials: extractSocialLinks(links),
    announcedFeeds: extractAnnouncedFeeds(html, url),
    articleLinkCount: articleLinks.size,
    hasIdentityPage,
    spam: spamSignals(html, title, description),
    links,
  };
}

// External sites a news homepage links to -- partner outlets, blogrolls,
// "nos sites" footers. Only candidates that plausibly are news outlets of the
// region: a country TLD from `isoCodes`, or a news-like name (then the
// referring publisher's country is assumed, and flagged as such).
function extractOutlinkCandidates(links, baseUrl, { isoCodes } = {}) {
  const self = hostOf(baseUrl);
  const byDomain = new Map();
  for (const link of links) {
    const n = normalizeCandidateUrl(link);
    if (!n.ok || n.domain === self || hostIn(n.domain, IGNORED_HOSTS)) continue;
    if (self && (n.domain.endsWith(`.${self}`) || self.endsWith(`.${n.domain}`))) continue;
    // Ministries/universities aren't news outlets; add official media by hand.
    if (/(^|\.)(gouv|gov|edu|ac|mil)\.[a-z]{2}$|\.(gov|edu|int|mil)$/.test(n.domain)) continue;
    if (byDomain.has(n.domain)) continue;
    const country = countryFromDomain(n.domain, isoCodes);
    const newsy = NEWSY_TLDS.has(n.domain.split('.').pop()) || NEWSY_NAME.test(n.domain.split('.').slice(0, -1).join('.'));
    if (!country && !newsy) continue;
    if (isoCodes && country === null && /\.[a-z]{2}$/.test(n.domain) && !GENERIC_CCTLDS.has(n.domain.split('.').pop())) continue; // other country's ccTLD
    byDomain.set(n.domain, { homepage: n.homepage, domain: n.domain, country, countryFromTld: Boolean(country) });
  }
  return [...byDomain.values()];
}

function guessSourceType(domain, title) {
  const s = `${domain} ${title || ''}`.toLowerCase();
  if (/\b(blogspot|blog)\b|\.blogspot\./.test(s)) return 'BLOG';
  if (/\b(agence|agency|news agency|presse africaine)\b/.test(s)) return 'NEWS_AGENCY';
  if (/(^|[^a-z])(tv|t[eé]l[eé](vision)?|television)([^a-z]|$)/.test(s)) return 'TV';
  if (/(^|[^a-z])(radio|fm)([^a-z]|$)/.test(s)) return 'RADIO';
  if (/\b(sport|sports|foot|football)\b/.test(s)) return 'SPORTS';
  if (/\b(business|finance|economi[ce]|[ée]conomie|bourse)\b/.test(s)) return 'FINANCIAL';
  if (/\b(tech|digital|num[ée]rique)\b/.test(s)) return 'TECHNOLOGY';
  return 'ONLINE_NEWS';
}

// Explainable 0-100 score (stored in source_scores.score_breakdown). It
// ranks the review queue; it is never a reason to publish on its own.
function scoreCandidate(f, now = new Date()) {
  const b = {};
  b.reachable = f.reachable ? 15 : 0;
  b.feed = { rss: 20, atom: 20, 'sitemap-news': 16, sitemap: 6 }[f.feedType] || 0;
  const ageDays = f.latestItemAt ? (now - new Date(f.latestItemAt)) / 86400000 : null;
  b.freshness = ageDays === null ? 0 : ageDays <= 2 ? 20 : ageDays <= 7 ? 14 : ageDays <= 30 ? 6 : 0;
  b.news_like = f.articleLinkCount >= 20 ? 12 : f.articleLinkCount >= 8 ? 7 : f.articleLinkCount >= 3 ? 3 : 0;
  b.country_relevance = f.countryFromTld ? 10 : f.countryKnown ? 4 : 0;
  b.identity = (f.hasIdentityPage ? 6 : 0) + (f.title ? 2 : 0);
  b.social_presence = Math.min(5, f.socialCount || 0) * 2;
  b.multiple_referrers = Math.min(3, Math.max(0, (f.timesSeen || 1) - 1)) * 1;
  let total = Object.values(b).reduce((a, v) => a + v, 0);
  if (f.spam && f.spam.length) {
    b.spam_penalty = -total;
    total = 0;
  }
  total = Math.max(0, Math.min(100, total));
  const band = total >= 80 ? 'priority' : total >= 65 ? 'high' : total >= 50 ? 'good' : total >= 30 ? 'moderate' : 'low';
  return { total, breakdown: b, band };
}

module.exports = {
  normalizeCandidateUrl,
  countryFromDomain,
  extractSocialLinks,
  extractAnnouncedFeeds,
  analyseHomepage,
  extractOutlinkCandidates,
  guessSourceType,
  scoreCandidate,
  spamSignals,
  GENERIC_CCTLDS,
};
