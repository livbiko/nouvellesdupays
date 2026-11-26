// CR-2026-11-25-06 (YouTube phase 2): one place for the interface text of the /youtube pages. Every string lives in
// a dictionary per language (fr.json is the reference: the French text as it was); components call t(key). Only the
// interface is translated - channel names, descriptions and video titles stay as published (owner rule, 11-16).
// Part 2a: French and English. Adding a language = a new <code>.json with every key + an entry in LOCALES.
import fr from './fr.json';
import en from './en.json';

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
// The visitor's choice, kept one year (set by the language selector).
export const LOCALE_COOKIE = 'ndp_lang';
export const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', en: 'English' };
// Not yet reviewed by a native speaker: marked "beta" in the selector.
export const BETA_LOCALES: Locale[] = ['en'];

type Dict = Record<string, string>;
const DICTS: Record<Locale, Dict> = { fr, en };
// Formats for Intl (dates, numbers, relative time).
const INTL: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export function intlLocale(locale: Locale): string {
  return INTL[locale];
}

type Vars = Record<string, string | number | null | undefined>;

// t('banner.updated', { date }) - a missing key falls back to French, then to the key itself (never blank).
export function t(locale: Locale, key: string, vars?: Vars): string {
  const s = DICTS[locale][key] ?? DICTS.fr[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : s;
}

// Plural forms: key_one / key_other, chosen by the language's rules ({n} is the count).
export function tn(locale: Locale, key: string, n: number, vars?: Vars): string {
  const form = new Intl.PluralRules(INTL[locale]).select(n) === 'one' ? 'one' : 'other';
  return t(locale, `${key}_${form}`, { n, ...vars });
}

export type T = (key: string, vars?: Vars) => string;
export type TN = (key: string, n: number, vars?: Vars) => string;
export function translator(locale: Locale): { t: T; tn: TN } {
  return { t: (k, v) => t(locale, k, v), tn: (k, n, v) => tn(locale, k, n, v) };
}

// Accept-Language: "en-GB,en;q=0.9,fr;q=0.8" -> the first supported language by weight, or null.
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const tags = header.split(',').map((part, i) => {
    const [tag, ...params] = part.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return { base: tag.trim().toLowerCase().split('-')[0], q: q ? Number(q.slice(2)) : 1, i };
  }).filter((x) => x.base && x.q > 0 && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q || a.i - b.i);
  const hit = tags.find((x) => isLocale(x.base));
  return hit ? (hit.base as Locale) : null;
}

// The order of the brief: (1) the visitor's saved choice, (2) the browser's languages, (3) the default. The country
// step needs an IP lookup and runs in the browser only when this says 'default' (LanguageSelector).
export type LocaleSource = 'cookie' | 'browser' | 'default';
export function chooseLocale(saved: string | null | undefined, acceptLanguage: string | null | undefined): { locale: Locale; source: LocaleSource } {
  if (isLocale(saved)) return { locale: saved, source: 'cookie' };
  const browser = fromAcceptLanguage(acceptLanguage);
  if (browser) return { locale: browser, source: 'browser' };
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

// Country -> suggested interface language (brief section 1), used only when the visitor has no saved choice and the
// browser names no supported language. Countries whose language is not available yet (pt, ar, sw...) are absent:
// they get the default. A suggestion, never a restriction.
const COUNTRY_LANGUAGE: Record<string, Locale> = {
  // French-speaking
  CI: 'fr', SN: 'fr', ML: 'fr', BF: 'fr', GN: 'fr', BJ: 'fr', TG: 'fr', NE: 'fr', CM: 'fr', GA: 'fr', CG: 'fr',
  CD: 'fr', CF: 'fr', TD: 'fr', MG: 'fr', KM: 'fr', DJ: 'fr', BI: 'fr', RW: 'fr', MA: 'fr', DZ: 'fr', TN: 'fr',
  MR: 'fr', FR: 'fr', BE: 'fr', CH: 'fr', LU: 'fr', MC: 'fr', HT: 'fr', CA: 'fr',
  // English-speaking
  NG: 'en', GH: 'en', LR: 'en', SL: 'en', GM: 'en', KE: 'en', UG: 'en', TZ: 'en', ZA: 'en', ZM: 'en', ZW: 'en',
  BW: 'en', NA: 'en', MW: 'en', LS: 'en', SZ: 'en', SS: 'en', ET: 'en', ER: 'en', SO: 'en', SD: 'en', SC: 'en',
  MU: 'en', EG: 'en', GB: 'en', IE: 'en', US: 'en', AU: 'en', NZ: 'en', IN: 'en', PK: 'en', JM: 'en', TT: 'en',
};

export function fromCountry(iso: string | null | undefined): Locale | null {
  return (iso && COUNTRY_LANGUAGE[iso.trim().toUpperCase()]) || null;
}

// Country names in the interface language, from the runtime's ICU data (no list to maintain). Falls back to the
// stored name for an unknown code.
const regionNames = new Map<Locale, Intl.DisplayNames | null>();
export function countryName(locale: Locale, iso: string | null | undefined, fallback?: string | null): string {
  const code = (iso || '').trim().toUpperCase();
  if (!regionNames.has(locale)) {
    try {
      // fallback 'none': an unknown code gives undefined instead of echoing it back.
      regionNames.set(locale, new Intl.DisplayNames([INTL[locale]], { type: 'region', fallback: 'none' }));
    } catch {
      regionNames.set(locale, null);
    }
  }
  const dn = regionNames.get(locale);
  // ZZ is CLDR's "Unknown Region": never a real country.
  if (dn && /^[A-Z]{2}$/.test(code) && code !== 'ZZ') {
    try {
      const name = dn.of(code);
      if (name && name !== code) return name;
    } catch {
      // unknown code: fall through
    }
  }
  return fallback || code;
}

// A category name from the API in the interface language: English where the DB has one, else French.
export function categoryName(locale: Locale, c: { name_fr: string; name_en?: string | null } | null | undefined): string {
  if (!c) return '';
  return locale === 'en' && c.name_en ? c.name_en : c.name_fr;
}
