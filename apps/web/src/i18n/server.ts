import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, chooseLocale, type Locale, type LocaleSource } from '.';

// CR-2026-11-25-06: the language of a /youtube page, on the server (order in chooseLocale). Crawlers (no cookie,
// usually no Accept-Language) keep getting the French page.
export type { LocaleSource };

export async function getLocale(): Promise<{ locale: Locale; source: LocaleSource }> {
  return chooseLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language'));
}
