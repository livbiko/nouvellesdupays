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

test('decodeEntities: typographic and accented named entities, also double-encoded', () => {
  const { decodeEntities } = require('../src/text');
  assert.equal(decodeEntities('Logements de l&rsquo;Etat'), 'Logements de l’Etat');
  assert.equal(decodeEntities('&laquo; Si le Mali veut &hellip; &raquo;'), '« Si le Mali veut … »');
  assert.equal(decodeEntities('D&eacute;c&egrave;s &agrave; Touba'), 'Décès à Touba');
  assert.equal(decodeEntities('l&amp;rsquo;h&ocirc;pital'), 'l’hôpital', 'double-encoded');
  assert.equal(decodeEntities('AT&amp;T &amp; co'), 'AT&T & co', 'plain &amp; unchanged');
  assert.equal(decodeEntities('&unknownentity;'), '&unknownentity;', 'unknown names left alone');
});
