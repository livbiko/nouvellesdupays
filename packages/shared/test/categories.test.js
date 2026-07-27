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
