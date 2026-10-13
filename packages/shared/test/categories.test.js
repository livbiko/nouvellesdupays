const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categorize } = require('../src/categories');

test('categorize: matches on plain-string categories', () => {
  // KEYWORD_MAP uses partial/French-leaning stems ("politiqu", not
  // "politic"), so match against what the map actually contains rather than
  // the English category name a publisher might use.
  assert.equal(categorize(['Government'], 'Some headline'), 'politics');
  assert.equal(categorize(['Sport'], 'Some headline'), 'sports');
  assert.equal(categorize(['Business & Finance'], 'Some headline'), 'business');
});

test('categorize: falls back to matching the headline when no category matches', () => {
  assert.equal(categorize([], 'President signs new election law'), 'politics');
  assert.equal(categorize(undefined, 'Local hospital opens new covid ward'), 'health');
});

test('categorize: returns "other" when nothing matches', () => {
  assert.equal(categorize(['Weather'], 'It rained today'), 'other');
  assert.equal(categorize([], ''), 'other');
  assert.equal(categorize(undefined, undefined), 'other');
});

// Regression (2026-10-13): keywords used to match anywhere inside a word.
test('categorize: keywords match only at the start of a word', () => {
  assert.equal(categorize([], 'Nana B passport claims a diversionary tactic — Abu Jinapor'), 'other');
  assert.equal(categorize([], 'Rosatom takes full control of transport conglomerate'), 'other');
  assert.equal(categorize([], 'Rusland muliggør dieseleksport til USA'), 'other');
  assert.equal(categorize([], 'SHC gives illegal occupants two days to vacate state lands'), 'other');
  assert.equal(categorize([], 'My colleague retires today'), 'other');
  assert.equal(categorize([], 'FAO, Borno validate climate-smart agriculture'), 'other');
  assert.equal(categorize([], '8 injured in knife attack at supermarket'), 'other');
  // still matched as a prefix ("sports", "footballeur", "Cup", "élections")
  assert.equal(categorize([], 'How not to administer sports'), 'sports');
  assert.equal(categorize([], 'Le footballeur signe à Lyon'), 'sports');
  assert.equal(categorize([], 'Ghana win the Cup'), 'sports');
  assert.equal(categorize(['Sports/Football'], 'x'), 'sports');
});

test('categorize: accents are folded, so the French stems match accented words', () => {
  assert.equal(categorize([], 'Crise en Haïti: les élections reportées'), 'politics');
  assert.equal(categorize([], 'Le prix Nobel de l’économie 2026'), 'business');
  assert.equal(categorize([], "Dr Shamloll de l’hôpital Jeetoo"), 'health');
  assert.equal(categorize([], 'Une nouvelle autoroute numérique relie Bamako à Dakar'), 'technology');
  assert.equal(categorize(['Santé'], 'x'), 'health');
  assert.equal(categorize([], 'Ato Forson declares Ghana ready for economic take-off'), 'business');
});

// Regression (2026-10-13, 30-day audit): words that start with a keyword but aren't about its category.
test('categorize: whole-word foot/cup/sante, and excluded keyword-prefixed words', () => {
  for (const h of [
    'GHS to distribute 80,000 pairs of locally-made protective footwear',
    'Police release CCTV footage of the robbery',
    'Firm cuts its carbon footprint',
    'Residents demand a footpath along the N53',
    'Las cúpulas de Bildu y ERC se reúnen en Bilbao',
    'Cómo solicitar el cupón de pago del SII',
    "I was told I had cancer sitting in a hospital stock cupboard",
    'NTUC union to hold job matching session',
    'El desayuno de Nicole Kidman: té matcha y arroz',
    'Mal tiempo causa voladuras de techo en Colón',
    'The Ghana Jollof arrest: mystery surrounds midnight detention in Techiman',
    'Santeri Kinnunen näyttelee Vesku Loiria',
  ]) assert.equal(categorize([], h), 'other', h);
  assert.equal(categorize([], 'Foot : le PSG s’impose à Lens'), 'sports');
  assert.equal(categorize([], 'NRL vs AFL: who does footy finals better?'), 'sports');
  assert.equal(categorize([], 'Team USA wins fifth straight World Cup'), 'sports');
  assert.equal(categorize([], 'Messi a câștigat Cupa'), 'sports');
  assert.equal(categorize([], 'Bendel Insurance shine on matchday 4'), 'sports');
  assert.equal(categorize([], 'Le ministère de la Santé lance une campagne'), 'politics');
  assert.equal(categorize([], 'Une campagne de santé à Kaolack'), 'health');
  assert.equal(categorize([], 'Tech startups raise $20m'), 'technology');
});

// Regression test: rss-parser (via xml2js) represents an attributed
// <category domain="...">text</category> element as an Object.create(null)
// object ({_: "text", $: {...}}) with no prototype -- this crashed
// categorize() with "Cannot convert object to primitive value" on every
// Guardian/Fox News article until fixed (Phase 2 Stage 1). Feeds with
// plain-text <category> elements never triggered it.
test('categorize: handles rss-parser attributed-category objects (Guardian/Fox News regression)', () => {
  const attributedCategory = Object.assign(Object.create(null), {
    _: 'Sport',
    $: { domain: 'https://www.theguardian.com/sport' },
  });
  assert.doesNotThrow(() => categorize([attributedCategory], 'Match report'));
  assert.equal(categorize([attributedCategory], 'Match report'), 'sports');
});

test('categorize: attributed category with no usable text falls back to headline', () => {
  const emptyAttributed = Object.assign(Object.create(null), { $: { domain: 'x' } });
  assert.equal(categorize([emptyAttributed], 'Central bank raises interest rates'), 'business');
});

test('categorize: mixed array of string and object categories does not throw', () => {
  const attributed = Object.assign(Object.create(null), { _: 'Music' });
  assert.doesNotThrow(() => categorize(['Culture', attributed], 'headline'));
  assert.equal(categorize(['Culture', attributed], 'headline'), 'entertainment');
});
