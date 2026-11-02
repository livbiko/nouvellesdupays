// Slug for /source/<slug> pages, same rule as the backfill in db/migrations/016_media_organisations.sql:
// accents removed by Unicode decomposition (NFD, "Tuổi Trẻ" -> tuoi-tre) plus a few letters NFD leaves
// alone, anything else -> '-'; the domain when the name has no Latin letters (Arabic, Chinese...);
// collisions broken with -<iso>, then -<id>; at most 90 chars.
// Until 2026-11-02 only the migration and hand-written release SQL set slugs, so a publisher approved in
// the admin panel had none -- and no /source page.

const SPECIAL = { Đ: 'D', đ: 'd', Ø: 'O', ø: 'o', Ł: 'L', ł: 'l', ß: 's', Æ: 'A', æ: 'a', Œ: 'O', œ: 'o', ı: 'i', Ħ: 'H', ħ: 'h' };
const MAX = 90;

function clean(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ĐđØøŁłßÆæŒœıĦħ]/g, (c) => SPECIAL[c])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Name first, domain when the name has no usable letters; '' when neither has any.
function slugBase(name, domain) {
  return clean(name) || clean(domain);
}

// Candidates in order of preference: base, base-<iso>, base-<id>.
function slugCandidates(base, iso, id) {
  const b = base || `publisher-${id}`;
  const out = [b];
  if (iso) out.push(`${b}-${String(iso).trim().toLowerCase()}`);
  out.push(`${b}-${id}`);
  return out.map((s) => s.slice(0, MAX));
}

// Gives publisher `id` a slug if it has none. `db` is a pg Pool or client. Returns the slug.
async function assignPublisherSlug(db, id) {
  const { rows: [p] } = await db.query(
    `SELECT p.name, p.domain, p.slug, c.iso_code FROM publishers p JOIN countries c ON c.id = p.country_id WHERE p.id = $1`,
    [id]
  );
  if (!p) throw new Error(`publisher ${id} not found`);
  if (p.slug) return p.slug;
  for (const candidate of slugCandidates(slugBase(p.name, p.domain), p.iso_code, id)) {
    try {
      const { rowCount } = await db.query(
        `UPDATE publishers SET slug = $2 WHERE id = $1 AND slug IS NULL
           AND NOT EXISTS (SELECT 1 FROM publishers WHERE slug = $2 AND id <> $1)`,
        [id, candidate]
      );
      if (rowCount === 1) return candidate;
    } catch (err) {
      if (err.code !== '23505') throw err; // taken between the check and the update: try the next one
    }
  }
  throw new Error(`no free slug for publisher ${id}`);
}

module.exports = { slugBase, slugCandidates, assignPublisherSlug };
