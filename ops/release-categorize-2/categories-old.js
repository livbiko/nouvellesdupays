const CATEGORIES = [
  'politics',
  'business',
  'technology',
  'sports',
  'health',
  'entertainment',
  'other',
];

const KEYWORD_MAP = {
  politics: ['politiqu', 'election', 'president', 'government', 'parliament', 'minister'],
  business: ['business', 'economie', 'econom', 'market', 'bourse', 'finance', 'bank'],
  technology: ['tech', 'ntic', 'digital', 'numeriq', 'startup', 'internet'],
  sports: ['sport', 'football', 'foot', 'cup', 'league', 'match'],
  health: ['sante', 'health', 'hopital', 'medic', 'covid', 'disease'],
  entertainment: ['culture', 'musique', 'music', 'cinema', 'entertainment', 'celebrit'],
};

// rss-parser (via xml2js) represents an attributed <category domain="...">text</category>
// element as an Object.create(null) object {_: "text", $: {domain: "..."}} -- no
// prototype at all, so it has no toString/valueOf and blindly joining it into a
// string throws "Cannot convert object to primitive value" (hit on Guardian/Fox
// News feeds, which use attributed categories; plain-text <category> feeds never
// triggered this). Pull out just the text, for both shapes.
function categoryToText(cat) {
  if (typeof cat === 'string') return cat;
  if (cat && typeof cat === 'object' && typeof cat._ === 'string') return cat._;
  return '';
}

// Keywords are word *prefixes*: matched only at the start of a word, after
// accents are folded. Plain substring matching (until 2026-10-13) filed
// "passport"/"transport"/"eksport" under sports ("sport"), "occupants" too
// ("cup"), "colleague" ("league"), "agriculture" under entertainment
// ("culture") and "supermarket" under business -- ~2,300 wrong categories a
// week, visible in the Africa country pages' sections -- while the French
// stems never matched accented words ("économie", "santé", "élection").
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KEYWORD_RE = Object.entries(KEYWORD_MAP).map(([category, keywords]) => [
  category,
  new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${keywords.join('|')})`, 'u'),
]);

function categorize(feedCategories, headline) {
  const categoryTexts = (feedCategories || []).map(categoryToText);
  const haystacks = fold([...categoryTexts, headline || ''].join(' '));
  for (const [category, re] of KEYWORD_RE) {
    if (re.test(haystacks)) return category;
  }
  return 'other';
}

module.exports = { CATEGORIES, categorize };
