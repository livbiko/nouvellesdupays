const { test } = require('node:test');
const net = require('net');
const assert = require('node:assert/strict');
const { dedupHash, applyHeadlineEdits, escapeBareAmpersands, decodeFeedBody, fetchRssFeed, buildArticleRow, failingRetryHours, BACKOFF_SQL, describeError, CONNECT_ATTEMPT_TIMEOUT_MS, parseFeedXml } = require('../src/poll');

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

test('buildArticleRow: categorizes with the publisher language ("foot" is sports only in French)', () => {
  const item = { title: 'Foot : Vieira nommé sélectionneur', link: 'https://x/foot', isoDate: new Date().toISOString() };
  const category = (feed) => buildArticleRow(feed, item, CUTOFF)[8];
  assert.equal(category({ ...BASE_FEED, language: 'fr' }), 'sports');
  assert.equal(category({ ...BASE_FEED, language: 'en' }), 'other');
});

test('buildArticleRow: falls back to the URL section when no keyword matches', () => {
  const item = (link) => ({ title: 'Remi Rome i Intera', link, isoDate: new Date().toISOString() });
  assert.equal(buildArticleRow({ ...BASE_FEED, language: 'hr' }, item('https://x.hr/sportske/nogomet/remi-rome'), CUTOFF)[8], 'sports');
  assert.equal(buildArticleRow({ ...BASE_FEED, language: 'hr' }, item('https://x.hr/vijesti/remi-rome'), CUTOFF)[8], 'other');
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

// Headline cleanup (2026-10-07): 3News shipped "teachers&#39; strike",
// Jeune Afrique titles arrived with leading newlines + indentation.
test('buildArticleRow: stores a cleaned headline but hashes the raw title (no re-ingest of old rows)', () => {
  const feed = { id: 1, publisher_id: 7, country_id: 3 };
  const raw = "\n                            Government to act if teachers&#39; strike continues";
  const row = buildArticleRow(feed, { title: raw, link: 'https://x/a', isoDate: new Date().toISOString() }, 0);
  assert.equal(row[3], "Government to act if teachers' strike continues");
  assert.equal(row[10], dedupHash(7, raw), 'hash unchanged from pre-cleanup behaviour');
});

test('buildArticleRow: a title that is only whitespace/markup is skipped', () => {
  const feed = { id: 1, publisher_id: 7, country_id: 3 };
  assert.equal(buildArticleRow(feed, { title: '  <br/>  ', link: 'https://x/a' }, 0), null);
});

// Future-dated items (2026-10-08): feeds labelling local time as UTC.
test('buildArticleRow: a publication date more than 5 min in the future is replaced by the fetch time', () => {
  const feed = { id: 1, publisher_id: 7, country_id: 3 };
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const before = Date.now();
  const row = buildArticleRow(feed, { title: 'Ahead of time', link: 'https://x/f', isoDate: inOneHour }, 0);
  const stored = row[9].getTime();
  assert.ok(stored >= before && stored <= Date.now(), 'stored date is "now", not the future date');
});

test('buildArticleRow: small clock skew (< 5 min ahead) and past dates are kept as published', () => {
  const feed = { id: 1, publisher_id: 7, country_id: 3 };
  const skew = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  assert.equal(buildArticleRow(feed, { title: 'Skewed', link: 'https://x/s', isoDate: skew }, 0)[9].toISOString(), skew);
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  assert.equal(buildArticleRow(feed, { title: 'Past', link: 'https://x/p', isoDate: past }, 0)[9].toISOString(), past);
});

test('buildArticleRow: Arabic-text pubDate is parsed only when the feed names a time zone', () => {
  const item = { title: 'خبر', link: 'https://www.youm7.com/story/1', pubDate: 'الثلاثاء، 13 أكتوبر 2026 12:31 م' };
  const youm7 = { ...BASE_FEED, parser_config: { time_zone: 'Africa/Cairo' } };
  assert.equal(buildArticleRow(youm7, item, 0)[9].toISOString(), '2026-10-13T09:31:00.000Z');
  assert.equal(buildArticleRow(BASE_FEED, item, 0)[9], null);
  assert.equal(buildArticleRow({ ...BASE_FEED, parser_config: {} }, item, 0)[9], null);
  // Still subject to the age cutoff once it has a date.
  assert.equal(buildArticleRow(youm7, { ...item, pubDate: '1 يناير 2020 10:00 ص' }, CUTOFF), null);
  // A normal date on a feed with a time zone is untouched.
  const isoDate = '2026-10-13T08:00:00.000Z';
  assert.equal(buildArticleRow(youm7, { ...item, isoDate }, 0)[9].toISOString(), isoDate);
});

// Failing-feed backoff (2026-10-15): retry every 6h after a day without a success, daily after 7 days.
const NOW = Date.parse('2026-10-15T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();
const failing = (over) => ({ consecutive_failures: 5, last_fetched_at: daysAgo(0), last_success_at: null, created_at: daysAgo(80), ...over });

test('failingRetryHours: healthy feeds and fresh failures poll normally', () => {
  assert.equal(failingRetryHours(failing({ consecutive_failures: 0 }), NOW), null);
  assert.equal(failingRetryHours(failing({ last_success_at: daysAgo(0.5) }), NOW), null);
  assert.equal(failingRetryHours(failing({ last_fetched_at: null }), NOW), null);
  // a new feed that has never worked gets a full day before backing off
  assert.equal(failingRetryHours(failing({ created_at: daysAgo(0.2) }), NOW), null);
});

test('failingRetryHours: 6h after a day without a success, 24h after a week', () => {
  assert.equal(failingRetryHours(failing({ last_success_at: daysAgo(2) }), NOW), 6);
  assert.equal(failingRetryHours(failing({ last_success_at: daysAgo(6.9) }), NOW), 6);
  assert.equal(failingRetryHours(failing({ last_success_at: daysAgo(8) }), NOW), 24);
  // never succeeded: counted from when the feed was added
  assert.equal(failingRetryHours(failing({ created_at: daysAgo(3) }), NOW), 6);
  assert.equal(failingRetryHours(failing(), NOW), 24);
});

test('BACKOFF_SQL: same thresholds as failingRetryHours, never filters healthy feeds', () => {
  assert.match(BACKOFF_SQL, /f\.consecutive_failures = 0 OR f\.last_fetched_at IS NULL/);
  assert.match(BACKOFF_SQL, /interval '1 days'/);
  assert.match(BACKOFF_SQL, /interval '7 days'/);
  assert.match(BACKOFF_SQL, /interval '6 hours' ELSE interval '24 hours'/);
});

// The Baltic Times (2026-10-15): items with no date at all and a site name on every headline.
test('buildArticleRow: an undated item keeps published_at null unless the feed opts in', () => {
  const item = { title: 'No date here', link: 'https://x/u' };
  assert.equal(buildArticleRow(BASE_FEED, item, CUTOFF)[9], null);
  assert.equal(buildArticleRow({ ...BASE_FEED, parser_config: { undated: 'other' } }, item, CUTOFF)[9], null);
});

test('buildArticleRow: undated "fetch_time" stores the fetch time, one minute earlier per feed position', () => {
  const feed = { ...BASE_FEED, parser_config: { undated: 'fetch_time' } };
  const fetchedAt = Date.parse('2026-10-15T16:00:00Z');
  const at = (index) => buildArticleRow(feed, { title: `Item ${index}`, link: `https://x/${index}` }, CUTOFF, { fetchedAt, index })[9];
  assert.equal(at(0).toISOString(), '2026-10-15T16:00:00.000Z');
  assert.equal(at(3).toISOString(), '2026-10-15T15:57:00.000Z');
});

test('buildArticleRow: undated "fetch_time" leaves real dates alone', () => {
  const feed = { ...BASE_FEED, parser_config: { undated: 'fetch_time' } };
  const isoDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const row = buildArticleRow(feed, { title: 'Dated', link: 'https://x/d', isoDate }, CUTOFF, { fetchedAt: Date.now(), index: 5 });
  assert.equal(row[9].toISOString(), isoDate);
});

test('buildArticleRow: label_utc_offset_hours corrects local time labelled as UTC (Inquirer)', () => {
  const feed = { ...BASE_FEED, parser_config: { label_utc_offset_hours: 8 } };
  // Written 2 h ago in Philippine time, labelled +0000: looks 6 h in the future.
  const realUtc = new Date(Math.floor((Date.now() - 2 * 3600 * 1000) / 1000) * 1000);
  const labelled = new Date(realUtc.getTime() + 8 * 3600 * 1000).toUTCString();
  const row = buildArticleRow(feed, { title: 'Senate probe', link: 'https://x/i', pubDate: labelled }, CUTOFF);
  assert.equal(row[9].toISOString(), realUtc.toISOString(), 'shifted back 8 h instead of clamped to now');
  // Without the option the same item is clamped to the fetch time (future-date guard).
  const plain = buildArticleRow(BASE_FEED, { title: 'Senate probe', link: 'https://x/i', pubDate: labelled }, CUTOFF);
  assert.ok(Math.abs(plain[9].getTime() - Date.now()) < 5000);
  // Out-of-range or non-numeric values are ignored.
  for (const bad of [20, 'eight', null]) {
    const r = buildArticleRow({ ...BASE_FEED, parser_config: { label_utc_offset_hours: bad } }, { title: 'T', link: 'https://x/b', isoDate: realUtc.toISOString() }, CUTOFF);
    assert.equal(r[9].toISOString(), realUtc.toISOString(), `ignored: ${bad}`);
  }
});

test('buildArticleRow: label_time_zone reads the written wall time in the zone (Dnevni Avaz, FENA)', () => {
  const feed = { ...BASE_FEED, parser_config: { label_time_zone: 'Europe/Sarajevo' } };
  const real = new Date(Math.floor((Date.now() - 3600 * 1000) / 1000) * 1000);
  const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(real); // "2026-10-19 17:57:58"
  const row = buildArticleRow(feed, { title: 'Vijest', link: 'https://x/f', pubDate: local, isoDate: new Date(local + 'Z').toISOString() }, CUTOFF);
  assert.equal(row[9].toISOString(), real.toISOString());
  const bad = buildArticleRow({ ...BASE_FEED, parser_config: { label_time_zone: 'Mars/Olympus' } },
    { title: 'Vijest', link: 'https://x/g', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT', isoDate: '2026-10-19T10:00:00.000Z' }, 0);
  assert.equal(bad[9].toISOString(), '2026-10-19T10:00:00.000Z', 'unknown zone: date left as parsed');
});

test('buildArticleRow: day_first reads DD-MM-YYYY instead of new Date()\'s month-first guess (Dépêches de Brazzaville)', () => {
  const feed = { ...BASE_FEED, parser_config: { label_time_zone: 'Africa/Brazzaville', day_first: true } };
  // rss-parser sets isoDate from new Date(pubDate): 11 May for "05-11-2026", nothing for "25-11-2026".
  const early = { title: 'Brazzaville', link: 'https://x/dmy1', pubDate: '05-11-2026 10:52', isoDate: new Date('05-11-2026 10:52').toISOString() };
  const late = { title: 'Brazzaville', link: 'https://x/dmy2', pubDate: '25-10-2026 20:06' };
  assert.equal(buildArticleRow(feed, early, 0)[9].toISOString(), '2026-11-05T09:52:00.000Z');
  assert.equal(buildArticleRow(feed, late, 0)[9].toISOString(), '2026-10-25T19:06:00.000Z');
  const plain = { ...BASE_FEED, parser_config: { label_time_zone: 'Africa/Brazzaville' } };
  assert.equal(buildArticleRow(plain, early, 0)[9].toISOString().slice(0, 10), '2026-05-11', 'without day_first: month first, as before');
  assert.equal(buildArticleRow(plain, late, 0)[9], null, 'without day_first: no date, as before');
});

test('buildArticleRow: label_utc_offset_hours applies before the age cutoff', () => {
  const feed = { ...BASE_FEED, parser_config: { label_utc_offset_hours: 8 } };
  // Labelled just inside the cutoff, really 8 h older -> outside it.
  const labelled = new Date(CUTOFF + 3600 * 1000).toISOString();
  assert.equal(buildArticleRow(feed, { title: 'Old', link: 'https://x/o', isoDate: labelled }, CUTOFF), null);
});

test('buildArticleRow: title_prefix is removed from the headline but not from the dedup hash (Hoy.com.py)', () => {
  const feed = { ...BASE_FEED, parser_config: { title_prefix: 'Diario HOY | ' } };
  const raw = 'Diario HOY | La crecida del río Paraguay pone a prueba a los ribereños';
  const row = buildArticleRow(feed, { title: raw, link: 'https://x/h', isoDate: new Date().toISOString() }, CUTOFF);
  assert.equal(row[3], 'La crecida del río Paraguay pone a prueba a los ribereños');
  assert.equal(row[10], dedupHash(BASE_FEED.publisher_id, raw));
  const other = buildArticleRow(feed, { title: 'Sin prefijo', link: 'https://x/s', isoDate: new Date().toISOString() }, CUTOFF);
  assert.equal(other[3], 'Sin prefijo');
  assert.equal(buildArticleRow(feed, { title: 'Diario HOY | ', link: 'https://x/e', isoDate: new Date().toISOString() }, CUTOFF), null, 'nothing left after the prefix: skipped');
});

test('buildArticleRow: title_suffix is removed from the headline but not from the dedup hash', () => {
  const feed = { ...BASE_FEED, parser_config: { title_suffix: ' - The Baltic Times' } };
  const raw = ' Gap opens its first store in Estonia at Ülemiste Centre  - The Baltic Times';
  const row = buildArticleRow(feed, { title: raw, link: 'https://x/g', isoDate: new Date().toISOString() }, CUTOFF);
  assert.equal(row[3], 'Gap opens its first store in Estonia at Ülemiste Centre');
  assert.equal(row[10], dedupHash(BASE_FEED.publisher_id, raw));
  const other = buildArticleRow(feed, { title: 'No suffix here', link: 'https://x/n', isoDate: new Date().toISOString() }, CUTOFF);
  assert.equal(other[3], 'No suffix here');
});

test('describeError: plain errors keep their message', () => {
  assert.equal(describeError(new Error('HTTP 403')), 'HTTP 403');
});

test('describeError: fetch failed gets the cause code and message', () => {
  const err = new TypeError('fetch failed', {
    cause: Object.assign(new Error('Connect Timeout Error (attempted address: example.com:443, timeout: 10000ms)'),
      { code: 'UND_ERR_CONNECT_TIMEOUT' }),
  });
  assert.equal(describeError(err),
    'fetch failed (UND_ERR_CONNECT_TIMEOUT: Connect Timeout Error (attempted address: example.com:443, timeout: 10000ms))');
});

test('describeError: cause message that already starts with the code is not repeated', () => {
  const err = new TypeError('fetch failed', { cause: Object.assign(new Error('ECONNRESET read'), { code: 'ECONNRESET' }) });
  assert.equal(describeError(err), 'fetch failed (ECONNRESET read)');
});

test('describeError: cause with only a code, long cause messages are cut', () => {
  assert.equal(describeError(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })), 'fetch failed (ENOTFOUND)');
  const long = new TypeError('fetch failed', { cause: Object.assign(new Error('x'.repeat(300)), { code: 'E' }) });
  assert.equal(describeError(long).length, 'fetch failed (E: )'.length + 120);
});

test('describeError: non-Error values do not throw', () => {
  assert.equal(describeError('boom'), 'boom');
  assert.equal(describeError(new Error('fetch failed', { cause: 'string cause' })), 'fetch failed');
});

test('loading the poller widens the per-address connect window (happy eyeballs)', () => {
  assert.equal(CONNECT_ATTEMPT_TIMEOUT_MS, 2500);
  assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), CONNECT_ATTEMPT_TIMEOUT_MS);
});

// Build #159 (2026-11-05): one shared rss-parser instance leaked xml2js state between feeds, and La Prensa (PA)
// stored whole feeds of other publishers. Each parse now gets its own parser.
const rssDoc = (host, n) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${host}</title>` +
  Array.from({ length: n }, (_, i) => `<item><title>${host} story ${i}</title><link>https://${host}/a${i}</link></item>`).join('') +
  '</channel></rss>';

test('parseFeedXml: a broken feed is still rejected after a feed with junk after its root element', async () => {
  const withTrailingJunk = await parseFeedXml(rssDoc('a.example', 2) + '\n junk after the root element');
  assert.equal(withTrailingJunk.items.length, 2);
  const broken = rssDoc('b.example', 3).replace('</channel>', '<item><title>bad \u0001 char & < </title></item></channel>');
  await assert.rejects(parseFeedXml(broken));
});

test('parseFeedXml: parses running at the same time each get their own items', async () => {
  const hosts = ['a.example', 'b.example', 'c.example', 'd.example'];
  const results = await Promise.all(hosts.map((h, i) => parseFeedXml(rssDoc(h, i + 1))));
  results.forEach((feed, i) => {
    assert.equal(feed.items.length, i + 1);
    assert.ok(feed.items.every((it) => new URL(it.link).host === hosts[i]));
  });
});

test('buildArticleRow: exclude_title_pattern skips matching headlines and keeps the rest', () => {
  const feed = { ...BASE_FEED, parser_config: { exclude_title_pattern: String.raw`\b(casino|slots?|sportsbook)\b` } };
  const now = new Date().toISOString();
  assert.equal(buildArticleRow(feed, { title: 'Slot Mafia Casino: Quick-Hit Play', link: 'https://x.example/1', isoDate: now }, CUTOFF), null);
  assert.equal(buildArticleRow(feed, { title: 'FIXBET CASINO ve Sportsbook', link: 'https://x.example/2', isoDate: now }, CUTOFF), null);
  assert.ok(buildArticleRow(feed, { title: 'Inflation Hits 5.58 Percent', link: 'https://x.example/3', isoDate: now }, CUTOFF));
  assert.ok(buildArticleRow(BASE_FEED, { title: 'Slot Mafia Casino', link: 'https://x.example/4', isoDate: now }, CUTOFF),
    'feeds without the option are unaffected');
});

test('buildArticleRow: an invalid exclude_title_pattern is ignored instead of failing the feed', () => {
  const feed = { ...BASE_FEED, parser_config: { exclude_title_pattern: '(unclosed' } };
  assert.ok(buildArticleRow(feed, { title: 'Headline', link: 'https://x.example/5', isoDate: new Date().toISOString() }, CUTOFF));
});

test('decodeFeedBody: ISO-8859-1 feeds keep their accents, UTF-8 feeds read as before (Folha, Correio da Manhã)', () => {
  const latin1 = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss><title>Polícia Judiciária</title></rss>', 'latin1');
  assert.match(decodeFeedBody(latin1, 'text/xml'), /Polícia Judiciária/, 'charset from the XML declaration');
  assert.match(decodeFeedBody(latin1, 'text/xml; charset=ISO-8859-1'), /Polícia Judiciária/, 'charset from the header');
  const utf8 = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss><title>Polícia Judiciária</title></rss>', 'utf8');
  assert.match(decodeFeedBody(utf8, 'text/xml; charset=ISO-8859-1'), /Polícia Judiciária/, 'valid UTF-8 wins over a wrong label');
  assert.match(decodeFeedBody(Buffer.from('﻿<rss>é</rss>', 'utf8'), null), /^<rss>é<\/rss>$/, 'BOM dropped, no label needed');
  assert.match(decodeFeedBody(latin1, 'text/xml; charset=x-unknown-label'), /Polícia Judiciária/, 'unknown header label: the XML declaration is used');
});

test('buildArticleRow: an escaped CDATA title is kept, not dropped (Correio da Manhã)', () => {
  const feed = { id: 539, publisher_id: 539, country_id: 1, parser_config: {}, language: 'pt' };
  const now = Date.now();
  const row = buildArticleRow(feed, { title: '<![CDATA[ Polícia Judiciária faz diligências ]]>', link: 'https://www.cmjornal.pt/portugal/detalhe/x', isoDate: new Date(now - 60000).toISOString() }, now - 14 * 864e5, { fetchedAt: now });
  assert.equal(row[3], 'Polícia Judiciária faz diligências');
});

test('fetchRssFeed: accept_encoding identity is sent only when the feed asks for it (En Segundos)', async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    seen.push(opts.headers['Accept-Encoding']);
    return new Response('<rss version="2.0"><channel><title>t</title><item><title>a</title><link>https://x/a</link></item></channel></rss>',
      { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  };
  try {
    await fetchRssFeed({ feed_url: 'https://x/feed', parser_config: { accept_encoding: 'identity' } });
    await fetchRssFeed({ feed_url: 'https://x/feed', parser_config: {} });
    await fetchRssFeed({ feed_url: 'https://x/feed' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(seen, ['identity', undefined, undefined]);
});

// Edited headlines (live blogs, corrections) used to be stored as new articles
// because the dedup hash is publisher + headline (8.7% of a week's rows,
// 2026-11-06). A URL the publisher already holds now updates that row.
function fakePool(held) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/^\s*SELECT DISTINCT ON \(original_url\)/.test(sql)) {
        return { rows: held.filter((h) => params[1].includes(h.original_url)) };
      }
      if (/^\s*UPDATE articles/.test(sql)) return { rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

function row(url, headline) {
  return [1, 7, 3, headline, 'summary', null, url, null, 'other', new Date('2026-11-06T12:00:00Z'), dedupHash(7, headline)];
}

test('applyHeadlineEdits: new URLs are returned for insert, held URLs with a new headline are updated', async () => {
  const pool = fakePool([{ id: 50, original_url: 'https://x.test/live', dedup_hash: dedupHash(7, 'Live: polls open') }]);
  const rows = [row('https://x.test/live', 'Live: first results'), row('https://x.test/new', 'A new story')];
  const { newRows, updated } = await applyHeadlineEdits(pool, 7, rows);
  assert.deepEqual(newRows.map((r) => r[6]), ['https://x.test/new']);
  assert.equal(updated, 1);
  const upd = pool.calls.find((c) => /^\s*UPDATE/.test(c.sql));
  assert.equal(upd.params[0], 50);
  assert.equal(upd.params[1], 'Live: first results');
  assert.equal(upd.params[7], dedupHash(7, 'Live: first results'));
});

test('applyHeadlineEdits: a held URL with the same headline is neither inserted nor updated', async () => {
  const pool = fakePool([{ id: 50, original_url: 'https://x.test/a', dedup_hash: dedupHash(7, 'Same') }]);
  const { newRows, updated } = await applyHeadlineEdits(pool, 7, [row('https://x.test/a', 'Same')]);
  assert.equal(newRows.length, 0);
  assert.equal(updated, 0);
  assert.equal(pool.calls.filter((c) => /^\s*UPDATE/.test(c.sql)).length, 0);
});

test('applyHeadlineEdits: a URL listed twice in one feed keeps its first item', async () => {
  const pool = fakePool([]);
  const { newRows } = await applyHeadlineEdits(pool, 7, [row('https://x.test/a', 'Newest'), row('https://x.test/a', 'Older')]);
  assert.deepEqual(newRows.map((r) => r[3]), ['Newest']);
});

test('applyHeadlineEdits: no rows means no query', async () => {
  const pool = fakePool([]);
  const { newRows, updated } = await applyHeadlineEdits(pool, 7, []);
  assert.deepEqual([newRows.length, updated, pool.calls.length], [0, 0, 0]);
});
