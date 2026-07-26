const crypto = require('crypto');
const Parser = require('rss-parser');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { categorize } = require('@nouvellesdupays/shared/src/categories');

const parser = new Parser({ timeout: 15000 });
const MAX_AGE_DAYS = 14;
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

async function fetchFeed(feed) {
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

async function pollFeed(pool, feed) {
  const label = `${feed.publisher_name} (${feed.feed_url})`;
  try {
    const result = await fetchFeed(feed);

    if (result.notModified) {
      await pool.query(
        `UPDATE feeds SET last_fetched_at = now(), last_status = 'not_modified' WHERE id = $1`,
        [feed.id]
      );
      console.log(`[not modified] ${label}`);
      return { ok: true, inserted: 0 };
    }

    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const rows = [];

    for (const item of result.parsed.items || []) {
      // A malformed isoDate/pubDate string (some publishers ship these) produces
      // an Invalid Date, which is truthy and was crashing the whole feed's
      // batched INSERT with a NaN-laden timestamp string (found via Liberté-Algérie
      // during the Asia expansion poll). Treat it as "no date" instead of failing
      // the entire batch over one bad item.
      let publishedAt = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
      if (publishedAt && isNaN(publishedAt.getTime())) publishedAt = null;
      if (publishedAt && publishedAt.getTime() < cutoff) continue;

      const headline = item.title || '';
      if (!headline || !item.link) continue;

      const hash = dedupHash(feed.publisher_id, headline);
      const category = categorize(item.categories, headline);
      const summary = (item.contentSnippet || item.summary || '').slice(0, 1000);
      const image = item.enclosure?.url || null;
      // Some publishers (Guardian, Fox News observed) emit a structured
      // <dc:creator>/author field (object or array) rather than plain text --
      // rss-parser passes it through as-is, and binding a non-string object
      // as a pg query param throws "Cannot convert object to primitive value".
      // Only trust it if it's actually a string.
      const rawAuthor = item.creator || item.author;
      const author = typeof rawAuthor === 'string' ? rawAuthor : null;

      rows.push([feed.id, feed.publisher_id, feed.country_id, headline, summary, image, item.link,
        author, category, publishedAt, hash]);
    }

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
      `UPDATE feeds SET last_fetched_at = now(), last_status = 'ok', etag = $2, last_modified = $3 WHERE id = $1`,
      [feed.id, result.etag, result.lastModified]
    );
    console.log(`[ok] ${label} -- ${inserted} new article(s)`);
    return { ok: true, inserted };
  } catch (err) {
    await pool.query(
      `UPDATE feeds SET last_fetched_at = now(), last_status = $2 WHERE id = $1`,
      [feed.id, `error: ${err.message}`.slice(0, 250)]
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

async function pollAllFeeds() {
  const pool = getPool();
  const { rows: feeds } = await pool.query(
    `SELECT f.id, f.feed_url, f.etag, f.last_modified, p.id AS publisher_id, p.name AS publisher_name, p.country_id
     FROM feeds f
     JOIN publishers p ON p.id = f.publisher_id
     WHERE p.feed_status = 'active'`
  );

  const results = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < feeds.length) {
      const feed = feeds[nextIndex++];
      results.push(await pollFeed(pool, feed));
    }
  }
  await Promise.all(Array.from({ length: Math.min(POLL_CONCURRENCY, feeds.length) }, worker));
  return results;
}

module.exports = { pollAllFeeds, pollFeed, dedupHash };
