'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BETA_LOCALES, LOCALES, LOCALE_COOKIE, LOCALE_LABELS, dirOf, fromCountry, t, type Locale } from '@/i18n';
import { detectVisitorCountry } from '@/lib/geo';
import type { LocaleSource } from '@/i18n';

// CR-2026-11-25-06: "🌐 Français ▾" in the /youtube header. A choice is saved for a year and the same URL (same
// country, category and search) is rendered again in that language. With no saved choice and no supported browser
// language (source 'default'), the visitor's country suggests one (existing IP lookup, no GPS); it is saved like a
// choice and can be changed at any time.
function save(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function LanguageSelector({ locale, source }: { locale: Locale; source: LocaleSource }) {
  const router = useRouter();

  // The root layout says lang="fr"; on these pages the document language and direction (Arabic: right to left) follow
  // the interface, and go back to French / left to right when the visitor leaves them.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
    return () => { document.documentElement.lang = 'fr'; document.documentElement.dir = 'ltr'; };
  }, [locale]);

  useEffect(() => {
    if (source !== 'default') return;
    let cancelled = false;
    detectVisitorCountry().then((iso) => {
      const suggested = fromCountry(iso);
      if (cancelled || !suggested) return;
      save(suggested);
      if (suggested !== locale) router.refresh();
    });
    return () => { cancelled = true; };
  }, [source, locale, router]);

  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm text-neutral-200 hover:border-neutral-500">
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">{t(locale, 'lang.selector')}</span>
      <select value={locale} className="bg-transparent text-sm focus:outline-none"
        onChange={(e) => { save(e.target.value as Locale); router.refresh(); }}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} className="bg-neutral-900">
            {LOCALE_LABELS[l]}{BETA_LOCALES.includes(l) ? ' (beta)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
