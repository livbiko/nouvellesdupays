'use client';

import Link from 'next/link';
import { openConsentSettings } from '@/lib/tracking';
import { translator, type Locale } from '@/i18n';

// CR-2026-11-25-06: French unless a page passes its language.
export default function SiteFooter({ locale = 'fr' }: { locale?: Locale }) {
  const { t } = translator(locale);
  return (
    <footer className="border-t border-neutral-900 mt-12 py-6 px-4 text-xs text-neutral-500">
      <div className="max-w-3xl mx-auto flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <Link href="/" className="hover:text-neutral-300">NouvellesDuPays</Link>
        <Link href="/africa" className="hover:text-neutral-300">{t('footer.africa')}</Link>
        <Link href="/publishers" className="hover:text-neutral-300">{t('footer.sources')}</Link>
        <Link href="/creators" className="hover:text-neutral-300">{t('footer.creators')}</Link>
        <Link href="/register-publisher" className="hover:text-neutral-300">{t('footer.registerMedia')}</Link>
        <Link href="/submit-video" className="hover:text-neutral-300">{t('footer.submitVideo')}</Link>
        <Link href="/contact" className="hover:text-neutral-300">{t('footer.contact')}</Link>
        <Link href="/privacy" className="hover:text-neutral-300">{t('footer.privacy')}</Link>
        <button type="button" onClick={openConsentSettings} className="hover:text-neutral-300 underline-offset-2 hover:underline">
          {t('footer.cookies')}
        </button>
      </div>
    </footer>
  );
}
