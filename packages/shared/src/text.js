// Plain-text helpers shared by the worker (ingestion), the crawler and the
// API (output). Feeds frequently ship headlines with HTML entities
// ("teachers&#39; strike"), sometimes double-encoded ("&amp;#39;"), and with
// leading newlines/indentation copied from the publisher's CMS template.

// Typographic and Latin-1 named entities seen in African publishers' feeds
// and meta tags ("l&rsquo;Etat", "&laquo; ... &raquo;", "&eacute;").
const NAMED = {
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', sbquo: '‚', bdquo: '„',
  laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', bull: '•',
  middot: '·', deg: '°', euro: '€', copy: '©', reg: '®', trade: '™',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', ccedil: 'ç', egrave: 'è', eacute: 'é',
  ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò',
  oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê',
  Iacute: 'Í', Ocirc: 'Ô', Oacute: 'Ó', Uacute: 'Ú', oelig: 'œ', OElig: 'Œ', szlig: 'ß',
};
const NAMED_RE = new RegExp(`&(${Object.keys(NAMED).join('|')});`, 'g');

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(NAMED_RE, (_, n) => NAMED[n])
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    // double-encoded named entity ("&amp;rsquo;" -> "&rsquo;" above)
    .replace(NAMED_RE, (_, n) => NAMED[n]);
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
