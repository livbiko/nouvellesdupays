import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import ChannelVideosToggle from '@/components/ChannelVideosToggle';
import { Breadcrumbs, Unavailable } from '@/components/AfricaBits';
import { countrySlug } from '@/lib/africa';
import LanguageSelector from '@/components/LanguageSelector';
import { categoryName, countryName as countryLabel, intlLocale, translator, type Locale, type T } from '@/i18n';
import { getLocale } from '@/i18n/server';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { CountryCreator, CountryCreatorsPage, CreatorKind } from '@/lib/types';

// A country's YouTube creator directory (Build #255, brief section 8), served at /youtube/<country-slug> since
// Build #261 (/creators/pays/<slug> redirects there). The page exists only for a country with at least 5 approved
// creators (the API answers 404 below that), so no empty country pages. Numbers are the latest public ones with
// their date, never estimates; growth needs a 25-40 day old snapshot and is not shown until there is one.
// ?type=, ?categorie= and ?tri=score|abonnes filter and sort.

export type CountryPageSearch = { type?: string; categorie?: string; tri?: string };

// CR-2026-11-25-06: labels in country.kind.<kind>, country.filter.<kind|all>, country.sort.<key>.
const KIND_FILTER: (CreatorKind | '')[] = ['', 'individual', 'media_brand'];
const PLATFORM: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok' };
const SORTS = ['score', 'abonnes'];

const nfOf = (locale: Locale) => new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 });
const dayOf = (locale: Locale) => (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const ordinal = (t: T, n: number) => (n === 1 ? t('country.rankFirst') : t('country.rankNth', { n }));

export const countryPagePath = (slug: string) => `/youtube/${slug}`;

// The country page for a slug, or null when no country with a page has that slug (the caller then 404s or, on
// /youtube/<slug>, falls back to a video landing page).
export async function loadCountryCreators(slug: string): Promise<CountryCreatorsPage | 'unavailable' | null> {
  try {
    const country = ((await serverApi.creatorCountries()) ?? []).find((c) => c.has_page && countrySlug(c.name) === slug);
    if (!country) return null;
    return await serverApi.countryCreators(country.iso);
  } catch (err) {
    if (err instanceof ApiUnavailableError) return 'unavailable';
    throw err;
  }
}

export function countryMetadata(slug: string, page: CountryCreatorsPage, locale: Locale = 'fr'): Metadata {
  const { t } = translator(locale);
  const name = countryLabel(locale, page.country.iso, page.country.name);
  return {
    title: `${t('country.title', { country: name })} — NouvellesDuPays`,
    description: t('country.metaDescription', { n: page.creators.length, country: name }),
    alternates: { canonical: countryPagePath(slug) },
  };
}

function subscribers(c: CountryCreator): number | null {
  const m = c.channel?.metrics;
  return m?.subscribers?.value ?? m?.followers?.value ?? null;
}

function href(slug: string, q: { type: string; categorie: string; tri: string }): string {
  const p = new URLSearchParams();
  if (q.type) p.set('type', q.type);
  if (q.categorie) p.set('categorie', q.categorie);
  if (q.tri && q.tri !== 'score') p.set('tri', q.tri);
  const s = p.toString();
  return `${countryPagePath(slug)}${s ? `?${s}` : ''}`;
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={to}
      className={`rounded-full border px-3 py-1 ${active ? 'border-orange-400 text-orange-400' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
      {children}
    </Link>
  );
}

// children: extra sections before the notes (CR-2026-11-17-03: the country's channels by category).
export default async function CountryCreatorsView({ slug, page, sp, children }: {
  slug: string; page: CountryCreatorsPage | 'unavailable'; sp: CountryPageSearch; children?: ReactNode;
}) {
  const { locale, source } = await getLocale();
  const { t, tn } = translator(locale);
  const day = dayOf(locale);
  if (page === 'unavailable') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs items={[{ href: '/youtube', label: t('page.videosMedia') }]} label={t('nav.breadcrumb')} />
        <div className="mt-8"><Unavailable message={t('page.unavailable')} /></div>
        <SiteFooter locale={locale} />
      </main>
    );
  }

  const { country, creators } = page;
  // Names in the page's language (owner rule 11-16: a French page is all French); the table stores English names.
  const countryName = countryLabel(locale, country.iso, country.name);
  const categories = [...new Map(creators.flatMap((c) => c.categories).map((c) => [c.slug, categoryName(locale, c)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], intlLocale(locale)));
  const q = {
    type: KIND_FILTER.some((k) => k === sp.type) ? String(sp.type) : '',
    categorie: categories.some(([s]) => s === sp.categorie) ? String(sp.categorie) : '',
    tri: sp.tri === 'abonnes' ? 'abonnes' : 'score',
  };
  const list = creators
    .filter((c) => (!q.type || c.creator_kind === q.type) && (!q.categorie || c.categories.some((k) => k.slug === q.categorie)));
  if (q.tri === 'abonnes') list.sort((a, b) => (subscribers(b) ?? -1) - (subscribers(a) ?? -1));
  const ranked = creators.filter((c) => c.rank != null);
  const rankedAt = ranked[0]?.ranked_at;
  const withLanguage = creators.some((c) => c.languages.length > 0);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs items={[{ href: '/youtube', label: t('page.videosMedia') }, { label: countryName }]} label={t('nav.breadcrumb')} />
        <LanguageSelector locale={locale} source={source} />
      </div>
      <header className="mt-4 flex items-center gap-4">
        {country.flag_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={country.flag_url} alt={t('country.flag', { country: countryName })} width={56} height={37} className="rounded shrink-0" />
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight">{t('country.title', { country: countryName })}</h1>
          <p className="text-neutral-400 text-sm mt-1">{tn('country.selected', creators.length)}</p>
        </div>
      </header>
      <p className="text-neutral-400 mt-3 max-w-2xl text-sm">
        {t('country.intro')}
      </p>

      <nav aria-label={t('country.filters')} className="mt-6 flex flex-wrap gap-2 text-sm">
        {KIND_FILTER.map((k) => <Chip key={k || 'all'} to={href(slug, { ...q, type: k })} active={q.type === k}>{t(`country.filter.${k || 'all'}`)}</Chip>)}
      </nav>
      {categories.length > 1 && (
        <nav aria-label={t('nav.categories')} className="mt-2 flex flex-wrap gap-2 text-sm">
          <Chip to={href(slug, { ...q, categorie: '' })} active={!q.categorie}>{t('country.allCategories')}</Chip>
          {categories.map(([s, name]) => <Chip key={s} to={href(slug, { ...q, categorie: s })} active={q.categorie === s}>{name}</Chip>)}
        </nav>
      )}
      <nav aria-label={t('sort.label')} className="mt-2 flex flex-wrap gap-2 text-sm items-center">
        <span className="text-neutral-500">{t('country.sortBy')}</span>
        {SORTS.map((s) => <Chip key={s} to={href(slug, { ...q, tri: s })} active={q.tri === s}>{t(`country.sort.${s}`)}</Chip>)}
      </nav>

      {list.length === 0 ? (
        <p className="mt-8 text-neutral-500 text-sm">{t('country.none')}</p>
      ) : (
        <ol className="mt-6 grid grid-cols-1 gap-3">
          {list.map((c) => <CreatorCard key={c.slug} c={c} locale={locale} />)}
        </ol>
      )}

      {children}

      <section aria-label={t('country.aboutLabel')} className="mt-8 text-xs text-neutral-500 space-y-1">
        {rankedAt && <p>{t('country.rankedOn', { date: day(rankedAt) })} {ranked.length < creators.length && t('country.rankedSoon')}</p>}
        <p>{t('country.growthNote')}</p>
        {!withLanguage && <p>{t('country.languageNote')}</p>}
        <p>{t('country.platformsNote')}</p>
        <p>{t('country.errorStart')} <Link href="/contact" className="text-orange-400 hover:underline">{t('country.contactUs')}</Link>.</p>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}

function CreatorCard({ c, locale }: { c: CountryCreator; locale: Locale }) {
  const { t } = translator(locale);
  const nf = nfOf(locale);
  const day = dayOf(locale);
  const m = c.channel?.metrics ?? {};
  const subs = subscribers(c);
  const measured = (m.subscribers ?? m.followers ?? m.total_views)?.measured_at;
  const recent = [
    m.recent_uploads_30d && t('country.uploads30d', { n: nf.format(m.recent_uploads_30d.value) }),
    m.avg_recent_views && t('country.avgViews', { n: nf.format(m.avg_recent_views.value) }),
    m.engagement_rate_bp && t('country.engagement', { n: (m.engagement_rate_bp.value / 100).toLocaleString(intlLocale(locale), { maximumFractionDigits: 2 }) }),
  ].filter(Boolean);
  const primary = c.categories.find((k) => k.is_primary) ?? c.categories[0];
  const verified = c.confidence === 'VERIFIED' || c.confidence === 'HIGH_CONFIDENCE';
  return (
    <li className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="flex gap-3">
        <span className="w-10 shrink-0 text-center pt-2 tabular-nums" title={c.rank != null ? t('country.rankTitle', { n: c.total }) : t('country.notRanked')}>
          {c.rank != null ? <span className="text-lg font-semibold text-orange-400">{ordinal(t, c.rank)}</span> : <span className="text-neutral-600">—</span>}
        </span>
        {c.channel?.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.channel.profile_image_url} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded-full object-cover bg-neutral-800 shrink-0" />
        ) : (
          <span className="h-12 w-12 rounded-full bg-neutral-800 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/creators/${c.slug}`} className="font-medium hover:text-orange-400">{c.display_name}</Link>
          <p className="text-xs text-neutral-500">
            {[c.channel?.handle && `@${c.channel.handle}`, t(`country.kind.${c.creator_kind}`), primary ? categoryName(locale, primary) : null].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs mt-1">
            <span className={verified ? 'text-green-400' : 'text-neutral-400'}>
              {verified ? t('country.verified') : t('country.unverified')}
            </span>
          </p>
          {(subs != null || m.total_views) && (
            <p className="text-sm text-neutral-300 mt-1 tabular-nums">
              {[subs != null && t('card.subscribers', { n: nf.format(subs) }), m.total_views && t('country.totalViews', { n: nf.format(m.total_views.value) })].filter(Boolean).join(' · ')}
              {measured && <span className="text-xs text-neutral-600"> {t('country.measuredOn', { date: day(measured) })}</span>}
            </p>
          )}
          {recent.length > 0 && <p className="text-xs text-neutral-400 mt-1">{recent.join(' · ')}</p>}
        </div>
        <div className="text-right shrink-0 text-xs space-y-1">
          {c.score != null && <span className="block tabular-nums text-orange-400">{t('country.score', { n: Math.round(c.score) })}</span>}
          {c.channel && (
            <a href={c.channel.url} target="_blank" rel="noopener noreferrer" className="block text-neutral-300 hover:text-orange-400">
              {PLATFORM[c.channel.platform] ?? c.channel.platform} ↗
            </a>
          )}
        </div>
      </div>
      {c.channel?.channel_id && <ChannelVideosToggle channelId={c.channel.channel_id} name={c.display_name} locale={locale} />}
    </li>
  );
}
