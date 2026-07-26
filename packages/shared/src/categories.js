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

function categorize(feedCategories, headline) {
  const categoryTexts = (feedCategories || []).map(categoryToText);
  const haystacks = [...categoryTexts, headline || ''].join(' ').toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((kw) => haystacks.includes(kw))) return category;
  }
  return 'other';
}

module.exports = { CATEGORIES, categorize };
