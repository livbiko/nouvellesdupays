// Plain-text helpers shared by the worker (ingestion), the crawler and the
// API (output). Feeds frequently ship headlines with HTML entities
// ("teachers&#39; strike"), sometimes double-encoded ("&amp;#39;"), and with
// leading newlines/indentation copied from the publisher's CMS template.

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function cleanText(s, max = 1000) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Headlines: tags stripped, entities decoded (twice, for double-encoded
// feeds -- a second pass is a no-op on already-clean text), whitespace
// collapsed. Never returns more than the input's own text.
function cleanHeadline(s) {
  if (s === null || s === undefined) return s;
  const once = cleanText(s, 2000);
  return /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(once) ? cleanText(once, 2000) : once;
}

module.exports = { decodeEntities, cleanText, cleanHeadline };
