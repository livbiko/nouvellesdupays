// Duplicate check run before a submission is approved into a publisher
// (apps/api/src/admin.js approve endpoint and db/review-submissions.js).
//
// Approval used to INSERT ... ON CONFLICT (country_id, name) DO UPDATE, which
// silently merged a new submission into an existing same-named publisher and
// overwrote its homepage (2026-10-09: beninintelligent.bj took over the
// existing beninintelligent.com publisher). Now a conflict stops the approval
// and is reported, and nothing is written.

// "https://www.Site.com/path" -> "site.com/path" without a trailing slash: the
// same normalisation as publishers.domain (host, plus a path for the few
// sections-of-a-site publishers such as allafrica.com/guineabissau).
function normalizeDomain(url) {
  return String(url || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

const hostOnly = (d) => d.split('/')[0];

/**
 * @returns {Promise<null | {kind: 'name'|'domain'|'feed', publisher_id: number, publisher_name: string, homepage_url: string, country_iso: string}>}
 */
async function findPublisherConflict(db, { countryId, name, homepageUrl, feedUrl }) {
  const host = hostOnly(normalizeDomain(homepageUrl));
  const { rows } = await db.query(
    `SELECT kind, p.id AS publisher_id, p.name AS publisher_name, p.homepage_url, c.iso_code AS country_iso
     FROM (
       SELECT 1 AS rank, 'name' AS kind, id FROM publishers WHERE country_id = $1 AND lower(name) = lower($2)
       UNION ALL
       SELECT 2, 'domain', id FROM publishers
         WHERE lower(regexp_replace(regexp_replace(domain, '^www\\.', ''), '/+$', '')) = $3
       UNION ALL
       SELECT 3, 'feed', publisher_id FROM feeds WHERE $4::text IS NOT NULL AND feed_url = $4
     ) hit
     JOIN publishers p ON p.id = hit.id
     JOIN countries c ON c.id = p.country_id
     ORDER BY rank, p.id
     LIMIT 1`,
    [countryId, String(name || '').trim(), host, feedUrl || null]
  );
  return rows[0] || null;
}

const KIND_LABEL = { name: 'même nom dans ce pays', domain: 'même site', feed: 'même flux' };

function conflictMessage(c) {
  return `Doublon (${KIND_LABEL[c.kind]}) : l’éditeur « ${c.publisher_name} » (id ${c.publisher_id}, ${c.country_iso}, ${c.homepage_url}) existe déjà. `
    + 'Rien n’a été modifié : rejetez cette soumission, ou renommez-la si c’est un média différent.';
}

module.exports = { findPublisherConflict, conflictMessage, normalizeDomain };
