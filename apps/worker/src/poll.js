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

async function fetchFeed(feed) {
  const headers = { 'User-Agent': USER_AGENT };
  if (feed.etag) headers['If-None-Match'] = feed.etag;
  if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified;

  const res = await fetch(feed.feed_url, { headers });
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
    let inserted = 0;

    for (const item of result.parsed.items || []) {
      const publishedAt = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
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

      const res = await pool.query(
        `INSERT INTO articles
           (feed_id, publisher_id, country_id, headline, summary, image_url, original_url, author, category, published_at, dedup_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (dedup_hash) DO NOTHING`,
        [feed.id, feed.publisher_id, feed.country_id, headline, summary, image, item.link,
          author, category, publishedAt, hash]
      );
      if (res.rowCount > 0) inserted += 1;
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
// could blow past the CronJob's activeDeadlineSeconds. Polling in
// concurrency-limited batches keeps total runtime close to the slowest
// feed per batch rather than the sum of all feeds.
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
  for (let i = 0; i < feeds.length; i += POLL_CONCURRENCY) {
    const batch = feeds.slice(i, i + POLL_CONCURRENCY);
    results.push(...await Promise.all(batch.map((feed) => pollFeed(pool, feed))));
  }
  return results;
}

module.exports = { pollAllFeeds, pollFeed, dedupHash };
