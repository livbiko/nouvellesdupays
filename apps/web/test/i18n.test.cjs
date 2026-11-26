// CR-2026-11-25-06: tests for the /youtube translation system. Run: node --test test/ (from apps/web).
// src/i18n/index.ts is compiled on the fly with the project's TypeScript (no extra test dependency).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');
const I18N = path.join(SRC, 'i18n', 'index.ts');

// .ts files are compiled on require (index.ts imports its JSON dictionaries; routing.ts imports index.ts).
require.extensions['.ts'] = (m, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, resolveJsonModule: true },
  }).outputText;
  m._compile(out, filename);
};
function loadI18n() {
  return require(I18N);
}
const i18n = loadI18n();
const fr = require('../src/i18n/fr.json');
const LANGS = ['en', 'pt', 'es', 'ar', 'de', 'it', 'zh', 'sw'];
const dicts = Object.fromEntries(LANGS.map((l) => [l, require(`../src/i18n/${l}.json`)]));

test('every language is registered and has a dictionary', () => {
  assert.deepEqual([...i18n.LOCALES].sort(), ['fr', ...LANGS].sort());
  for (const l of i18n.LOCALES) assert.ok(i18n.LOCALE_LABELS[l] && i18n.intlLocale(l) && i18n.ogLocale(l), l);
});

test('every dictionary has the same keys as French, no empty text, the same {placeholders}', () => {
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [l, d] of Object.entries(dicts)) {
    assert.deepEqual(Object.keys(d).sort(), Object.keys(fr).sort(), `${l}: keys differ from fr`);
    for (const k of Object.keys(fr)) {
      assert.ok(d[k].trim(), `${l}: empty text for ${k}`);
      assert.deepEqual(vars(d[k]), vars(fr[k]), `${l}: placeholders differ for ${k}`);
    }
  }
});

// Every literal key used in the code exists: t('key'), tn('key', ...), t(locale, 'key').
test('every key the code uses exists', () => {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name)) files.push(p);
  });
  walk(SRC);
  const missing = [];
  let used = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\btn?\(\s*(?:locale\s*,\s*)?'([a-zA-Z0-9_.-]+)'/g)) {
      used++;
      const k = m[1];
      if (!(k in fr) && !(`${k}_one` in fr && `${k}_other` in fr)) missing.push(`${path.relative(SRC, f)}: ${k}`);
    }
  }
  assert.ok(used > 150, `only ${used} keys found - the pattern no longer matches the code`);
  assert.deepEqual(missing, []);
});

// Keys built from a value (t(`type.${key}`)...) exist for every value the API or the code can produce.
test('keys built from values exist for every value', () => {
  const families = {
    type: ['tv-nationale', 'tv-continu', 'voix-locales', 'voix-panafricaines', 'media-en-ligne', 'createur-independant', 'collectif'],
    continent: ['afrique', 'europe', 'amerique-nord', 'amerique-sud', 'moyen-orient', 'asie', 'oceanie'],
    region: ['afrique-de-l-ouest', 'afrique-centrale', 'afrique-de-l-est', 'afrique-du-nord', 'afrique-australe'],
    place: ['afrique', 'afrique-de-l-ouest', 'afrique-centrale', 'afrique-de-l-est', 'afrique-du-nord', 'afrique-australe', 'europe', 'asie', 'moyen-orient', 'amerique-du-nord', 'amerique-du-sud', 'oceanie', 'categorie'],
    language: ['fr', 'en', 'ar', 'pt', 'es', 'sw'],
    sort: ['populaires', 'vues', 'score', 'croissance', 'alpha'],
    'home.tab': ['decouvrir', 'dernieres-videos', 'chaines', 'independants', 'pays', 'categories', 'classements', 'videos'],
    'lead.interest': ['politics', 'business', 'sports', 'entertainment', 'technology', 'health', 'videos', 'local_voices'],
    'country.kind': ['individual', 'group', 'media_brand'],
    'country.filter': ['all', 'individual', 'media_brand'],
    'country.sort': ['score', 'abonnes'],
    'landing.category': ['news', 'politics', 'business', 'technology', 'sports', 'health', 'entertainment', 'culture', 'education', 'documentary', 'interview', 'other'],
  };
  for (const [prefix, values] of Object.entries(families)) for (const v of values) assert.ok(`${prefix}.${v}` in fr, `${prefix}.${v}`);
});

test('language choice: saved choice, then the browser, then French', () => {
  const { chooseLocale } = i18n;
  assert.deepEqual(chooseLocale('en', 'fr-FR,fr;q=0.9'), { locale: 'en', source: 'cookie' }, 'saved choice wins');
  assert.deepEqual(chooseLocale(null, 'en-GB,en;q=0.9,fr;q=0.8'), { locale: 'en', source: 'browser' });
  assert.deepEqual(chooseLocale(undefined, 'fr-CI,fr;q=0.9,en;q=0.5'), { locale: 'fr', source: 'browser' });
  assert.deepEqual(chooseLocale('xx', 'ja-JP,ko;q=0.8,en;q=0.3'), { locale: 'en', source: 'browser' }, 'first supported language, an unknown cookie is ignored');
  assert.deepEqual(chooseLocale(null, 'fr;q=0.2,en;q=0.9'), { locale: 'en', source: 'browser' }, 'by weight');
  assert.deepEqual(chooseLocale(null, 'de-DE,ja'), { locale: 'de', source: 'browser' }, 'German is supported since part 2b');
  assert.deepEqual(chooseLocale(null, 'ja,ko'), { locale: 'fr', source: 'default' }, 'nothing supported -> French, country step allowed');
  assert.deepEqual(chooseLocale(null, 'pt-BR,pt;q=0.9'), { locale: 'pt', source: 'browser' });
  assert.deepEqual(chooseLocale(null, 'ar-EG'), { locale: 'ar', source: 'browser' });
  assert.deepEqual(chooseLocale(null, 'zh-Hans-CN,zh;q=0.9'), { locale: 'zh', source: 'browser' });
  assert.deepEqual(chooseLocale('sw', 'en'), { locale: 'sw', source: 'cookie' });
  assert.deepEqual(chooseLocale(null, null), { locale: 'fr', source: 'default' }, 'crawler without headers -> French');
  assert.deepEqual(chooseLocale(null, 'en;q=0'), { locale: 'fr', source: 'default' }, 'q=0 means not acceptable');
});

test('country suggestions from the brief', () => {
  const { fromCountry } = i18n;
  assert.equal(fromCountry('CI'), 'fr');
  assert.equal(fromCountry('sn'), 'fr');
  assert.equal(fromCountry('NG'), 'en');
  assert.equal(fromCountry('GB'), 'en');
  assert.equal(fromCountry('US'), 'en');
  assert.equal(fromCountry('BR'), 'pt');
  assert.equal(fromCountry('MZ'), 'pt');
  assert.equal(fromCountry('AO'), 'pt');
  assert.equal(fromCountry('ES'), 'es');
  assert.equal(fromCountry('EG'), 'ar', 'Egypt -> Arabic (brief)');
  assert.equal(fromCountry('MA'), 'fr', 'Morocco: Arabic or French by preference - the browser decides first');
  assert.equal(fromCountry('TZ'), 'sw');
  assert.equal(fromCountry('KE'), 'en', 'Kenya: English or Swahili by preference');
  assert.equal(fromCountry('DE'), 'de');
  assert.equal(fromCountry('IT'), 'it');
  assert.equal(fromCountry('CN'), 'zh');
  assert.equal(fromCountry('JP'), null, 'no supported language -> French default');
  assert.equal(fromCountry(null), null);
});

test('text, plurals, fallbacks and names', () => {
  const { t, tn, countryName, categoryName } = i18n;
  assert.equal(t('fr', 'banner.title'), 'Voix indépendantes africaines');
  assert.equal(t('en', 'banner.title'), 'African independent voices');
  assert.equal(t('en', 'card.subscribers', { n: '1,2 k' }), '1,2 k subscribers');
  assert.equal(t('en', 'no.such.key'), 'no.such.key', 'a missing key never renders blank');
  assert.equal(tn('fr', 'filters.results', 0), '0 résultat', 'French: 0 is singular, as before');
  assert.equal(tn('fr', 'filters.results', 2), '2 résultats');
  assert.equal(tn('en', 'filters.results', 1), '1 result');
  assert.equal(tn('en', 'filters.results', 0), '0 results');
  assert.equal(countryName('fr', 'GB'), 'Royaume-Uni');
  assert.equal(countryName('en', 'CI'), 'Côte d’Ivoire');
  assert.equal(countryName('en', 'ZZ', 'Fallback'), 'Fallback', 'CLDR "Unknown Region" is not a name');
  assert.equal(countryName('en', 'QQ', 'Fallback'), 'Fallback', 'unassigned code');
  assert.equal(countryName('fr', null, 'Stored'), 'Stored');
  assert.equal(categoryName('en', { name_fr: 'Actualités', name_en: 'News' }), 'News');
  assert.equal(categoryName('en', { name_fr: 'Actualités', name_en: null }), 'Actualités', 'French when no English name');
  assert.equal(categoryName('fr', { name_fr: 'Actualités', name_en: 'News' }), 'Actualités');
  assert.equal(categoryName('pt', { name_fr: 'Actualités', name_en: 'News', names: { pt: 'Notícias' } }), 'Notícias');
  assert.equal(categoryName('de', { name_fr: 'Actualités', names: { pt: 'Notícias' } }), 'Actualités', 'no German name -> French');
  assert.equal(i18n.dirOf('ar'), 'rtl');
  assert.equal(i18n.dirOf('fr'), 'ltr');
  assert.equal(t('ar', 'banner.title'), 'أصوات أفريقية مستقلة');
  assert.equal(tn('ar', 'filters.results', 3).includes('3'), true);
  assert.equal(tn('zh', 'filters.results', 1), '1 个结果');
  assert.match(countryName('pt', 'CI'), /Marfim/, 'Portuguese name from the runtime');
  assert.equal(countryName('ar', 'SN'), 'السنغال');
});

// CR-2026-11-26-01: one address per language.
test('language addresses: localePath, splitLocale, alternates', () => {
  const r = require(path.join(SRC, 'i18n', 'routing.ts'));
  assert.equal(r.localePath('fr', '/youtube/afrique'), '/youtube/afrique', 'French keeps its address');
  assert.equal(r.localePath('en', '/youtube/afrique'), '/en/youtube/afrique');
  assert.equal(r.localePath('ar', '/youtube'), '/ar/youtube');
  assert.equal(r.localePath('pt', '/youtube#chaines'), '/pt/youtube#chaines');
  assert.equal(r.localePath('de', '/youtube?country=CI'), '/de/youtube?country=CI');
  assert.equal(r.localePath('en', '/creators/x'), '/creators/x', 'only /youtube pages have language addresses');
  assert.equal(r.localePath('en', '/youtubers'), '/youtubers');
  assert.deepEqual(r.splitLocale('/en/youtube/cote-divoire/news-media'), { locale: 'en', path: '/youtube/cote-divoire/news-media' });
  assert.deepEqual(r.splitLocale('/youtube/x'), { locale: null, path: '/youtube/x' });
  assert.deepEqual(r.splitLocale('/xx/youtube'), { locale: null, path: '/xx/youtube' });
  const alt = r.languageAlternates('/youtube/afrique');
  assert.equal(Object.keys(alt).length, 10, '9 languages + x-default');
  assert.equal(alt['x-default'], '/youtube/afrique');
  assert.equal(alt.fr, '/youtube/afrique');
  assert.equal(alt.zh, '/zh/youtube/afrique');
});

test('proxy rules: the address wins, /youtube redirects to the chosen language, crawlers get French', () => {
  const { routeYoutube } = require(path.join(SRC, 'i18n', 'routing.ts'));
  assert.deepEqual(routeYoutube('/en/youtube/afrique', '', 'fr', 'fr-FR'), { action: 'rewrite', locale: 'en', path: '/youtube/afrique' }, 'address beats cookie and browser');
  assert.deepEqual(routeYoutube('/ar/youtube', '?country=EG', null, null), { action: 'rewrite', locale: 'ar', path: '/youtube' });
  assert.deepEqual(routeYoutube('/fr/youtube/x', '?a=1', null, null), { action: 'redirect', to: '/youtube/x?a=1', permanent: true });
  assert.deepEqual(routeYoutube('/xx/youtube', '', null, null), { action: 'next', locale: 'fr' }, 'unknown prefix left to Next.js (404)');
  assert.deepEqual(routeYoutube('/youtube', '', null, null), { action: 'next', locale: 'fr' }, 'crawler: French, no redirect');
  assert.deepEqual(routeYoutube('/youtube', '', null, 'fr-CI,fr;q=0.9'), { action: 'next', locale: 'fr' });
  assert.deepEqual(routeYoutube('/youtube/cote-divoire', '?type=tv-nationale', null, 'en-GB,en'), { action: 'redirect', to: '/en/youtube/cote-divoire?type=tv-nationale', permanent: false });
  assert.deepEqual(routeYoutube('/youtube', '', 'fr', 'en-GB'), { action: 'next', locale: 'fr' }, 'a saved French choice stays on /youtube');
  assert.deepEqual(routeYoutube('/youtube', '', 'sw', 'fr'), { action: 'redirect', to: '/sw/youtube', permanent: false });
  assert.deepEqual(routeYoutube('/youtube', '', null, 'ja'), { action: 'next', locale: 'fr' }, 'nothing supported: French (the browser may still suggest by country)');
});
