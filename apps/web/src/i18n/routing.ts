import { DEFAULT_LOCALE, LOCALES, chooseLocale, isLocale, type Locale } from '.';

// CR-2026-11-26-01 (YouTube phase 3): one address per language. French keeps /youtube/...; every other language is
// /<lang>/youtube/... with the same page path after it. Pure functions, used by src/proxy.ts and the tests.
// CR-2026-11-27-01: the /facebook pages follow the same rules.

// Header the proxy sets so a page knows the language of its address (read by getLocale()).
export const LOCALE_HEADER = 'x-ndp-locale';

const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

// /youtube/... in a language: '/youtube/afrique' -> '/en/youtube/afrique'. Other paths are returned unchanged
// (only /youtube and /facebook pages have language addresses).
const SECTION = '(?:youtube|facebook)';
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE || !new RegExp(`^/${SECTION}(?=[/?#]|$)`).test(path)) return path;
  return `/${locale}${path}`;
}

// '/en/youtube/afrique' -> { locale: 'en', path: '/youtube/afrique' }; '/youtube/x' -> { locale: null, path }.
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const m = new RegExp(`^/([a-z]{2})(/${SECTION}(?:/.*)?)$`).exec(pathname);
  if (m && isLocale(m[1])) return { locale: m[1], path: m[2] };
  return { locale: null, path: pathname };
}

// Every language address of a /youtube page, for hreflang alternates and the sitemap (x-default = French).
export function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = localePath(l, path);
  out['x-default'] = path;
  return out;
}

export type Route =
  | { action: 'next'; locale: Locale }
  | { action: 'rewrite'; locale: Locale; path: string }
  | { action: 'redirect'; to: string; permanent: boolean };

// What the proxy does with a request (pathname without the query; search = '' or '?...'):
// - /<lang>/youtube/... (lang other than French): rewrite to /youtube/... in that language; the address wins.
// - /fr/youtube/...: permanent redirect to /youtube/... (French has no prefix).
// - /youtube/...: if the visitor's chosen language (saved choice, else browser) is not French, a temporary redirect to
//   the same page in that language; otherwise French. No headers (crawlers) -> French.
export function routeYoutube(pathname: string, search: string, savedChoice: string | null | undefined, acceptLanguage: string | null | undefined): Route {
  const m = new RegExp(`^/([a-z]{2})(/${SECTION}(?:/.*)?)$`).exec(pathname);
  if (m) {
    if (m[1] === DEFAULT_LOCALE) return { action: 'redirect', to: `${m[2]}${search}`, permanent: true };
    if ((PREFIXED as readonly string[]).includes(m[1])) return { action: 'rewrite', locale: m[1] as Locale, path: m[2] };
    return { action: 'next', locale: DEFAULT_LOCALE }; // unknown prefix: left to Next.js (404)
  }
  const { locale } = chooseLocale(savedChoice, acceptLanguage);
  if (locale !== DEFAULT_LOCALE) return { action: 'redirect', to: `/${locale}${pathname}${search}`, permanent: false };
  return { action: 'next', locale: DEFAULT_LOCALE };
}
