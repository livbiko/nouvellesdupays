const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanHeadline } = require('../src/text');

test('cleanHeadline: decodes named and numeric entities', () => {
  assert.equal(cleanHeadline('teachers&#39; strike &amp; &quot;talks&quot; &#x2013; day 2'), 'teachers\' strike & "talks" – day 2');
});

test('cleanHeadline: decodes double-encoded entities', () => {
  assert.equal(cleanHeadline('teachers&amp;#39; strike'), "teachers' strike");
});

test('cleanHeadline: trims and collapses whitespace, strips tags', () => {
  assert.equal(cleanHeadline('\n      Minerais  critiques :\t<b>la RDC</b>  '), 'Minerais critiques : la RDC');
});

test('cleanHeadline: clean text and null pass through unchanged', () => {
  assert.equal(cleanHeadline("L'Assemblée nationale entame ses auditions"), "L'Assemblée nationale entame ses auditions");
  assert.equal(cleanHeadline(null), null);
  assert.equal(cleanHeadline('AT&T results'), 'AT&T results', 'a bare & that is not an entity is kept');
});
