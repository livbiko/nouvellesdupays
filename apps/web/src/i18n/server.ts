import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, chooseLocale, isLocale, type Locale, type LocaleSource } from '.';
import { LOCALE_HEADER } from './routing';

// CR-2026-11-25-06: the language of a /youtube page, on the server. CR-2026-11-26-01: the address decides - the
// proxy sets LOCALE_HEADER from /<lang>/youtube (or 'fr' on /youtube once it decided not to redirect). Without it
// (a page outside the proxy) the order of chooseLocale applies. Crawlers (no cookie, no Accept-Language) get French.
export type { LocaleSource };

export async function getLocale(): Promise<{ locale: Locale; source: LocaleSource }> {
  const h = await headers();
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const fromAddress = h.get(LOCALE_HEADER);
  if (isLocale(fromAddress)) {
    // 'default' still lets the browser try the country suggestion when nothing chose the language.
    const chosen = chooseLocale(saved, h.get('accept-language'));
    return { locale: fromAddress, source: chosen.source === 'default' && fromAddress === 'fr' ? 'default' : 'cookie' };
  }
  return chooseLocale(saved, h.get('accept-language'));
}
