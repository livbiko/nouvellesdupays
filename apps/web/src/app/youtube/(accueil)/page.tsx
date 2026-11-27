import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import VideoDirectory from '@/components/VideoDirectory';
import LatestVideos from '@/components/LatestVideos';
import DirectoryCard from '@/components/DirectoryCard';
import DirectoryFilters, { type DirectoryParams, type FilterFacets } from '@/components/DirectoryFilters';
import SafeImg from '@/components/SafeImg';
import IndependentVoicesBanner from '@/components/IndependentVoicesBanner';
import IndependentCreatorsCarousel from '@/components/IndependentCreatorsCarousel';
import CountryExplorer from '@/components/CountryExplorer';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import { countrySlug, regionByName } from '@/lib/africa';
import { YOUTUBE_REGIONS } from '@/lib/youtubePlaces';
import LanguageSelector from '@/components/LanguageSelector';
import { categoryName, countryName, dirOf, intlLocale, ogLocale, translator, type Locale, type T } from '@/i18n';
import { getLocale } from '@/i18n/server';
import { languageAlternates, localePath } from '@/i18n/routing';
import type { CreatorCountry, CreatorListEntry, DirectoryEntry, LandingVideo, LatestVideo, YoutubeDirectory, YoutubeExplorer } from '@/lib/types';

// CR-2026-11-16-11 (redesign phase 1): /youtube as one page of sections behind a tab bar - search and filters over every
// video channel and approved creator (GET /api/youtube/directory), independent creators, countries by continent,
// categories, rankings with their method, selected videos. Everything in French (owner, 11-16). Built from stored
// data only: no "latest video", trending or live section until phase 3 stores that data (no YouTube feed fetching -
// youtube.com/robots.txt disallows /feeds/videos.xml). Earlier: Build #244 ranking (MIN_RANKED), #261 country pages.
const MIN_RANKED = 5;
const TOP_RANKED = 10;
const PER_PAGE = 24;
const VIDEOS = 24; // CR-2026-11-18-03: was 60
const LATEST = 12; // CR-2026-11-18-08
// CR-2026-11-25-04: the "Voix indépendantes africaines" banner - African independent voices, local voices and online
// media; the banner re-reads the same query every BANNER_REFRESH_MS while the page is open.
const BANNER_QUERY = '?continent=afrique&type=voix-locales,voix-panafricaines,media-en-ligne,createur-independant,collectif&limit=24';
const BANNER_REFRESH_MS = 15 * 60 * 1000;

export const dynamic = 'force-dynamic';

// CR-2026-11-25-06: title and description in the visitor's language (French for crawlers, as before).
export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getLocale();
  const { t } = translator(locale);
  const title = `${t('page.videosMedia')} — NouvellesDuPays`;
  const description = t('home.metaDescription');
  return {
    title, description,
    // CR-2026-11-26-01: each language has its own address; all of them are declared to search engines.
    alternates: { canonical: localePath(locale, '/youtube'), languages: languageAlternates('/youtube') },
    openGraph: { title, description, url: localePath(locale, '/youtube'), type: 'website', locale: ogLocale(locale), siteName: 'NouvellesDuPays' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// Section ids stay French (they are in shared links); labels in home.tab.<id> and sort.<key>.
const TABS = ['decouvrir', 'dernieres-videos', 'independants', 'chaines', 'pays', 'categories', 'classements', 'videos'] as const;
const SORTS = ['populaires', 'vues', 'score', 'croissance', 'alpha'] as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

function creatorPlace(c: CreatorListEntry, locale: Locale, t: T): string {
  if (c.country_iso) return countryName(locale, c.country_iso, c.country_name);
  const r = c.region ? regionByName(c.region) : null;
  return r ? t(`region.${r.slug === 'west-africa' ? 'afrique-de-l-ouest' : r.slug === 'east-africa' ? 'afrique-de-l-est' : r.slug === 'central-africa' ? 'afrique-centrale' : r.slug === 'north-africa' ? 'afrique-du-nord' : 'afrique-australe'}`) : c.region || '';
}

// Query string for the directory API and for links that keep the current filters.
function qs(p: Partial<DirectoryParams> & { page?: number; per?: number }, hash = ''): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && !(k === 'sort' && v === 'populaires') && !(k === 'page' && v === 1)) s.set(k, String(v));
  const q = s.toString();
  return `${q ? `?${q}` : ''}${hash}`;
}

function Section({ id, title, accent, intro, children }: { id: string; title: string; accent?: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-20 pt-10">
      <h2 id={`${id}-titre`} className="text-lg font-semibold text-neutral-100">
        {title}{accent && <> <span className="text-orange-500">{accent}</span></>}
      </h2>
      {intro && <p className="mt-1 max-w-2xl text-sm text-neutral-400">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function YoutubeIndex({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { locale, source } = await getLocale();
  const { t, tn } = translator(locale);
  const lp = (p: string) => localePath(locale, p); // CR-2026-11-26-01: links keep the page's language
  const compact = new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 });
  const params: DirectoryParams = {
    q: one(sp.q).slice(0, 100), country: one(sp.country).toUpperCase().slice(0, 2), continent: one(sp.continent),
    category: one(sp.category), type: one(sp.type), lang: one(sp.lang), sort: one(sp.sort) || 'populaires',
  };
  const page = Math.max(parseInt(one(sp.page), 10) || 1, 1);

  let dir: YoutubeDirectory | null = null;
  let independents: YoutubeDirectory | null = null;
  let growing: YoutubeDirectory | null = null;
  let videos: LandingVideo[] | null = null;
  let unavailable = false;
  try {
    [dir, independents, growing, videos] = await Promise.all([
      serverApi.youtubeDirectory(qs({ ...params, page, per: PER_PAGE })),
      serverApi.youtubeDirectory(qs({ type: 'createur-independant', continent: 'afrique', sort: 'score', per: 12 })),
      serverApi.youtubeDirectory(qs({ sort: 'croissance', per: 5 })),
      serverApi.videos(`?limit=${VIDEOS}`),
    ]);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    unavailable = true;
  }
  // The ranking and country pages are extra: if they cannot be loaded the rest of the page still renders.
  let creators: CreatorListEntry[] = [];
  let countryPages: CreatorCountry[] = [];
  let latest: LatestVideo[] = [];
  let latestUpdated: string | null = null;
  let voices: { items: LatestVideo[]; updated_at?: string | null } | null = null;
  let explorer: YoutubeExplorer | null = null;
  try {
    [creators, countryPages, latest, voices, explorer] = await Promise.all([
      serverApi.creators('?limit=200').then((r) => r ?? []),
      serverApi.creatorCountries().then((r) => (r ?? []).filter((c) => c.has_page)).catch(() => []),
      // CR-2026-11-18-08: an empty or failed answer only hides the section.
      // CR-2026-11-26-02: with the time of the last uploads refresh (every 3 h).
      serverApi.latestVideos(`?limit=${LATEST}`).then((r) => { latestUpdated = r?.updated_at ?? null; return r?.items ?? []; }).catch(() => []),
      // CR-2026-11-25-04: banner and country tree; a failed answer hides them, the rest of the page still renders.
      serverApi.latestVideos(BANNER_QUERY).catch(() => null),
      serverApi.youtubeExplorer().catch(() => null),
    ]);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
  }

  // Country names in the page's language, made here on the server so the filters' client component renders the same text.
  const facets = dir ? {
    ...dir.facets,
    countries: dir.facets.countries.map((c) => ({ ...c, name: countryName(locale, c.iso, c.name) })).sort((a, b) => a.name.localeCompare(b.name, intlLocale(locale))),
  } : undefined;
  // CR-2026-11-18-03: the filters (a client component) get only the fields they read - the full facets were 41 KB of
  // page data.
  const filterFacets: FilterFacets | undefined = facets && {
    continents: facets.continents.map(({ key, label }) => ({ key, label })),
    countries: facets.countries.map(({ iso, name, continent, count }) => ({ iso, name, continent, count })),
    categories: facets.categories.map(({ slug, name_fr, name_en, names, parent_slug, count }) => ({ slug, name_fr, name_en, names, parent_slug, count })),
    types: facets.types,
    languages: facets.languages,
  };
  const typeLabel = Object.fromEntries((facets?.types ?? []).map((x) => [x.key, t(`type.${x.key}`)]));
  const catLabel = Object.fromEntries((facets?.categories ?? []).map((c) => [c.slug, categoryName(locale, c)]));
  const card = (e: DirectoryEntry, from?: string) => (
    <DirectoryCard key={e.key} e={e} from={from} locale={locale} typeLabel={e.type ? typeLabel[e.type] ?? null : null}
      categoryLabel={e.primary_category ? catLabel[e.primary_category] ?? null : null} />
  );
  const ranked = creators.filter((c) => c.score != null && c.rank != null).sort((a, b) => (a.rank as number) - (b.rank as number));
  const growth = (growing?.items ?? []).filter((e) => e.growth != null);
  // Top of each category with 2+ ranked creators.
  const byCategory = [...ranked.reduce((m, c) => {
    if (c.primary_category) m.set(c.primary_category, [...(m.get(c.primary_category) ?? []), c]);
    return m;
  }, new Map<string, CreatorListEntry[]>())].filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length);
  const pages = dir ? Math.max(Math.ceil(dir.total / PER_PAGE), 1) : 1;
  const filtered = Object.entries(params).some(([k, v]) => k !== 'sort' && v);

  const jsonLd = dir && {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('home.listName'),
    itemListElement: dir.items.slice(0, 24).map((e, i) => ({
      '@type': 'ListItem', position: i + 1, name: e.name,
      url: e.profile_path ? `https://nouvellesdupays.com${e.profile_path}` : e.url ?? undefined,
    })),
  };

  return (
    <div dir={dirOf(locale)} lang={locale}>
      <main className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">{t('home.backToGlobe')}</Link>
            <LanguageSelector locale={locale} source={source} />
          </div>

          {/* Hero */}
          <header id="decouvrir" className="scroll-mt-20 pt-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                NouvellesDuPays — <span className="text-orange-500">{t('page.videosMedia')}</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                {t('home.intro')}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                {facets && <>{t('card.countries', { n: dir!.facets.countries.length })} · </>}
                {t('home.selection')}{' '}
                <Link href="/submit-video" className="underline hover:text-neutral-300">{t('home.submit')}</Link>
              </p>
            </div>
            {/* CR-2026-11-25-04: replaces the "À la une · meilleur score africain" card. */}
            {voices && (
              <IndependentVoicesBanner initial={voices.items} updatedAt={voices.updated_at ?? null} query={BANNER_QUERY} refreshMs={BANNER_REFRESH_MS} locale={locale} />
            )}
            {filterFacets && <DirectoryFilters facets={filterFacets} params={params} total={dir!.total} locale={locale} action={lp('/youtube#chaines')} />}
          </header>

          {/* Tabs */}
          <nav aria-label={t('home.sections')} className="sticky top-0 z-20 -mx-4 mt-6 border-b border-neutral-800 bg-neutral-950/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
            <ul className="flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
              {TABS.filter((id) => id !== 'dernieres-videos' || latest.length > 0).map((id) => (
                <li key={id} className="flex-shrink-0">
                  <a href={`${qs(params)}#${id}`} className="block rounded-full px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white">{t(`home.tab.${id}`)}</a>
                </li>
              ))}
            </ul>
          </nav>

          {unavailable && (
            <p className="mt-8 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {t('home.unavailable')}
            </p>
          )}

          {/* CR-2026-11-18-08: the channels' newest uploads (official API, refreshed every 3 h since CR-2026-11-26-02) */}
          {latest.length > 0 && (
            <Section id="dernieres-videos" title={t('home.latest.title')} accent={t('home.latest.accent')} intro={t('home.latest.intro')}>
              <LatestVideos videos={latest} locale={locale} updatedAt={latestUpdated} />
            </Section>
          )}

          {/* Independent creators: a carousel like the banner, above the country pages (CR-2026-11-26-02) */}
          {independents && independents.items.length > 0 && (
            <IndependentCreatorsCarousel id="independants" title={t('home.independents.title')} accent={t('home.independents.accent')}
              intro={t('home.independents.intro')} count={independents.items.length} locale={locale}
              footer={independents.total > independents.items.length && (
                <p className="mt-2 text-sm"><a href={qs({ type: 'createur-independant', continent: 'afrique' }, '#chaines')} className="text-orange-400 hover:underline">{t('home.independents.seeAll', { n: independents.total })}</a></p>
              )}>
              {independents.items.map((e) => (
                <DirectoryCard key={e.key} e={e} from="youtube_independants" locale={locale} className="w-[260px] flex-shrink-0 snap-start sm:w-[280px]"
                  typeLabel={e.type ? typeLabel[e.type] ?? null : null} categoryLabel={e.primary_category ? catLabel[e.primary_category] ?? null : null} />
              ))}
            </IndependentCreatorsCarousel>
          )}

          {/* Country pages (Build #261) */}
          {countryPages.length > 0 && (
            <Section id="pages-pays" title={t('home.countryPages.title')} accent={t('home.countryPages.accent')} intro={t('home.countryPages.intro')}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {countryPages.map((c) => {
                  const top = creators.filter((x) => x.country_iso === c.iso).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 3);
                  return (
                    <li key={c.iso}>
                      <Link href={lp(`/youtube/${countrySlug(c.name)}`)} className="block h-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-orange-600">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{countryName(locale, c.iso, c.name)}</span>
                          <span className="text-xs tabular-nums text-neutral-500">{tn('home.channels', c.approved)}</span>
                        </span>
                        <span className="mt-2 block truncate text-xs text-neutral-400">{top.map((x) => x.display_name).join(' · ')}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Directory, with the "Explorer par pays" tree beside it from lg up (CR-2026-11-25-04) */}
          {dir && (
            <div className={explorer ? 'lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8' : ''}>
            {explorer && (
              <aside id="pays" className="scroll-mt-20 pt-10 lg:sticky lg:top-14 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:pe-1">
                <CountryExplorer explorer={explorer} locale={locale} current={{ iso: params.country || undefined, category: params.category || undefined }} />
              </aside>
            )}
            <div className="min-w-0">
            <Section id="chaines" title={t('home.channels.title')} accent={t('home.channels.accent')} intro={t('home.channels.intro')}>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-500">{t('sort.prefix')}</span>
                {SORTS.map((key) => (
                  <a key={key} href={qs({ ...params, sort: key }, '#chaines')} aria-current={params.sort === key ? 'true' : undefined}
                    className={`rounded-full border px-3 py-1 ${params.sort === key ? 'border-orange-500 bg-orange-950/50 text-orange-300' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                    {t(`sort.${key}`)}
                  </a>
                ))}
              </div>
              {dir.items.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{dir.items.map((e) => card(e))}</ul>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-400">
                  {t('home.noMatch')}{' '}
                  <a href={lp('/youtube#chaines')} className="text-orange-400 hover:underline">{t('filters.reset')}</a>
                </div>
              )}
              {pages > 1 && (
                <nav aria-label={t('pager.label')} className="mt-6 flex items-center justify-center gap-3 text-sm">
                  {page > 1 && <a href={qs({ ...params, page: page - 1 }, '#chaines')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">{t('pager.previous')}</a>}
                  <span className="tabular-nums text-neutral-400">{t('pager.pageOf', { page: Math.min(page, pages), pages })}</span>
                  {page < pages && <a href={qs({ ...params, page: page + 1 }, '#chaines')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">{t('pager.next')}</a>}
                </nav>
              )}
            </Section>
            </div>
            </div>
          )}

          {/* Countries by continent - only when the "Explorer par pays" tree could not be loaded (CR-2026-11-25-04) */}
          {!explorer && facets && facets.countries.length > 0 && (
            <Section id="pays" title={t('explorer.titleStart')} accent={t('explorer.titleAccent')} intro={t('home.countries.intro')}>
              <div className="space-y-6">
                {facets.continents.map((c) => {
                  const list = facets.countries.filter((x) => x.continent === c.key);
                  if (!list.length) return null;
                  return (
                    <div key={c.key}>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">
                        {/* CR-2026-11-17-03: every continent and country has its page. */}
                        <Link href={lp(`/youtube/${YOUTUBE_REGIONS.find((r) => r.query.continent === c.key)?.slug ?? ''}`)} className="hover:text-orange-400">{t(`continent.${c.key}`)}</Link>
                        {' '}<span className="font-normal text-neutral-500">· {t('card.countries', { n: list.length })}</span>
                      </h3>
                      {c.key === 'afrique' && (
                        <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {YOUTUBE_REGIONS.filter((r) => r.parent?.slug === 'afrique').map((r) => (
                            <Link key={r.slug} href={lp(`/youtube/${r.slug}`)} className="text-orange-400 hover:underline">{t(`place.${r.slug}`)}</Link>
                          ))}
                        </p>
                      )}
                      {/* CR-2026-11-18-03: plain links (no flag, no card markup) - every country stays linked for crawlers;
                          flags are on the region and country pages. */}
                      <p className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm leading-relaxed">
                        {list.map((x) => (
                          <a key={x.iso} href={lp(`/youtube/${countrySlug(x.name)}`)} className="text-neutral-200 hover:text-orange-400">
                            {x.name} <span className="text-xs tabular-nums text-neutral-500">{x.count}</span>
                          </a>
                        ))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Categories */}
          {facets && facets.categories.length > 0 && (
            <Section id="categories" title={t('explorer.titleStart')} accent={t('home.categoryAccent')}>
              {/* CR-2026-11-17-03: a page per category and subcategory, every country (/youtube/categorie/...). */}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {facets.categories.filter((c) => !c.parent_slug).map((c) => (
                  <li key={c.slug} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                    <Link href={lp(`/youtube/categorie/${c.slug}`)} className="flex justify-between gap-2 font-semibold text-neutral-100 hover:text-orange-400">
                      <span>{categoryName(locale, c)}</span><span className="tabular-nums text-sm font-normal text-neutral-500">{c.count}</span>
                    </Link>
                    {facets.categories.some((x) => x.parent_slug === c.slug) && (
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {facets.categories.filter((x) => x.parent_slug === c.slug).map((x) => (
                          <li key={x.slug}><Link href={lp(`/youtube/categorie/${c.slug}/${x.slug}`)} className="text-neutral-400 hover:text-orange-400">{categoryName(locale, x)} ({x.count})</Link></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Rankings */}
          {ranked.length >= MIN_RANKED && (
            <Section id="classements" title={t('home.rankings.title')} accent="YouTube" intro={t('home.rankings.intro')}>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* min-w-0: grid items otherwise grow to their longest line (432 px wide page on a 390 px phone). */}
                <div className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t('home.rankings.best')}</h3>
                  <ol className="space-y-2">
                    {ranked.slice(0, TOP_RANKED).map((c) => (
                      <li key={c.slug}>
                        <Link href={`/creators/${c.slug}`} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 hover:border-neutral-600">
                          <span className="w-6 text-end text-sm font-bold tabular-nums text-neutral-400">{c.rank}</span>
                          {c.profile_image_url
                            ? <SafeImg src={c.profile_image_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-full bg-neutral-800 object-cover" />
                            : <span className="h-9 w-9 rounded-full bg-neutral-800" aria-hidden="true" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{c.display_name}</span>
                            <span className="block truncate text-xs text-neutral-500">
                              {[creatorPlace(c, locale, t), categoryName(locale, c.primary_category ? { name_fr: c.primary_category, name_en: c.primary_category_en, names: c.primary_category_names } : null) || null, c.subscribers != null ? t('card.subscribers', { n: compact.format(c.subscribers) }) : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="text-sm font-bold tabular-nums text-orange-400" title={t('home.rankings.scoreTitle')}>{Math.round(c.score as number)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="min-w-0 space-y-6">
                  {growth.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t('home.rankings.growth')}</h3>
                      <ol className="space-y-2">
                        {growth.map((e) => (
                          <li key={e.key} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                            {e.profile_path ? <Link href={e.profile_path} className="truncate hover:text-orange-400">{e.name}</Link> : <span className="truncate">{e.name}</span>}
                            <span className="flex-shrink-0 text-xs tabular-nums text-neutral-400" title={t('home.rankings.growthTitle')}>{t('home.rankings.growthValue', { n: Math.round(e.growth as number) })}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {byCategory.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t('home.rankings.byCategory')}</h3>
                      <ul className="space-y-2 text-sm">
                        {byCategory.map(([cat, list]) => (
                          <li key={cat} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                            <span className="text-xs text-neutral-500">{categoryName(locale, { name_fr: cat, name_en: list[0]?.primary_category_en, names: list[0]?.primary_category_names })}</span>
                            <span className="block truncate">
                              {list.slice(0, 3).map((c, i) => (
                                <span key={c.slug}>{i > 0 && ' · '}<Link href={`/creators/${c.slug}`} className="hover:text-orange-400">{c.display_name}</Link></span>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {countryPages.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t('home.rankings.byCountry')}</h3>
                      <p className="flex flex-wrap gap-2 text-sm">
                        {countryPages.map((c) => <Link key={c.iso} href={lp(`/youtube/${countrySlug(c.name)}`)} className="rounded-full border border-neutral-700 px-3 py-1 hover:border-orange-500">{countryName(locale, c.iso, c.name)}</Link>)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <details className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                <summary className="cursor-pointer font-semibold">{t('home.method.title')}</summary>
                <ul className="mt-3 list-disc space-y-1 ps-5 text-neutral-400">
                  <li>{t('home.method.1')}</li>
                  <li>{t('home.method.2')}</li>
                  <li>{t('home.method.3')}</li>
                  <li>{t('home.method.4')}</li>
                </ul>
              </details>
            </Section>
          )}
          {ranked.length < MIN_RANKED && (
            <p id="classements" className="mt-8 text-sm text-neutral-400">
              {t('home.selectedCreators')} <Link href="/creators" className="text-orange-400 hover:underline">{t('home.seeDirectory')}</Link>
            </p>
          )}

          {/* Selected videos (existing) */}
          {!unavailable && (
            <Section id="videos" title={t('home.videos.title')} accent={t('home.videos.accent')}>
              {/* Country names in the page's language, mapped here on the server (the list is a client component). */}
              <VideoDirectory locale={locale} videos={(videos ?? []).map((v) => ({ ...v, country_name: v.country_iso ? countryName(locale, v.country_iso, v.country_name) : v.country_name }))} />
            </Section>
          )}

          {!filtered && (
            <p className="mt-10 text-xs text-neutral-600">
              {t('home.footnote')}
            </p>
          )}
        </div>
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
