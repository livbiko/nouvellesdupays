const Parser = require('rss-parser');

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

// Live-verifies a submitted feed URL actually is a working RSS/Atom feed
// with real items -- the same bar this project has always required for
// manually-curated feeds (a 200 status alone isn't enough; plenty of
// WordPress-style /feed paths return a valid-looking empty shell, or a
// plain HTML page with a 200, as FratMat's own /rss does).
async function verifyFeedUrl(feedUrl) {
  let res;
  try {
    res = await fetch(feedUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    return { verified: false, detail: `Could not reach the feed URL: ${err.message}` };
  }

  if (!res.ok) {
    return { verified: false, detail: `Feed URL returned HTTP ${res.status}` };
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = await parser.parseString(escapeBareAmpersands(text));
  } catch (err) {
    return { verified: false, detail: `Response is not valid RSS/Atom XML: ${err.message}` };
  }

  const items = parsed.items || [];
  if (items.length === 0) {
    return { verified: false, detail: 'Feed parsed successfully but contains zero items' };
  }
  if (!items[0].title || !items[0].link) {
    return { verified: false, detail: 'Feed items are missing a title/link' };
  }

  return { verified: true, detail: `Verified: ${items.length} item(s) found, most recent: "${items[0].title}"` };
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

      // Reject if this feed URL is already live or already pending review --
      // no point re-verifying/re-queuing the same submission.
      const { rows: dupeRows } = await pool.query(
        `SELECT 1 FROM feeds WHERE feed_url = $1
         UNION ALL
         SELECT 1 FROM publisher_submissions WHERE feed_url = $1 AND status = 'pending'`,
        [feed_url]
      );
      if (dupeRows.length > 0) {
        return reply.code(409).send({ error: 'This feed URL is already registered or pending review' });
      }

      const verification = await verifyFeedUrl(feed_url);
      if (!verification.verified) {
        return reply.code(422).send({
          error: 'Feed verification failed',
          detail: verification.detail,
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO publisher_submissions
           (name, homepage_url, feed_url, country_id, language, contact_email, feed_verified, verification_detail)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING id`,
        [name, homepage_url, feed_url, country_id, language, contact_email || null, verification.detail]
      );

      return reply.code(201).send({
        id: rows[0].id,
        status: 'pending',
        verification: verification.detail,
        message: 'Feed verified and submitted for review.',
      });
    }
  );
}

module.exports = { registerPublisherSubmissionRoute, verifyFeedUrl, escapeBareAmpersands };
