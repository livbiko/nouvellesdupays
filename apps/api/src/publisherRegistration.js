const Parser = require('rss-parser');
const { parseSitemapNews } = require('@nouvellesdupays/shared/src/sitemapNews');

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

// Orchestrates the full chain: the exact submitted URL as RSS, then common
// feed-path guesses on the same domain as RSS, then a Google News Sitemap
// on the same domain -- in that order, since RSS is the richer format
// (summary/author/category) when it exists at all.
async function verifyFeedUrl(feedUrl, homepageUrl) {
  const direct = await tryParseRss(feedUrl);
  if (direct.verified) return direct;

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
    detail: `${direct.detail}. Also tried common feed paths and a news sitemap on ${homepageUrl} -- none worked either.`,
  };
}

function registerPublisherSubmissionRoute(fastify) {
  const pool = fastify.pg;

  fastify.post(
    '/api/publishers/register',
    {
      config: {
        // Much stricter than the general 100/min API limit -- this is an
        // unauthenticated write endpoint that also does an outbound fetch
        // per request, a real abuse surface a read-only GET doesn't have.
        rateLimit: { max: 5, timeWindow: '1 hour' },
      },
    },
    async (req, reply) => {
      const { name, homepage_url, feed_url, country_iso, language, contact_email } = req.body || {};

      if (!name || !homepage_url || !feed_url || !country_iso || !language) {
        return reply.code(400).send({
          error: 'name, homepage_url, feed_url, country_iso, and language are all required',
        });
      }

      let country_id;
      try {
        new URL(homepage_url);
        new URL(feed_url);
      } catch {
        return reply.code(400).send({ error: 'homepage_url and feed_url must be valid URLs' });
      }

      const { rows: countryRows } = await pool.query(
        `SELECT id FROM countries WHERE iso_code = $1`,
        [country_iso.toUpperCase()]
      );
      if (countryRows.length === 0) {
        return reply.code(400).send({ error: `Unknown country_iso "${country_iso}"` });
      }
      country_id = countryRows[0].id;

      const verification = await verifyFeedUrl(feed_url, homepage_url);
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
         SELECT 1 FROM publisher_submissions WHERE feed_url = $1 AND status = 'pending'`,
        [verification.resolvedUrl]
      );
      if (dupeRows.length > 0) {
        return reply.code(409).send({ error: 'This feed is already registered or pending review' });
      }

      const { rows } = await pool.query(
        `INSERT INTO publisher_submissions
           (name, homepage_url, feed_url, feed_type, country_id, language, contact_email, feed_verified, verification_detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING id`,
        [name, homepage_url, verification.resolvedUrl, verification.feedType, country_id, language, contact_email || null, verification.detail]
      );

      return reply.code(201).send({
        id: rows[0].id,
        status: 'pending',
        feed_type: verification.feedType,
        verification: verification.detail,
        message: 'Feed verified and submitted for review.',
      });
    }
  );
}

module.exports = {
  registerPublisherSubmissionRoute,
  verifyFeedUrl,
  tryParseRss,
  tryParseSitemapNews,
  escapeBareAmpersands,
};
