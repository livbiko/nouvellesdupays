import type { Metadata } from 'next';
import FacebookView, { facebookMetadata, type SP } from '@/components/FacebookView';
import { getLocale } from '@/i18n/server';

// CR-2026-11-27-01: /facebook (and /<lang>/facebook through the proxy) - Facebook videos entered by an admin.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getLocale();
  return facebookMetadata(locale, null);
}

export default async function FacebookIndex({ searchParams }: { searchParams: Promise<SP> }) {
  const { locale, source } = await getLocale();
  return <FacebookView sp={await searchParams} locale={locale} source={source} />;
}
