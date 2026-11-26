import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import YoutubeListing, { ListingUnavailable, listingMetadata, resolveListing, type ListingSearch } from '@/components/YoutubeListing';
import { t } from '@/i18n';
import { getLocale } from '@/i18n/server';

// CR-2026-11-17-03: /youtube/<region|country|categorie>/<main category>, generated from the database.
type Props = { params: Promise<{ slug: string; category: string }>; searchParams: Promise<ListingSearch> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, category } = await params;
  const { locale } = await getLocale();
  const l = await resolveListing(slug, category);
  return l && l !== 'unavailable' ? listingMetadata(l, locale) : { title: `${t(locale, 'page.videosMedia')} — NouvellesDuPays`, robots: { index: false } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug, category } = await params;
  const l = await resolveListing(slug, category);
  if (l === 'unavailable') return <ListingUnavailable />;
  if (!l) notFound();
  return <YoutubeListing l={l} sp={await searchParams} />;
}
