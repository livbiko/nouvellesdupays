const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categorize, urlSectionCategory } = require('../src/categories');

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
  assert.equal(categorize([], 'Foot : le PSG s’impose à Lens', 'fr'), 'sports');
  assert.equal(categorize([], 'NRL vs AFL: who does footy finals better?'), 'sports');
  assert.equal(categorize([], 'Team USA wins fifth straight World Cup'), 'sports');
  assert.equal(categorize([], 'Messi a câștigat Cupa'), 'sports');
  assert.equal(categorize([], 'Bendel Insurance shine on matchday 4'), 'sports');
  assert.equal(categorize([], 'Le ministère de la Santé lance une campagne'), 'politics');
  assert.equal(categorize([], 'Une campagne de santé à Kaolack'), 'health');
  assert.equal(categorize([], 'Tech startups raise $20m'), 'technology');
});

// Regression (2026-10-14, 30-day audit): English "foot" is mostly a measurement or an idiom.
test('categorize: whole-word "foot" is sports only for French-language publishers', () => {
  for (const lang of ['fr', 'FR', 'fr-CA', 'fr_BE']) {
    assert.equal(categorize([], 'Foot : le PSG s’impose à Lens', lang), 'sports', lang);
    assert.equal(categorize(['Foot'], 'Vieira nommé sélectionneur', lang), 'sports', lang);
  }
  for (const [h, lang] of [
    ['Hiker survives 25-foot fall into ravine', 'en'],
    ['Opposition shoots itself in the foot', 'en'],
    ['Crews raise a 50-foot flagpole', undefined],
    ['Sailors cross the bay on a 100-foot racing yacht', 'it'],
    ['Le nouveau Foot de quartier', 'fro'],
  ]) assert.equal(categorize([], h, lang), 'other', `${lang}: ${h}`);
  assert.equal(categorize([], 'Farmers warned over foot-and-mouth disease outbreak', 'en'), 'health');
  // other sports words still match in any language
  assert.equal(categorize([], 'Cleary out with foot injury before league decider', 'en'), 'sports');
  assert.equal(categorize([], 'Foot : le PSG s’impose à Lens en Ligue 1 football', 'en'), 'sports');
});

// Regression (2026-10-14): French transfer news ("Mercato : ...") was other; Foot Mercato quoted in Greek too.
test('categorize: "mercato" is sports for French publishers; "Foot Mercato" in any language', () => {
  assert.equal(categorize([], 'Mercato : Lucas Digne rejoint officiellement le PSG', 'fr'), 'sports');
  assert.equal(categorize([], 'Le journal du mercato : l’OM va céder Leonardo Balerdi', 'fr'), 'sports');
  assert.equal(categorize([], 'Mercato : Ferran Torres au PSG', undefined), 'other');
  // Italian "mercato" is a market (publisher-language keywords, last pass), never sports
  assert.equal(categorize([], 'Giovani esclusi dal mercato abitativo', 'it'), 'business');
  assert.equal(categorize([], 'La mercatique digitale des PME', 'fr'), 'technology');
  assert.equal(categorize([], 'Une campagne de mercatique à Dakar', 'fr'), 'other');
  assert.equal(categorize([], '«Βόμβα» από Foot Mercato: Ο Λιονέλ Μέσι σταματά', 'el'), 'sports');
  assert.equal(categorize([], 'Selon Foot Mercato, Messi arrête', 'en'), 'sports');
  assert.equal(categorize([], 'Hiker survives 25-foot fall near the mercato', 'en'), 'other');
});

// Phase 1 (2026-10-14): URL section folders as a fallback when no keyword matches.
test('urlSectionCategory: reads only the folders between the host and the slug', () => {
  assert.equal(urlSectionCategory('https://elcomercio.pe/deporte-total/futbol-peruano/peru-vs-x-noticia/'), 'sports');
  assert.equal(urlSectionCategory('https://www.spiegel.de/politik/deutschland/merz-a-123.html'), 'politics');
  assert.equal(urlSectionCategory('https://x.com/es/deportes/futbol/slug?utm=politik#top'), 'sports');
  assert.equal(urlSectionCategory('https://x.com/news/WIRTSCHAFT/slug'), 'business');
  // the slug and the host never count
  assert.equal(urlSectionCategory('https://x.com/news/sport'), null);
  assert.equal(urlSectionCategory('https://sport.example.com/news/slug'), null);
  assert.equal(urlSectionCategory('https://x.com/sport'), null);
  // generic, dropped or unknown folders
  assert.equal(urlSectionCategory('https://x.com/news/world/slug'), null);
  assert.equal(urlSectionCategory('https://x.com/tv/video/slug'), null);
  assert.equal(urlSectionCategory('https://x.com/gazdasag/slug'), null);
  assert.equal(urlSectionCategory('https://x.com/salud/slug'), null);
  assert.equal(urlSectionCategory(undefined), null);
  assert.equal(urlSectionCategory(''), null);
});

test('categorize: the URL section is used only when no keyword matches', () => {
  assert.equal(categorize([], 'Barcelona recibe a Racing de Santander', 'es', 'https://x.cl/el-deportivo/2026/10/slug/'), 'sports');
  assert.equal(categorize([], 'Gericht stoppt Gesetzentwurf', 'de', 'https://x.de/politik/deutschland/slug'), 'politics');
  assert.equal(categorize([], 'Gericht stoppt Gesetzentwurf', 'de', 'https://x.de/panorama/slug'), 'other');
  assert.equal(categorize([], 'Gericht stoppt Gesetzentwurf', 'de'), 'other');
  // a keyword still wins over the URL section
  assert.equal(categorize([], 'Election results announced', 'en', 'https://x.com/sport/slug'), 'politics');
  assert.equal(categorize(['Sport'], 'Kanzleramt', 'de', 'https://x.de/politik/slug'), 'sports');
});

test('categorize: "mercato de la mode" is not football transfer news', () => {
  assert.equal(categorize([], 'A l’issue du grand mercato de la mode, les femmes designers écartées', 'fr'), 'other');
  assert.equal(categorize([], 'Mercato : Lucas Digne rejoint le PSG', 'fr'), 'sports');
  assert.equal(categorize([], 'Le mercato des créateurs de mode', 'fr'), 'sports');
});

test('categorize: publisher-language keywords as the last pass', () => {
  assert.equal(categorize([], 'Pedro Sánchez anuncia elecciones anticipadas', 'es'), 'politics');
  assert.equal(categorize([], 'Governo anuncia novo pacote', 'pt-BR'), 'politics');
  assert.equal(categorize([], 'Le gouvernement annonce un remaniement', 'fr'), 'politics');
  assert.equal(categorize([], 'Regierung plant Reform', 'de'), 'politics');
  assert.equal(categorize([], 'Timnas Indonesia menang 2-0', 'id'), 'sports');
  assert.equal(categorize([], 'Vlada usvojila budžet', 'bs'), 'politics');
  assert.equal(categorize([], 'Tekoäly mullistaa työelämän', 'fi'), 'technology');
  assert.equal(categorize([], 'US senator urges new sanctions', 'en'), 'politics');
  // only for that language
  assert.equal(categorize([], 'Regierung plant Reform', 'en'), 'other');
  assert.equal(categorize([], 'Governo anuncia novo pacote'), 'other');
  // never changes a keyword or URL section result
  assert.equal(categorize([], 'Gobierno presenta plan de economía', 'es'), 'business');
  assert.equal(categorize([], 'Gobierno visita el estadio', 'es', 'https://x.com/deportes/slug'), 'sports');
});

test('categorize: publisher-language keyword traps stay other', () => {
  assert.equal(categorize([], 'Ottawa Senators rally past Nashville', 'en'), 'other');
  assert.equal(categorize([], 'Man films himself in tiger enclosure', 'en'), 'other');
  assert.equal(categorize([], 'Nizozemac postao izbornik Hrvatske', 'hr'), 'other');
  assert.equal(categorize([], 'Danny Noppert begonnen aan partij', 'nl'), 'other');
  assert.equal(categorize([], 'Leo/Daniel gagal amankan kemenangan partai keempat', 'id'), 'other');
  assert.equal(categorize([], 'Rutan Wates beri pelatihan kerajinan', 'id'), 'other');
  assert.equal(categorize([], 'Syytetään murhan yrityksestä', 'fi'), 'other');
  assert.equal(categorize([], 'Les acteurs concernés à l’école des textes', 'fr'), 'other');
  assert.equal(categorize([], 'Governanta de Virginia se emociona', 'pt'), 'other');
  assert.equal(categorize([], 'Cambios en la producción de carne vacuna', 'es'), 'other');
  assert.equal(categorize([], 'GOL abre rota entre Lisboa e Rio', 'pt'), 'other');
  assert.equal(categorize([], 'Motociklist preminuo u bolnici', 'hr'), 'other');
  assert.equal(categorize([], 'Trump amplía las deportaciones', 'es'), 'other');
  assert.equal(categorize([], 'Vuelta al cole: 6 meriendas saludables', 'es'), 'other');
  assert.equal(categorize([], 'Horóscopo de hoy: las predicciones para la salud, el amor y el dinero', 'es'), 'other');
  assert.equal(categorize([], 'Charlotte Tilbury shares the product she recommends', 'en'), 'other');
  assert.equal(categorize([], 'Spyware used by Iranian state actors to target dissidents', 'en'), 'other');
  assert.equal(categorize([], '4 killed in airstrikes in Al-Jawf governorate', 'en'), 'other');
  assert.equal(categorize([], 'Nouvelles découvertes dans le gouvernorat de Port-Saïd', 'fr'), 'other');
  assert.equal(categorize([], 'HGSS spasio strankinju na Dinari', 'hr'), 'other');
  // the whole-word forms still count
  assert.equal(categorize([], 'Jornada de salud en escuelas rurales', 'es'), 'health');
  assert.equal(categorize([], 'Governor signs the budget', 'en'), 'politics');
  assert.equal(categorize([], 'Stranka traži nove izbore', 'hr'), 'politics');
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
