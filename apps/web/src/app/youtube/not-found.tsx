import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { dirOf, translator } from '@/i18n';
import { getLocale } from '@/i18n/server';

// CR-2026-11-17-03: "page not found" for /youtube/... (unknown place, category, subcategory or video); CR-2026-11-25-06:
// in the visitor's language.
export default async function YoutubeNotFound() {
  const { locale } = await getLocale();
  const { t } = translator(locale);
  return (
    <main dir={dirOf(locale)} lang={locale} className="max-w-4xl mx-auto px-4 py-16 text-center">
      <p className="text-sm font-semibold text-orange-400">404</p>
      <h1 className="mt-2 text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="mt-3 text-neutral-400">
        {t('notFound.text')}
      </p>
      <p className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/youtube" className="text-orange-400 hover:underline">{t('page.videosMedia')}</Link>
        <Link href="/youtube/afrique" className="text-orange-400 hover:underline">{t('notFound.africa')}</Link>
        <Link href="/youtube#categories" className="text-orange-400 hover:underline">{t('filters.allCategories')}</Link>
      </p>
      <SiteFooter locale={locale} />
    </main>
  );
}
