// Fallback parser for feed dates written as Arabic text, which new Date()
// can't read. Youm7's RSS (2026-10-13) ships
//   <pubDate>الثلاثاء، 13 أكتوبر 2026 12:31 م</pubDate>
// -- weekday, day, month name, year, 12-hour time with ص (AM) / م (PM), in
// Cairo local time with no offset. Used only for feeds whose parser_config
// names a time zone ({ time_zone: 'Africa/Cairo' }): a wall-clock time can't
// be placed without one, and a fixed offset would be wrong across DST.

// Month names after normalize() (alef variants folded, tatweel removed).
// Egyptian/Gulf, Maghreb (French-derived) and Levantine (Syriac) spellings.
const MONTHS = [
  [1, ['يناير', 'جانفي', 'كانون الثاني']],
  [2, ['فبراير', 'فيفري', 'شباط']],
  [3, ['مارس', 'اذار']],
  [4, ['ابريل', 'افريل', 'نيسان']],
  [5, ['مايو', 'ماي', 'ايار']],
  [6, ['يونيو', 'يونيه', 'جوان', 'حزيران']],
  [7, ['يوليو', 'يوليه', 'جويلية', 'تموز']],
  [8, ['اغسطس', 'اوت', 'اب']],
  [9, ['سبتمبر', 'ايلول']],
  [10, ['اكتوبر', 'تشرين الاول']],
  [11, ['نوفمبر', 'تشرين الثاني']],
  [12, ['ديسمبر', 'كانون الاول']],
];
// Longest first, so "مايو" wins over "ماي"; names must stand alone (آب is
// also the tail of many words), with digits, spaces or commas around them.
const MONTH_RE = new RegExp(
  `(?<=^|[\\s\\d,])(${MONTHS.flatMap(([, names]) => names).sort((a, b) => b.length - a.length).join('|')})(?=$|[\\s\\d,])`,
  'g'
);
const MONTH_OF = new Map(MONTHS.flatMap(([n, names]) => names.map((name) => [name, n])));

function normalize(s) {
  return String(s)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[،٫]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

// Offset of timeZone from UTC at instant ms, in ms.
function zoneOffset(ms, timeZone) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms))) parts[p.type] = Number(p.value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - ms;
}

// Wall-clock time in timeZone -> Date. Two passes settle the offset when the
// first guess lands on the other side of a DST change.
function zonedTime(y, mo, d, h, mi, s, timeZone) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let ms = wall - zoneOffset(wall, timeZone);
  ms = wall - zoneOffset(ms, timeZone);
  return new Date(ms);
}

// Returns a Date, or null if the text isn't a recognisable Arabic date or the
// time zone is unknown.
function parseArabicDate(text, timeZone) {
  if (!text || !timeZone) return null;
  const s = normalize(text).replace(MONTH_RE, (name) => ` M${MONTH_OF.get(name)} `);
  const m = /(\d{1,2}) +M(\d{1,2}) *,? *(\d{4})(?:[ ,-]*(\d{1,2}):(\d{2})(?::(\d{2}))? *(ص|م|صباحا|مساء|مساءا)?(?=$|[ ,]))?/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[3]), Number(m[2]), Number(m[1])];
  let h = m[4] ? Number(m[4]) : 0;
  const mi = m[5] ? Number(m[5]) : 0;
  const sec = m[6] ? Number(m[6]) : 0;
  if (m[7]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[7].startsWith('م') ? 12 : 0);
  }
  if (h > 23 || mi > 59 || sec > 59) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  try {
    return zonedTime(y, mo, d, h, mi, sec, timeZone);
  } catch {
    return null; // unknown time zone name
  }
}

module.exports = { parseArabicDate };
