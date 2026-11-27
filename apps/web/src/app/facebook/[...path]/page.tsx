import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FacebookView, { facebookMetadata, resolveFacebookPath, type SP } from '@/components/FacebookView';
import { getLocale } from '@/i18n/server';

// CR-2026-11-27-01: /facebook/<place>[/<category>[/<subcategory>]] - the /youtube places (regions, continents,
// countries with videos, "categorie" = every country). An unknown place is a 404.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<SP> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await getLocale();
  const at = await resolveFacebookPath((await params).path);
  if (!at || at === 'unavailable') return { title: 'NouvellesDuPays', robots: { index: false } };
  return facebookMetadata(locale, at);
}

export default async function FacebookPlacePage({ params, searchParams }: Props) {
  const { locale, source } = await getLocale();
  const at = await resolveFacebookPath((await params).path);
  if (!at) notFound();
  return <FacebookView sp={await searchParams} locale={locale} source={source} at={at === 'unavailable' ? null : at} />;
}
