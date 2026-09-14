// Titrologie: groups today's coverage of the SAME story across publishers
// with different editorial classifications, so a reader sees the spread
// instead of one framing. No ML/NER available here -- clustering is plain
// word-overlap, tuned against real live headlines (see below) rather than
// a made-up threshold.
//
// Two headlines are "the same story" only if they share enough SIGNIFICANT
// words -- a shared theme/date fragment (many different "Rentrée scolaire
// 2026-2027" stories about unrelated schools) must NOT cluster, while two
// headlines naming the same people/places (e.g. "Ouattara et Doumbouya...
// coopération" from two publishers) must. Tuning note from a real sample:
// the Ouattara/Doumbouya pair scored Jaccard ~0.55 on 6 shared tokens; a
// pair of unrelated "Rentrée scolaire 2026-2027" stories scored ~0.21 on 3
// shared tokens (year + theme words only) -- JACCARD_THRESHOLD sits between
// the two with MIN_SHARED_TOKENS as a second gate against short-headline
// false positives.
const JACCARD_THRESHOLD = 0.35;
const MIN_SHARED_TOKENS = 2;

const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'dans', 'pour', 'sur', 'avec',
  'plus', 'sa', 'son', 'ses', 'leur', 'leurs', 'qui', 'que', 'ce', 'cette', 'ces', 'au', 'aux',
  'a', 'il', 'elle', 'ils', 'elles', 'ne', 'pas', 'est', 'sont', 'ont', 'va', 'vont', 'comme',
  'apres', 'avant', 'entre', 'ainsi', 'mais', 'ou', 'donc', 'or', 'ni', 'car', 'se', 'ses', 'par',
  'to', 'the', 'of', 'in', 'and', 'a', 'for', 'on', 'with',
]);

// Priority order when a publisher carries multiple classification tags --
// the most politically distinctive tag wins for grouping purposes, so a
// publisher tagged both party_aligned and commercial_generalist shows under
// its party column, not lumped in with plain generalists.
const TAG_PRIORITY = [
  'party_aligned', 'opposition_aligned', 'government_aligned', 'public_state',
  'independent', 'editorially_mixed', 'specialist', 'commercial_generalist', 'unknown',
];

function primaryTag(tags) {
  for (const t of TAG_PRIORITY) {
    if (tags.includes(t)) return t;
  }
  return tags[0] || null;
}

// Combining diacritical marks block (U+0300-U+036F) -- built from numeric
// code points via String.fromCodePoint, not literal characters in source,
// so this can't silently break if the file is ever re-saved with a
// different encoding (a real risk already hit once this session with
// French text over a psql pipe -- see project memory).
const COMBINING_MARKS = new RegExp(
  `[${String.fromCodePoint(0x0300)}-${String.fromCodePoint(0x036f)}]`, 'g'
);

function significantTokens(headline) {
  const normalized = (headline || '')
    .normalize('NFD').replace(COMBINING_MARKS, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  return new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
}

function jaccard(a, b) {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return { score: union === 0 ? 0 : shared / union, shared };
}

// Union-find over article indices, pure -- takes pre-fetched articles
// (each needs headline, publisher_id, classification_tags), returns groups
// of indices whose headlines are judged the same story.
function clusterArticles(articles) {
  const tokens = articles.map((a) => significantTokens(a.headline));
  const parent = articles.map((_, i) => i);
  function find(i) {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i, j) {
    const ri = find(i), rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (articles[i].publisher_id === articles[j].publisher_id) continue; // same story, same outlet isn't cross-perspective
      const { score, shared } = jaccard(tokens[i], tokens[j]);
      if (score >= JACCARD_THRESHOLD && shared >= MIN_SHARED_TOKENS) union(i, j);
    }
  }

  const groups = new Map();
  articles.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });

  return [...groups.values()]
    .map((indices) => indices.map((i) => articles[i]))
    .filter((group) => {
      const distinctPublishers = new Set(group.map((a) => a.publisher_id));
      const distinctTags = new Set(group.map((a) => primaryTag(a.classification_tags)));
      return distinctPublishers.size >= 2 && distinctTags.size >= 2;
    });
}

module.exports = { clusterArticles, primaryTag, significantTokens, jaccard };
