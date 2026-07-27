const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupHash, escapeBareAmpersands, buildArticleRow } = require('../src/poll');

test('dedupHash: same publisher+headline always produces the same hash', () => {
  const a = dedupHash(42, 'Some Headline');
  const b = dedupHash(42, 'Some Headline');
  assert.equal(a, b);
});

test('dedupHash: normalizes case and whitespace before hashing', () => {
  const a = dedupHash(42, '  Some   Headline  ');
  const b = dedupHash(42, 'some headline');
  assert.equal(a, b);
});

test('dedupHash: different publishers or headlines produce different hashes', () => {
  assert.notEqual(dedupHash(1, 'Headline'), dedupHash(2, 'Headline'));
  assert.notEqual(dedupHash(1, 'Headline A'), dedupHash(1, 'Headline B'));
});

test('dedupHash: handles a missing headline without throwing', () => {
  assert.doesNotThrow(() => dedupHash(1, undefined));
});

// Regression test: Abidjan.net (and others) ship XML with bare "&" (e.g.
// "Lycee 1 & 2") instead of "&amp;", which is invalid XML and broke the
// parser outright until this was added.
test('escapeBareAmpersands: escapes a bare & but leaves real entities alone', () => {
  const input = 'Lycee 1 & 2 &amp; more &lt;tag&gt; &#39; &#x27;';
  const output = escapeBareAmpersands(input);
  assert.equal(output, 'Lycee 1 &amp; 2 &amp; more &lt;tag&gt; &#39; &#x27;');
});

test('escapeBareAmpersands: leaves text with no ampersands untouched', () => {
  assert.equal(escapeBareAmpersands('no ampersands here'), 'no ampersands here');
});

const BASE_FEED = { id: 1, publisher_id: 2, country_id: 3 };
const CUTOFF = Date.now() - 14 * 24 * 60 * 60 * 1000;

test('buildArticleRow: builds a full row for a normal item', () => {
  const item = {
    title: 'Headline',
    link: 'https://example.com/a',
    isoDate: new Date().toISOString(),
    contentSnippet: 'summary text',
    categories: ['Government'],
  };
  const row = buildArticleRow(BASE_FEED, item, CUTOFF);
  assert.ok(row, 'expected a row, got null');
  const [feedId, publisherId, countryId, headline, summary, image, link, author, category, publishedAt] = row;
  assert.equal(feedId, 1);
  assert.equal(publisherId, 2);
  assert.equal(countryId, 3);
  assert.equal(headline, 'Headline');
  assert.equal(summary, 'summary text');
  assert.equal(image, null);
  assert.equal(link, 'https://example.com/a');
  assert.equal(author, null);
  assert.equal(category, 'politics');
  assert.ok(publishedAt instanceof Date);
});

test('buildArticleRow: returns null when headline is missing', () => {
  assert.equal(buildArticleRow(BASE_FEED, { link: 'https://example.com/a' }, CUTOFF), null);
});

test('buildArticleRow: returns null when link is missing', () => {
  assert.equal(buildArticleRow(BASE_FEED, { title: 'Headline' }, CUTOFF), null);
});

test('buildArticleRow: returns null for an item older than the cutoff', () => {
  const item = {
    title: 'Old news',
    link: 'https://example.com/old',
    isoDate: new Date(CUTOFF - 24 * 60 * 60 * 1000).toISOString(),
  };
  assert.equal(buildArticleRow(BASE_FEED, item, CUTOFF), null);
});

// Regression test: Liberté-Algérie shipped a malformed pubDate/isoDate that
// produced a JS Invalid Date -- truthy, not null -- which crashed the whole
// feed's batched INSERT with a NaN-laden timestamp string. published_at
// should fall back to null instead of ever reaching the DB layer broken.
test('buildArticleRow: malformed date falls back to null instead of Invalid Date (Liberté-Algérie regression)', () => {
  const item = {
    title: 'Headline with bad date',
    link: 'https://example.com/bad-date',
    isoDate: 'not-a-real-date',
  };
  const row = buildArticleRow(BASE_FEED, item, CUTOFF);
  assert.ok(row, 'expected a row, got null');
  const publishedAt = row[9];
  assert.equal(publishedAt, null);
});

test('buildArticleRow: string author is preserved', () => {
  const item = { title: 'Headline', link: 'https://example.com/a', creator: 'Jane Doe' };
  const row = buildArticleRow(BASE_FEED, item, CUTOFF);
  assert.equal(row[7], 'Jane Doe');
});

// Regression test: Guardian/Fox News emit a structured <dc:creator>/author
// field (object or array) rather than plain text; rss-parser passes it
// through as-is, and binding a non-string object as a pg query param threw
// "Cannot convert object to primitive value" until this guard was added.
test('buildArticleRow: non-string author becomes null instead of crashing (Guardian/Fox regression)', () => {
  const item = { title: 'Headline', link: 'https://example.com/a', creator: { name: 'Jane Doe' } };
  assert.doesNotThrow(() => buildArticleRow(BASE_FEED, item, CUTOFF));
  const row = buildArticleRow(BASE_FEED, item, CUTOFF);
  assert.equal(row[7], null);
});

test('buildArticleRow: summary is truncated to 1000 characters', () => {
  const item = { title: 'Headline', link: 'https://example.com/a', summary: 'x'.repeat(2000) };
  const row = buildArticleRow(BASE_FEED, item, CUTOFF);
  assert.equal(row[4].length, 1000);
});
