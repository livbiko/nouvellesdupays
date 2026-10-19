const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseArabicDate, parseWallClock } = require('../src/dates');

const wall = (text, tz) => parseWallClock(text, tz)?.toISOString() ?? null;

test('parseWallClock: label ignored, wall time placed in the zone (Cairo 24, Avaz, FENA)', () => {
  assert.equal(wall('Mon, 19 Oct 2026 18:52:51 GMT', 'Africa/Cairo'), '2026-10-19T15:52:51.000Z');
  assert.equal(wall('Mon, 19 Oct 2026 17:54:25 +0100', 'Europe/Sarajevo'), '2026-10-19T15:54:25.000Z');
  assert.equal(wall('2026-10-19 17:57:58', 'Europe/Sarajevo'), '2026-10-19T15:57:58.000Z');
  assert.equal(wall('2026-10-19T17:57:58+01:00', 'Europe/Sarajevo'), '2026-10-19T15:57:58.000Z');
});

test('parseWallClock: follows DST ends (Sarajevo 25 Oct, Cairo 29-30 Oct 2026)', () => {
  assert.equal(wall('Sat, 24 Oct 2026 12:00:00 +0100', 'Europe/Sarajevo'), '2026-10-24T10:00:00.000Z');
  assert.equal(wall('Mon, 26 Oct 2026 12:00:00 +0100', 'Europe/Sarajevo'), '2026-10-26T11:00:00.000Z');
  assert.equal(wall('Thu, 29 Oct 2026 10:00:00 GMT', 'Africa/Cairo'), '2026-10-29T07:00:00.000Z');
  assert.equal(wall('Fri, 30 Oct 2026 10:00:00 GMT', 'Africa/Cairo'), '2026-10-30T08:00:00.000Z');
});

test('parseWallClock: unknown zone or unrecognised text gives null', () => {
  assert.equal(wall('Mon, 19 Oct 2026 18:52:51 GMT', 'Mars/Olympus'), null);
  assert.equal(wall('yesterday evening', 'Africa/Cairo'), null);
  assert.equal(wall('', 'Africa/Cairo'), null);
  assert.equal(wall('Mon, 19 Oct 2026 18:52:51 GMT', ''), null);
});

const iso = (text, tz = 'Africa/Cairo') => parseArabicDate(text, tz)?.toISOString() ?? null;

test('parseArabicDate: Youm7 pubDate, PM and AM, Cairo summer time (UTC+3)', () => {
  assert.equal(iso('الثلاثاء، 13 أكتوبر 2026 12:31 م'), '2026-10-13T09:31:00.000Z');
  assert.equal(iso('الثلاثاء، 13 أكتوبر 2026 11:33 ص'), '2026-10-13T08:33:00.000Z');
  assert.equal(iso('الثلاثاء، 13 أكتوبر 2026 09:05 م'), '2026-10-13T18:05:00.000Z');
  assert.equal(iso('الأربعاء، 14 أكتوبر 2026 12:10 ص'), '2026-10-13T21:10:00.000Z');
});

test('parseArabicDate: follows the time zone across Cairo\'s DST end (29-30 Oct 2026)', () => {
  assert.equal(iso('الخميس، 29 أكتوبر 2026 10:00 ص'), '2026-10-29T07:00:00.000Z');
  assert.equal(iso('الجمعة، 30 أكتوبر 2026 10:00 ص'), '2026-10-30T08:00:00.000Z');
  assert.equal(iso('الأحد، 10 يناير 2027 08:00 م'), '2027-01-10T18:00:00.000Z');
});

test('parseArabicDate: spelling variants, Arabic-Indic digits, 24-hour time, date only', () => {
  assert.equal(iso('13 اكتوبر 2026 14:20'), '2026-10-13T11:20:00.000Z');
  assert.equal(iso('١٣ أكتوبر ٢٠٢٦ ١٢:٣١ م'), '2026-10-13T09:31:00.000Z');
  assert.equal(iso('5 تشرين الأول 2026', 'Asia/Beirut'), '2026-10-04T21:00:00.000Z');
  assert.equal(iso('1 آب 2026 10:00 ص', 'UTC'), '2026-08-01T10:00:00.000Z');
  assert.equal(iso('7 جويلية 2026 18:00', 'Africa/Algiers'), '2026-07-07T17:00:00.000Z');
  assert.equal(iso('3 مايو 2026'), '2026-05-02T21:00:00.000Z');
});

test('parseArabicDate: null without a time zone, for unknown text, bad dates or an unknown zone', () => {
  assert.equal(parseArabicDate('13 أكتوبر 2026 12:31 م'), null);
  assert.equal(iso('ليس تاريخا'), null);
  assert.equal(iso('الكتاب 2026'), null);
  assert.equal(iso('31 فبراير 2026'), null);
  assert.equal(iso('13 أكتوبر 2026 13:31 م'), null);
  assert.equal(iso('13 أكتوبر 2026 12:31 م', 'Not/AZone'), null);
});
