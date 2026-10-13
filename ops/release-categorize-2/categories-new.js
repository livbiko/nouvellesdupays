const CATEGORIES = [
  'politics',
  'business',
  'technology',
  'sports',
  'health',
  'entertainment',
  'other',
];

// A keyword matches every word that starts with it; "kw$" matches only the
// whole word "kw" (after accent folding).
const KEYWORD_MAP = {
  politics: ['politiqu', 'election', 'president', 'government', 'parliament', 'minister'],
  business: ['business', 'economie', 'econom', 'market', 'bourse', 'finance', 'bank'],
  technology: ['tech', 'ntic', 'digital', 'numeriq', 'startup', 'internet'],
  sports: ['sport', 'football', 'foot$', 'footy$', 'cup$', 'cupa$', 'league', 'match'],
  health: ['sante$', 'health', 'hopital', 'medic', 'covid', 'disease'],
  entertainment: ['culture', 'musique', 'music', 'cinema', 'entertainment', 'celebrit'],
};

// Words that start with a keyword but are not about its category, from a
// 30-day audit of 978,879 headlines (2026-10-13). Whole-word "foot"/"cup"/
// "sante" above already drop footage, footwear, footprint, cúpula, cupón,
// cupboard, Cupra, Santeri...; these are excluded as word prefixes.
const NOT_KEYWORDS = [
  'matching', 'matcha', 'matched', 'matchbox', 'matchmak', // job matching, matcha tea
  'techo', // Spanish "roof"
  'techiman', // town in Ghana
];

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
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const WORD_START = '(?:^|[^\\p{L}\\p{N}])';
const NOT_WORD = `(?!${NOT_KEYWORDS.join('|')})`;
const keywordPattern = (kw) => (kw.endsWith('$') ? `${kw.slice(0, -1)}(?![\\p{L}\\p{N}])` : kw);
const KEYWORD_RE = Object.entries(KEYWORD_MAP).map(([category, keywords]) => [
  category,
  new RegExp(`${WORD_START}${NOT_WORD}(?:${keywords.map(keywordPattern).join('|')})`, 'u'),
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
