const Parser = require('rss-parser');
const { parseSitemapNews } = require('@nouvellesdupays/shared/src/sitemapNews');
const { CATEGORIES } = require('@nouvellesdupays/shared/src/categories');
const { domainOf, hostMatches } = require('@nouvellesdupays/shared/src/urlSafety');
const {
  cleanText, cleanEmail, optionalUrl, requiredUrl, urlList, patternList, spamCheck, rejectForeignOrigin, requireJson,
} = require('./security');
const { recordServerConversion } = require('./tracking');
const { getSettings } = require('./settings');

const parser = new Parser({ timeout: 15000 });
const USER_AGENT = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; feed aggregator, polite polling)';
const FETCH_TIMEOUT_MS = 15000;

// Same fix as apps/worker/src/poll.js's escapeBareAmpersands -- some
// publishers ship XML with a bare "&" instead of "&amp;", which breaks the
// parser outright. Kept as a local copy rather than importing across app
// boundaries, since this is the only other place that needs it.
function escapeBareAmpersands(xml) {
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Tries one exact URL as an RSS/Atom feed -- same bar this project has
// always required for manually-curated feeds (a 200 status alone isn't
// enough; plenty of WordPress-style /feed paths return a valid-looking
// empty shell, or a plain HTML page with a 200, as FratMat's own /rss did).
async function tryParseRss(url) {
  let text;
  try {
    text = await fetchText(url);
  } catch (err) {
    return { verified: false, detail: `Could not reach ${url}: ${err.message}` };
  }

  let parsed;
  try {
    parsed = await parser.parseString(escapeBareAmpersands(text));
  } catch (err) {
    return { verified: false, detail: `${url} is not valid RSS/Atom XML: ${err.message}` };
  }

  const items = parsed.items || [];
  if (items.length === 0) {
    return { verified: false, detail: `${url} parsed but contains zero items` };
  }
  if (!items[0].title || !items[0].link) {
    return { verified: false, detail: `${url} items are missing a title/link` };
  }

  return {
    verified: true,
    feedType: 'rss',
    resolvedUrl: url,
    detail: `Verified: ${items.length} item(s) found, most recent: "${items[0].title}"`,
  };
}

// Tries one exact URL as a Google News Sitemap.
async function tryParseSitemapNews(url) {
  let text;
  try {
    text = await fetchText(url);
  } catch (err) {
    return { verified: false, detail: `Could not reach ${url}: ${err.message}` };
  }

  let items;
  try {
    items = parseSitemapNews(text);
  } catch (err) {
    return { verified: false, detail: `${url}: ${err.message}` };
  }

  if (items.length === 0) {
    return { verified: false, detail: `${url} has no <news:news> entries` };
  }

  return {
    verified: true,
    feedType: 'sitemap-news',
    resolvedUrl: url,
    detail: `Verified (news sitemap): ${items.length} article(s) found, most recent: "${items[0].title}"`,
  };
}

// Paths worth guessing on the publisher's own domain when the submitted
// feed_url doesn't work directly -- every one of these has been a real,
// working feed for a real outlet found by hand this same way (Le Parisien,
// BBC Afrique, and others across this project's history), just not always
// at the URL a submitter happens to type in.
const COMMON_FEED_PATHS = [
  '/feed', '/feed/', '/rss', '/rss/', '/rss.xml', '/feed.xml',
  '/atom.xml', '/index.xml', '/?feed=rss2', '/feeds/posts/default',
];

const SITEMAP_NEWS_PATHS = [
  '/sitemap-news.xml', '/news-sitemap.xml', '/sitemap_news.xml',
  '/wp-sitemap-news.xml', '/sitemap.xml',
];

async function discoverAlternates(homepageUrl, paths, tryFn) {
  let base;
  try {
    base = new URL(homepageUrl);
  } catch {
    return null;
  }
  for (const path of paths) {
    const candidate = new URL(path, base).toString();
    const result = await tryFn(candidate);
    if (result.verified) return result;
  }
  return null;
}

// Looks for a feed the homepage explicitly announces via
// <link rel="alternate" type="application/rss+xml"|"application/atom+xml">
// -- a more reliable signal than guessing common paths, since the site is
// telling us directly where its feed lives. Found via Sikafinance, whose
// real feed (/rss/actualites_bourse_brvm) sits at a path no common-path
// guess would ever produce, but was announced in their own <head> all along.
async function discoverAnnouncedFeed(homepageUrl) {
  let html;
  try {
    html = await fetchText(homepageUrl);
  } catch {
    return null;
  }

  const linkTagRe = /<link\b[^>]*>/gi;
  const hrefRe = /href\s*=\s*["']([^"']+)["']/i;
  const relAlternateRe = /rel\s*=\s*["']alternate["']/i;
  const feedTypeRe = /type\s*=\s*["']application\/(?:rss|atom)\+xml["']/i;

  let match;
  while ((match = linkTagRe.exec(html)) !== null) {
    const tag = match[0];
    if (!relAlternateRe.test(tag) || !feedTypeRe.test(tag)) continue;

    const hrefMatch = hrefRe.exec(tag);
    if (!hrefMatch) continue;

    let candidate;
    try {
      candidate = new URL(hrefMatch[1], homepageUrl).toString();
    } catch {
      continue;
    }

    const result = await tryParseRss(candidate);
    if (result.verified) return result;
  }

  return null;
}

// Orchestrates the full chain: the exact submitted URL as RSS, then a feed
// the homepage itself announces, then common feed-path guesses, then a
// Google News Sitemap -- authoritative/explicit signals before guesses,
// since RSS is the richer format (summary/author/category) when it exists.
async function verifyFeedUrl(feedUrl, homepageUrl) {
  const direct = await tryParseRss(feedUrl);
  if (direct.verified) return direct;

  const announced = await discoverAnnouncedFeed(homepageUrl);
  if (announced) {
    return { ...announced, detail: `${announced.detail} (auto-discovered via the homepage's own announced feed link, not the submitted URL)` };
  }

  const discoveredRss = await discoverAlternates(homepageUrl, COMMON_FEED_PATHS, tryParseRss);
  if (discoveredRss) {
    return { ...discoveredRss, detail: `${discoveredRss.detail} (auto-discovered, not the submitted URL)` };
  }

  const discoveredSitemap = await discoverAlternates(homepageUrl, SITEMAP_NEWS_PATHS, tryParseSitemapNews);
  if (discoveredSitemap) {
    return { ...discoveredSitemap, detail: `${discoveredSitemap.detail} (auto-discovered, not the submitted URL)` };
  }

  return {
    verified: false,
    detail: `${direct.detail}. Also checked the homepage's announced feed link, common feed paths, and a news sitemap on ${homepageUrl} -- none worked either.`,
  };
}

const PUBLISHER_CATEGORIES = [...CATEGORIES.filter((c) => c !== 'other'), 'culture', 'education', 'environment', 'society', 'international', 'local', 'other'];
const SOCIAL_HOSTS = {
  youtube_url: ['youtube.com', 'youtu.be'],
  facebook_url: ['facebook.com', 'fb.com'],
  x_url: ['x.com', 'twitter.com'],
  instagram_url: ['instagram.com'],
  tiktok_url: ['tiktok.com'],
};

// Validates and normalises every field of the public registration form.
// Returns { data } or { error }.
function validateRegistration(body) {
  const name = cleanText(body.name, 200);
  const language = cleanText(body.language, 20);
  if (!name || !body.homepage_url || !body.country_iso || !language) {
    return { error: 'name, homepage_url, country_iso, and language are all required' };
  }
  const homepage = requiredUrl(body.homepage_url, 'homepage_url');
  if (homepage.error) return { error: homepage.error };

  const data = {
    name,
    language,
    homepage_url: homepage.value,
    domain: domainOf(homepage.value),
    country_iso: String(body.country_iso).toUpperCase().slice(0, 2),
    region: cleanText(body.region, 120),
    city: cleanText(body.city, 120),
    description: cleanText(body.description, 2000),
    contact_name: cleanText(body.contact_name, 120),
    contact_email: null,
    permission_confirmed: body.permission_confirmed === true,
  };

  if (body.contact_email) {
    data.contact_email = cleanEmail(body.contact_email);
    if (!data.contact_email) return { error: 'contact_email is not a valid email address' };
  }

  const categories = Array.isArray(body.categories) ? body.categories : [];
  if (categories.some((c) => !PUBLISHER_CATEGORIES.includes(c))) return { error: 'Unknown news category' };
  data.categories = [...new Set(categories)].slice(0, 12);

  for (const [field, hosts] of Object.entries(SOCIAL_HOSTS)) {
    const r = optionalUrl(body[field], field, { hosts });
    if (r.error) return { error: r.error };
    data[field] = r.value;
  }
  for (const field of ['feed_url', 'api_url', 'logo_url', 'sitemap_url']) {
    const r = optionalUrl(body[field], field);
    if (r.error) return { error: r.error };
    data[field] = r.value;
  }
  const categoryUrls = urlList(body.category_urls, 'category_urls', 10);
  if (categoryUrls.error) return { error: categoryUrls.error };
  data.category_urls = categoryUrls.value;
  const patterns = patternList(body.article_url_patterns, 10);
  if (patterns.error) return { error: patterns.error };
  data.article_url_patterns = patterns.value;

  // Crawl-able URLs must live on the publisher's own site.
  for (const u of [data.sitemap_url, ...data.category_urls].filter(Boolean)) {
    if (!hostMatches(u, [data.domain])) return { error: `${u} is not on ${data.domain}` };
  }
  return { data };
}

function registerPublisherSubmissionRoute(fastify) {
  const pool = fastify.pg;

  fastify.post(
    '/api/publishers/register',
    {
      preHandler: [rejectForeignOrigin, requireJson],
      config: {
        // Much stricter than the general 100/min API limit -- this is an
        // unauthenticated write endpoint that also does an outbound fetch
        // per request, a real abuse surface a read-only GET doesn't have.
        rateLimit: { max: 5, timeWindow: '1 hour' },
      },
    },
    async (req, reply) => {
      const body = req.body || {};
      const settings = await getSettings(pool);
      if (!settings.publisher_submissions_open) {
        return reply.code(503).send({ error: 'Publisher registration is temporarily closed' });
      }

      const spam = spamCheck(body);
      if (spam) {
        req.log.warn({ reason: spam }, 'publisher registration rejected by spam check');
        return reply.code(400).send({ error: 'Submission rejected', reason: spam });
      }

      const validated = validateRegistration(body);
      if (validated.error) return reply.code(400).send({ error: validated.error });
      const data = validated.data;

      if (!data.permission_confirmed) {
        return reply.code(400).send({ error: 'Please confirm you have permission to submit this website' });
      }

      const { rows: countryRows } = await pool.query(
        `SELECT id, iso_code FROM countries WHERE iso_code = $1`,
        [data.country_iso]
      );
      if (countryRows.length === 0) {
        return reply.code(400).send({ error: `Unknown country_iso "${data.country_iso}"` });
      }
      const countryId = countryRows[0].id;

      // Duplicate website: same domain already a publisher (any country --
      // a per-country edition is added by an admin, not self-service), or
      // already awaiting review.
      const { rows: dupSites } = await pool.query(
        `SELECT 1 FROM publishers WHERE domain = $1 OR domain LIKE $1 || '/%'
         UNION ALL
         SELECT 1 FROM publisher_submissions WHERE domain = $1 AND status IN ('submitted', 'pending', 'approved', 'active')`,
        [data.domain]
      );
      if (dupSites.length > 0) {
        return reply.code(409).send({ error: 'This website is already registered or pending review' });
      }

      let status;
      let feedUrl = null;
      let feedType = null;
      let feedVerified = false;
      let verificationDetail = null;
      let ingestionMethod;

      if (data.feed_url) {
        // Original flow, unchanged: a submitted feed must verify (real items,
        // not just a 200) before the submission is accepted.
        const verification = await verifyFeedUrl(data.feed_url, data.homepage_url);
        if (!verification.verified) {
          return reply.code(422).send({
            error: 'Feed verification failed',
            detail: verification.detail,
          });
        }

        // Duplicate check happens against the RESOLVED url (what actually
        // verified), not necessarily what was typed -- two submitters could
        // type different broken URLs that both auto-discover to the same
        // real feed.
        const { rows: dupeRows } = await pool.query(
          `SELECT 1 FROM feeds WHERE feed_url = $1
           UNION ALL
           SELECT 1 FROM publisher_submissions WHERE feed_url = $1 AND status IN ('submitted', 'pending')`,
          [verification.resolvedUrl]
        );
        if (dupeRows.length > 0) {
          return reply.code(409).send({ error: 'This feed is already registered or pending review' });
        }
        status = 'pending';
        feedUrl = verification.resolvedUrl;
        feedType = verification.feedType;
        feedVerified = true;
        verificationDetail = verification.detail;
        ingestionMethod = 'feed';
      } else {
        // No feed: nothing is fetched now. An admin reviews the site,
        // configures the source (sitemap or listing pages + URL patterns,
        // robots.txt, frequency) and only then activates crawling.
        if (!data.contact_email) {
          return reply.code(400).send({ error: 'contact_email is required when no RSS/Atom feed is provided' });
        }
        status = 'submitted';
        ingestionMethod = data.api_url ? 'api' : data.sitemap_url ? 'sitemap' : 'html';
        verificationDetail = 'No feed provided -- awaiting manual review and source configuration.';
      }

      const { rows } = await pool.query(
        `INSERT INTO publisher_submissions
           (name, homepage_url, feed_url, feed_type, country_id, language, contact_email, feed_verified,
            verification_detail, status, domain, region, city, description, categories, contact_name,
            youtube_url, facebook_url, x_url, instagram_url, tiktok_url, api_url, logo_url, sitemap_url,
            category_urls, article_url_patterns, ingestion_method, permission_confirmed, status_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                 $21, $22, $23, $24, $25, $26, $27, $28, now())
         RETURNING id`,
        [
          data.name, data.homepage_url, feedUrl, feedType, countryId, data.language, data.contact_email,
          feedVerified, verificationDetail, status, data.domain, data.region, data.city, data.description,
          data.categories, data.contact_name, data.youtube_url, data.facebook_url, data.x_url,
          data.instagram_url, data.tiktok_url, data.api_url, data.logo_url, data.sitemap_url,
          data.category_urls, data.article_url_patterns, ingestionMethod, data.permission_confirmed,
        ]
      );

      const eventId = await recordServerConversion(pool, req, body.tracking, {
        name: 'PublisherRegistrationCompleted',
        country_iso: countryRows[0].iso_code,
        email: data.contact_email,
        properties: { ingestion_method: ingestionMethod, has_feed: Boolean(feedUrl) },
      });

      return reply.code(201).send({
        id: rows[0].id,
        status,
        feed_type: feedType,
        ingestion_method: ingestionMethod,
        verification: verificationDetail,
        message: feedUrl
          ? 'Feed verified and submitted for review.'
          : 'Website submitted. Our team will review it and configure the source before it goes live.',
        conversion_event_id: eventId,
      });
    }
  );
}

module.exports = {
  registerPublisherSubmissionRoute,
  validateRegistration,
  verifyFeedUrl,
  tryParseRss,
  tryParseSitemapNews,
  discoverAnnouncedFeed,
  escapeBareAmpersands,
  PUBLISHER_CATEGORIES,
};
