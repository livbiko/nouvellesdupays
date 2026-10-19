const crypto = require('crypto');
const Parser = require('rss-parser');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { categorize } = require('@nouvellesdupays/shared/src/categories');
const { parseSitemapNews } = require('@nouvellesdupays/shared/src/sitemapNews');
const { crawlSource } = require('@nouvellesdupays/shared/src/crawler');
const { cleanHeadline } = require('@nouvellesdupays/shared/src/text');
const { parseArabicDate } = require('@nouvellesdupays/shared/src/dates');

const parser = new Parser({ timeout: 15000 });
const MAX_AGE_DAYS = 14;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const USER_AGENT = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; feed aggregator, polite polling)';

// Some publishers ship XML with bare "&" instead of "&amp;" (e.g. "Lycee 1 & 2"),
// which is invalid XML and breaks the parser outright. Escape only bare "&" --
// ones not already starting a real entity -- rather than rejecting the whole feed.
function escapeBareAmpersands(xml) {
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');
}

function dedupHash(publisherId, headline) {
  const normalized = (headline || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(`${publisherId}:${normalized}`).digest('hex');
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchRssFeed(feed) {
  const headers = { 'User-Agent': USER_AGENT };
  if (feed.etag) headers['If-None-Match'] = feed.etag;
  if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified;

  // rss-parser's own `timeout` option only bounds the XML-parsing step on
  // text already in hand -- the network fetch() below had no timeout at
  // all. A single feed with a hanging TCP connection (found via a wider,
  // more geographically diverse feed set in the Asia expansion) could
  // block a worker-pool slot indefinitely, eventually starving the whole
  // poll past the CronJob deadline even with fetch-level concurrency fixed.
  const res = await fetch(feed.feed_url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 304) {
    return { notModified: true };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed = await parser.parseString(escapeBareAmpersands(text));
  return {
    notModified: false,
    parsed,
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  };
}

// Google News Sitemap ingestion -- for outlets with no RSS at all but that
// publish the standard <news:news> sitemap format most CMSs already
// generate for Google News (see packages/shared/src/sitemapNews.js and
// apps/api/src/publisherRegistration.js's verification side). Reshapes
// {title, link, publishedAt} entries into the same {items: [...]} shape
// rss-parser produces, so buildArticleRow below doesn't need to know which
// format a feed actually came from -- it only ever sees "items".
async function fetchSitemapNews(feed) {
  const headers = { 'User-Agent': USER_AGENT };
  if (feed.etag) headers['If-None-Match'] = feed.etag;
  if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified;

  const res = await fetch(feed.feed_url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 304) {
    return { notModified: true };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  const newsItems = parseSitemapNews(text);
  const items = newsItems.map((n) => ({ title: n.title, link: n.link, isoDate: n.publishedAt, pubDate: n.publishedAt }));
  return {
    notModified: false,
    parsed: { items },
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  };
}

// Feed-less websites (feeds.feed_type 'sitemap' | 'html'), onboarded via
// the "Register your news website" form and explicitly activated by an
// admin. The bounded, robots.txt-compliant crawler lives in
// packages/shared/src/crawler.js; it returns the same {items} shape as
// rss-parser, so buildArticleRow below is shared by every source type.
const CRAWL_MAX_ARTICLES = parseInt(process.env.CRAWL_MAX_ARTICLES_PER_RUN, 10) || 20;
const CRAWL_DELAY_MS = parseInt(process.env.CRAWL_DELAY_MS, 10) || 1000;
// The CronJob kills the pod at activeDeadlineSeconds (280 s). A crawl that
// runs past it never reaches the UPDATE below, so its last_fetched_at stays
// old, it is due again on the very next run and gets killed again -- a loop
// seen 2026-10-12 (five runs in a row). Each crawl therefore gets its own
// time budget, no crawl starts too close to the end of the run, and the
// attempt is recorded before crawling so a killed crawl waits its interval.
const CRAWL_BUDGET_MS = parseInt(process.env.CRAWL_BUDGET_MS, 10) || 120000;
const POLL_RUN_BUDGET_MS = parseInt(process.env.POLL_RUN_BUDGET_MS, 10) || 230000;
const CRAWL_MIN_START_MS = 45000;

function isCrawled(feed) {
  return feed.feed_type === 'sitemap' || feed.feed_type === 'html';
}

async function fetchCrawledSource(pool, feed, runDeadline = Infinity) {
  await pool.query('UPDATE feeds SET last_fetched_at = now() WHERE id = $1', [feed.id]);
  const result = await crawlSource(feed, {
    maxArticles: CRAWL_MAX_ARTICLES,
    delayMs: CRAWL_DELAY_MS,
    deadline: Math.min(Date.now() + CRAWL_BUDGET_MS, runDeadline),
    // Skip URLs already ingested for this source before fetching them.
    filterUnknown: async (urls) => {
      if (urls.length === 0) return urls;
      const { rows } = await pool.query(
        'SELECT original_url FROM articles WHERE feed_id = $1 AND original_url = ANY($2::text[])',
        [feed.id, urls]
      );
      const known = new Set(rows.map((r) => r.original_url));
      return urls.filter((u) => !known.has(u));
    },
  });
  return { notModified: false, parsed: { items: result.items }, etag: null, lastModified: null };
}

function fetchFeed(feed, pool, runDeadline) {
  if (isCrawled(feed)) return fetchCrawledSource(pool, feed, runDeadline);
  return feed.feed_type === 'sitemap-news' ? fetchSitemapNews(feed) : fetchRssFeed(feed);
}

// Turns one rss-parser item into an articles-table row, or null if the item
// should be skipped (too old, or missing the fields a row can't do without).
// Pulled out of pollFeed as a standalone pure function -- both branches here
// (the date handling and the author type-guard) are exactly the logic that
// caused two separate real production crashes (Liberté-Algérie's malformed
// date, Guardian/Fox's structured author field), so this is what the test
// suite targets directly rather than only exercising it indirectly through
// a full DB-backed poll.
//
// Per-feed options (feeds.parser_config), both opt-in:
// - undated: 'fetch_time' -- for feeds whose items carry no date at all (The
//   Baltic Times, 2026-10-15). An undated row would otherwise be stored with
//   published_at NULL, which sorts first wherever a query lacks NULLS LAST.
//   The fetch time is only used the first time an item is seen (later polls
//   hit the dedup hash), and item `index` steps it back a minute per position
//   so the feed's own order is kept.
// - title_suffix: a site name appended to every headline (" - The Baltic
//   Times"); removed from the stored headline, not from the hashed raw title.
// - title_prefix: the same for a site name put in front ("Diario HOY | ",
//   Hoy.com.py, 2026-10-17).
// - label_utc_offset_hours: the feed writes local time but labels it UTC
//   (Inquirer: Philippine time as "+0000" -> 8); that many hours are taken off
//   every parsed date. Ignored unless a finite number between -14 and 14.
function buildArticleRow(feed, item, cutoff, { fetchedAt = Date.now(), index = 0 } = {}) {
  // A malformed isoDate/pubDate string (some publishers ship these) produces
  // an Invalid Date, which is truthy and was crashing the whole feed's
  // batched INSERT with a NaN-laden timestamp string (found via Liberté-Algérie
  // during the Asia expansion poll). Treat it as "no date" instead of failing
  // the entire batch over one bad item.
  let publishedAt = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
  if (publishedAt && isNaN(publishedAt.getTime())) publishedAt = null;
  // Dates written as Arabic text (Youm7) only parse with the feed's time zone.
  if (!publishedAt && item.pubDate && feed.parser_config?.time_zone) {
    publishedAt = parseArabicDate(item.pubDate, feed.parser_config.time_zone);
  }
  // Feeds that write local time with a UTC label (Inquirer, 2026-10-19: Philippine time as "+0000", 8 h ahead):
  // the real UTC time is the labelled one minus the offset. Applied before the cutoff and the future clamp.
  const labelOffset = Number(feed.parser_config?.label_utc_offset_hours);
  if (publishedAt && Number.isFinite(labelOffset) && labelOffset !== 0 && Math.abs(labelOffset) <= 14) {
    publishedAt = new Date(publishedAt.getTime() - labelOffset * 3600 * 1000);
  }
  if (publishedAt && publishedAt.getTime() < cutoff) return null;
  // Some feeds label local time as UTC (seen 2026-10-08: Punch, ActuCameroun,
  // Daily Maverick up to 1.3 h ahead), which pins those articles to the top
  // of "latest news". A date more than a few minutes in the future can't be a
  // real publication time: store the fetch time instead.
  if (publishedAt && publishedAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) publishedAt = new Date();
  if (!publishedAt && feed.parser_config?.undated === 'fetch_time') publishedAt = new Date(fetchedAt - index * 60 * 1000);

  // Stored headline is cleaned (entities decoded, whitespace trimmed), but
  // the dedup hash stays on the raw title exactly as before -- hashing the
  // cleaned text would give every already-ingested entity-bearing headline
  // a new hash and re-insert it as a duplicate on the next poll.
  const rawTitle = item.title || '';
  let headline = cleanHeadline(rawTitle);
  const suffix = feed.parser_config?.title_suffix;
  if (headline && suffix && headline.endsWith(suffix)) headline = headline.slice(0, -suffix.length).trim();
  const prefix = feed.parser_config?.title_prefix?.trim();
  if (headline && prefix && headline.startsWith(prefix)) headline = headline.slice(prefix.length).trim();
  if (!headline || !item.link) return null;

  const hash = dedupHash(feed.publisher_id, rawTitle);
  const category = categorize(item.categories, headline, feed.language, item.link);
  const summary = (item.contentSnippet || item.summary || '').slice(0, 1000);
  const image = item.enclosure?.url || null;
  // Some publishers (Guardian, Fox News observed) emit a structured
  // <dc:creator>/author field (object or array) rather than plain text --
  // rss-parser passes it through as-is, and binding a non-string object
  // as a pg query param throws "Cannot convert object to primitive value".
  // Only trust it if it's actually a string.
  const rawAuthor = item.creator || item.author;
  const author = typeof rawAuthor === 'string' ? rawAuthor : null;

  return [feed.id, feed.publisher_id, feed.country_id, headline, summary, image, item.link,
    author, category, publishedAt, hash];
}

async function pollFeed(pool, feed, runDeadline) {
  const label = `${feed.publisher_name} (${feed.feed_url})`;
  try {
    const result = await fetchFeed(feed, pool, runDeadline);

    if (result.notModified) {
      await pool.query(
        `UPDATE feeds SET last_fetched_at = now(), last_status = 'not_modified', last_success_at = now(),
           consecutive_failures = 0 WHERE id = $1`,
        [feed.id]
      );
      console.log(`[not modified] ${label}`);
      return { ok: true, inserted: 0 };
    }

    const fetchedAt = Date.now();
    const cutoff = fetchedAt - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const rows = (result.parsed.items || [])
      .map((item, index) => buildArticleRow(feed, item, cutoff, { fetchedAt, index }))
      .filter(Boolean);

    // A handful of European feeds (e.g. La Repubblica, Le Sahel, El Watan)
    // carry 50-200+ items per poll. One INSERT round trip per item doesn't
    // scale once feed count grows into the hundreds -- batch all of a feed's
    // items into a single multi-row INSERT instead.
    let inserted = 0;
    if (rows.length > 0) {
      const cols = 11;
      const values = [];
      const placeholders = rows.map((row, i) => {
        values.push(...row);
        const base = i * cols;
        return `(${Array.from({ length: cols }, (_, j) => `$${base + j + 1}`).join(',')})`;
      }).join(',');

      const res = await pool.query(
        `INSERT INTO articles
           (feed_id, publisher_id, country_id, headline, summary, image_url, original_url, author, category, published_at, dedup_hash)
         VALUES ${placeholders}
         ON CONFLICT (dedup_hash) DO NOTHING`,
        values
      );
      inserted = res.rowCount;
    }

    await pool.query(
      `UPDATE feeds SET last_fetched_at = now(), last_status = 'ok', etag = $2, last_modified = $3,
         last_success_at = now(), consecutive_failures = 0 WHERE id = $1`,
      [feed.id, result.etag, result.lastModified]
    );
    console.log(`[ok] ${label} -- ${inserted} new article(s)`);
    return { ok: true, inserted };
  } catch (err) {
    await pool.query(
      `UPDATE feeds SET last_fetched_at = now(), last_status = $2, last_error = $3, last_error_at = now(),
         consecutive_failures = consecutive_failures + 1 WHERE id = $1`,
      [feed.id, `error: ${err.message}`.slice(0, 250), err.message.slice(0, 1000)]
    );
    console.error(`[error] ${label} -- ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// Feeds used to be polled one at a time, which worked fine at ~50 feeds but
// stopped scaling once continental expansions pushed the count past 300 --
// a handful of slow/timing-out feeds (each up to the 15s parser timeout)
// could blow past the CronJob's activeDeadlineSeconds. A fixed number of
// workers each pull the next feed off a shared queue as soon as they finish,
// so one slow feed only blocks its own worker slot rather than an entire
// lockstep batch (a naive chunk-based Promise.all still pays the slowest
// straggler's cost on every chunk -- worse than it looks at this feed count).
const POLL_CONCURRENCY = 20;

// Feeds that keep failing (bot blocking, dead DNS, expired certificates) were
// re-requested every 5 minutes for weeks -- 2026-10-15: 44 of 610 feeds had
// not succeeded for over a day, ~12,600 failing requests a day. Once a feed
// has gone FAILING_AFTER_DAYS without a success it is retried every
// RETRY_FAILING_HOURS, and after LONG_FAILING_AFTER_DAYS once every
// RETRY_LONG_FAILING_HOURS. Measured in time since the last success (or since
// the feed was added), not in failure count, so hourly crawled sources back
// off on the same calendar as 5-minute RSS feeds. One success resets
// consecutive_failures, and the feed is polled normally again.
const FAILING_AFTER_DAYS = 1;
const RETRY_FAILING_HOURS = 6;
const LONG_FAILING_AFTER_DAYS = 7;
const RETRY_LONG_FAILING_HOURS = 24;

const BACKOFF_SQL = `
       AND (f.consecutive_failures = 0 OR f.last_fetched_at IS NULL
            OR coalesce(f.last_success_at, f.created_at) > now() - interval '${FAILING_AFTER_DAYS} days'
            OR f.last_fetched_at < now() - CASE
                 WHEN coalesce(f.last_success_at, f.created_at) > now() - interval '${LONG_FAILING_AFTER_DAYS} days'
                 THEN interval '${RETRY_FAILING_HOURS} hours' ELSE interval '${RETRY_LONG_FAILING_HOURS} hours' END)`;

// The same rule as BACKOFF_SQL, for tests and logs: the retry interval in hours
// for a feed, or null when it is polled on its normal schedule.
function failingRetryHours(feed, now = Date.now()) {
  if (!feed.consecutive_failures || !feed.last_fetched_at) return null;
  const since = new Date(feed.last_success_at || feed.created_at).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (since > now - FAILING_AFTER_DAYS * day) return null;
  return since > now - LONG_FAILING_AFTER_DAYS * day ? RETRY_FAILING_HOURS : RETRY_LONG_FAILING_HOURS;
}

async function pollAllFeeds() {
  const runDeadline = Date.now() + POLL_RUN_BUDGET_MS;
  const pool = getPool();
  const { rows: feeds } = await pool.query(
    `SELECT f.id, f.feed_url, f.feed_type, f.etag, f.last_modified, f.allowed_domains, f.respect_robots_txt,
            f.category_urls, f.article_url_patterns, f.parser_config,
            p.id AS publisher_id, p.name AS publisher_name, p.country_id, p.language
     FROM feeds f
     JOIN publishers p ON p.id = f.publisher_id
     WHERE p.feed_status = 'active' AND f.enabled
       -- NULL frequency (every existing RSS/Atom feed) = poll on every run,
       -- exactly as before; crawled sources honour their configured interval.
       AND (f.crawl_frequency_minutes IS NULL OR f.last_fetched_at IS NULL
            OR f.last_fetched_at < now() - make_interval(mins => f.crawl_frequency_minutes))${BACKOFF_SQL}`
  );

  const results = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < feeds.length) {
      const feed = feeds[nextIndex++];
      if (isCrawled(feed) && runDeadline - Date.now() < CRAWL_MIN_START_MS) {
        // Not stamped, so it is picked up first thing on the next run.
        console.log(`[deferred] ${feed.publisher_name} (${feed.feed_url}) -- too little time left in this run`);
        results.push({ ok: true, inserted: 0, deferred: true });
        continue;
      }
      results.push(await pollFeed(pool, feed, runDeadline));
    }
  }
  await Promise.all(Array.from({ length: Math.min(POLL_CONCURRENCY, feeds.length) }, worker));
  return results;
}

module.exports = { pollAllFeeds, pollFeed, dedupHash, escapeBareAmpersands, buildArticleRow, failingRetryHours, BACKOFF_SQL };
