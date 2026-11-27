import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import LanguageSelector from '@/components/LanguageSelector';
import FacebookVideoCard from '@/components/FacebookVideoCard';
import IndependentCreatorsCarousel from '@/components/IndependentCreatorsCarousel';
import DirectoryFilters, { type DirectoryParams, type FilterFacets } from '@/components/DirectoryFilters';
import CountryExplorer from '@/components/CountryExplorer';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import { countrySlug } from '@/lib/africa';
import { YOUTUBE_REGIONS, regionBySlug, type YoutubePlace } from '@/lib/youtubePlaces';
import { categoryName, countryName, dirOf, intlLocale, ogLocale, translator, type Locale } from '@/i18n';
import type { LocaleSource } from '@/i18n';
import { languageAlternates, localePath } from '@/i18n/routing';
import type { FacebookDirectory, FacebookVideo, YoutubeExplorer } from '@/lib/types';

// CR-2026-11-27-01: /facebook and /facebook/<place>[/<category>[/<subcategory>]] - the /youtube layout for Facebook
// videos entered by an admin: banner of the newest African videos, "Dernières vidéos", independent creators, videos
// by country, "Explorer par pays" beside every video with the filters. No subscriber numbers or rankings (no Facebook
// data). Places are the /youtube ones (regions, continents, countries by their French-name slug, "categorie" = all).
const PER_PAGE = 24;
const LATEST = 8;
const BANNER_QUERY = '?continent=afrique&limit=12';

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

export type FacebookPlace = { place: YoutubePlace | null; category: string | null; sub: string | null; path: string };

function qs(p: Record<string, string | number | undefined>, hash = ''): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && !(k === 'page' && v === 1) && k !== 'sort') s.set(k, String(v));
  const q = s.toString();
  return `${q ? `?${q}` : ''}${hash}`;
}

// /facebook/<slug>[/<cat>[/<sub>]] -> the place and filters, or null (404). Countries are looked up in the videos'
// facets, so a country without videos has no page.
export async function resolveFacebookPath(segments: string[]): Promise<FacebookPlace | null | 'unavailable'> {
  if (segments.length < 1 || segments.length > 3) return null;
  const [slug, category = null, sub = null] = segments;
  let place: YoutubePlace | null = null;
  if (slug === 'categorie') {
    if (!category) return null;
  } else {
    place = regionBySlug(slug);
    if (!place) {
      let dir: FacebookDirectory | null;
      try {
        dir = await serverApi.facebookDirectory('?per=1');
      } catch (err) {
        if (err instanceof ApiUnavailableError) return 'unavailable';
        throw err;
      }
      const c = dir?.facets.countries.find((x) => countrySlug(x.name) === slug);
      if (!c) return null;
      place = { kind: 'country', slug, label: c.name, query: { country: c.iso }, iso: c.iso, flagUrl: c.flag_url };
    }
  }
  if (category && !/^[a-z0-9-]{1,60}$/.test(category)) return null;
  if (sub && !/^[a-z0-9-]{1,60}$/.test(sub)) return null;
  return { place, category, sub, path: `/facebook/${segments.join('/')}` };
}

function placeLabel(p: FacebookPlace, locale: Locale, t: (k: string) => string): string | null {
  if (!p.place) return null;
  if (p.place.kind === 'country') return countryName(locale, p.place.iso, p.place.label);
  return t(`place.${p.place.slug}`);
}

export async function facebookMetadata(locale: Locale, p: FacebookPlace | null): Promise<Metadata> {
  const { t } = translator(locale);
  const path = p ? p.path : '/facebook';
  const where = p ? placeLabel(p, locale, t) : null;
  const title = `${t('facebook.heading')}${where ? ` — ${where}` : ''} — NouvellesDuPays`;
  const description = t('facebook.metaDescription');
  return {
    title, description,
    alternates: { canonical: localePath(locale, path), languages: languageAlternates(path) },
    openGraph: { title, description, url: localePath(locale, path), type: 'website', locale: ogLocale(locale), siteName: 'NouvellesDuPays' },
    twitter: { card: 'summary_large_image', title, description },
  };
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

const TABS = ['decouvrir', 'dernieres-videos', 'independants', 'pages-pays', 'videos'] as const;

export default async function FacebookView({ sp, locale, source, at = null }: { sp: SP; locale: Locale; source: LocaleSource; at?: FacebookPlace | null }) {
  const { t, tn } = translator(locale);
  const lp = (p: string) => localePath(locale, p);
  const now = Date.now();
  const base = at ? at.path : '/facebook';
  const fixed: Record<string, string> = { ...(at?.place?.query ?? {}), ...(at?.category ? { category: at.sub || at.category } : {}) };
  const params: DirectoryParams = {
    q: one(sp.q).slice(0, 100), country: fixed.country ?? one(sp.country).toUpperCase().slice(0, 2), continent: fixed.continent ?? one(sp.continent),
    category: fixed.category ?? one(sp.category), type: one(sp.type), lang: one(sp.lang), sort: '',
  };
  const region = fixed.region ?? '';
  const page = Math.max(parseInt(one(sp.page), 10) || 1, 1);
  const home = !at;

  let dir: FacebookDirectory | null = null;
  let unavailable = false;
  try {
    dir = await serverApi.facebookDirectory(qs({ ...params, region, page, per: PER_PAGE }));
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    unavailable = true;
  }
  // Extra sections: a failed answer only hides them.
  let banner: FacebookVideo[] = [];
  let latest: FacebookVideo[] = [];
  let latestUpdated: string | null = null;
  let independents: FacebookDirectory | null = null;
  let explorer: YoutubeExplorer | null = null;
  if (dir) {
    [banner, latest, independents, explorer] = await Promise.all([
      home ? serverApi.facebookLatest(BANNER_QUERY).then((r) => r?.items ?? []).catch(() => []) : Promise.resolve([]),
      home ? serverApi.facebookLatest(`?limit=${LATEST}`).then((r) => { latestUpdated = r?.updated_at ?? null; return r?.items ?? []; }).catch(() => []) : Promise.resolve([]),
      home ? serverApi.facebookDirectory(qs({ type: 'createur-independant', continent: 'afrique', per: 12 })).catch(() => null) : Promise.resolve(null),
      serverApi.facebookExplorer().catch(() => null),
    ]);
  }

  const facets = dir ? {
    ...dir.facets,
    countries: dir.facets.countries.map((c) => ({ ...c, name: countryName(locale, c.iso, c.name) })).sort((a, b) => a.name.localeCompare(b.name, intlLocale(locale))),
  } : undefined;
  const filterFacets: FilterFacets | undefined = facets && {
    continents: facets.continents.map(({ key, label }) => ({ key, label })),
    countries: facets.countries.map(({ iso, name, continent, count }) => ({ iso, name, continent, count })),
    categories: facets.categories.map(({ slug, name_fr, name_en, names, parent_slug, count }) => ({ slug, name_fr, name_en, names, parent_slug, count })),
    types: facets.types,
    languages: facets.languages,
  };
  const catLabel = Object.fromEntries((dir?.taxonomy ?? []).map((c) => [c.slug, categoryName(locale, c)]));
  const card = (v: FacebookVideo, className = '') => (
    <FacebookVideoCard key={v.key} v={v} locale={locale} now={now} className={className}
      typeLabel={v.type ? t(`type.${v.type}`) : null} categoryLabel={v.category ? catLabel[v.category] ?? null : null} />
  );
  const pages = dir ? Math.max(Math.ceil(dir.total / PER_PAGE), 1) : 1;
  const where = at ? placeLabel(at, locale, t) : null;
  const catTitle = at?.category ? catLabel[at.sub || at.category] ?? null : null;
  const empty = dir && dir.total === 0 && home && !Object.values(params).some(Boolean);
  const tabs = home ? TABS.filter((id) => (id !== 'dernieres-videos' || latest.length > 0) && (id !== 'independants' || (independents?.items.length ?? 0) > 0)
    && (id !== 'pages-pays' || (facets?.countries.length ?? 0) > 0) && (id !== 'videos' || (dir?.total ?? 0) > 0)) : [];

  return (
    <div dir={dirOf(locale)} lang={locale}>
      <main className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={t('facebook.breadcrumb')} className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-200">{t('home.backToGlobe')}</Link>
              {at && <Link href={lp('/facebook')} className="hover:text-neutral-200">{t('facebook.heading')}</Link>}
              <Link href={lp('/youtube')} className="hover:text-neutral-200">{t('facebook.toYoutube')}</Link>
            </nav>
            <LanguageSelector locale={locale} source={source} />
          </div>

          <header id="decouvrir" className="scroll-mt-20 pt-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {where || catTitle
                ? <>{t('facebook.heading')} — <span className="text-orange-500">{[where, catTitle].filter(Boolean).join(' · ')}</span></>
                : <>NouvellesDuPays — <span className="text-orange-500">{t('facebook.heading')}</span></>}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">{t('facebook.intro')}</p>
            {dir && dir.total > 0 && <p className="mt-2 text-xs text-neutral-500">{tn('facebook.count', dir.total)}</p>}

            {banner.length > 0 && (
              <div className="mt-6">
                <IndependentCreatorsCarousel id="a-la-une" title={t('facebook.banner.title')} accent={t('facebook.banner.accent')}
                  intro={t('facebook.banner.subtitle')} count={banner.length} locale={locale}
                  footer={<p className="mt-2 text-[11px] text-neutral-500">{t('facebook.source')}</p>}>
                  {banner.map((v) => card(v, 'w-[260px] flex-shrink-0 snap-start sm:w-[280px]'))}
                </IndependentCreatorsCarousel>
              </div>
            )}
            {filterFacets && dir!.total > 0 && (
              <DirectoryFilters facets={filterFacets} params={params} total={dir!.total} locale={locale} action={lp(`${base}#videos`)}
                fixedPlace={Boolean(at?.place)} fixedCategory={Boolean(at?.category)}
                textKeys={{ placeholder: 'facebook.filters.placeholder', languageNote: 'facebook.filters.languageNote' }} />
            )}
          </header>

          {tabs.length > 1 && (
            <nav aria-label={t('home.sections')} className="sticky top-0 z-20 -mx-4 mt-6 border-b border-neutral-800 bg-neutral-950/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
              <ul className="flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
                {tabs.map((id) => (
                  <li key={id} className="flex-shrink-0">
                    <a href={`#${id}`} className="block rounded-full px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white">{t(id === 'pages-pays' ? 'facebook.tab.countries' : `home.tab.${id}`)}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {unavailable && (
            <p className="mt-8 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{t('home.unavailable')}</p>
          )}
          {empty && (
            <p className="mt-8 rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-400">{t('facebook.empty')}</p>
          )}

          {latest.length > 0 && (
            <Section id="dernieres-videos" title={t('home.latest.title')} accent={t('home.latest.accent')} intro={t('facebook.latest.intro')}>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{latest.map((v) => card(v))}</ul>
              {latestUpdated && (
                <p className="mt-3 text-[11px] text-neutral-500">
                  {t('banner.updated', { date: new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(latestUpdated)) })}
                </p>
              )}
            </Section>
          )}

          {independents && independents.items.length > 0 && (
            <IndependentCreatorsCarousel id="independants" title={t('home.independents.title')} accent={t('home.independents.accent')}
              intro={t('facebook.independents.intro')} count={independents.items.length} locale={locale}>
              {independents.items.map((v) => card(v, 'w-[260px] flex-shrink-0 snap-start sm:w-[280px]'))}
            </IndependentCreatorsCarousel>
          )}

          {home && facets && facets.countries.length > 0 && (
            <Section id="pages-pays" title={t('facebook.countries.title')} accent={t('facebook.countries.accent')}>
              <div className="space-y-4">
                {facets.continents.map((c) => {
                  const list = facets.countries.filter((x) => x.continent === c.key);
                  if (!list.length) return null;
                  const slug = YOUTUBE_REGIONS.find((r) => r.query.continent === c.key)?.slug;
                  return (
                    <div key={c.key}>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">
                        {slug ? <Link href={lp(`/facebook/${slug}`)} className="hover:text-orange-400">{t(`continent.${c.key}`)}</Link> : t(`continent.${c.key}`)}
                      </h3>
                      <p className="flex flex-wrap gap-2 text-sm">
                        {list.map((x) => {
                          // Country page addresses use the stored (untranslated) name, like /youtube.
                          const fr = dir!.facets.countries.find((y) => y.iso === x.iso)?.name ?? x.name;
                          return (
                            <Link key={x.iso} href={lp(`/facebook/${countrySlug(fr)}`)} className="rounded-full border border-neutral-700 px-3 py-1 hover:border-orange-500">
                              {x.name} <span className="text-xs tabular-nums text-neutral-500">{x.count}</span>
                            </Link>
                          );
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {dir && (dir.total > 0 || !home) && (
            <div className={explorer ? 'lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8' : ''}>
              {explorer && (
                <aside id="pays" className="scroll-mt-20 pt-10 lg:sticky lg:top-14 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:pe-1">
                  <CountryExplorer explorer={explorer} locale={locale} base="/facebook" note={t('facebook.explorerNote')}
                    current={{ iso: params.country || undefined, category: params.category || undefined }} />
                </aside>
              )}
              <div className="min-w-0">
                <Section id="videos" title={t('facebook.all.title')} accent={t('facebook.all.accent')}>
                  {dir.items.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{dir.items.map((v) => card(v))}</ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-400">
                      {t('facebook.noMatch')}{' '}
                      <a href={lp('/facebook#videos')} className="text-orange-400 hover:underline">{t('filters.reset')}</a>
                    </div>
                  )}
                  {pages > 1 && (
                    <nav aria-label={t('pager.label')} className="mt-6 flex items-center justify-center gap-3 text-sm">
                      {page > 1 && <a href={qs({ ...params, ...(at ? Object.fromEntries(Object.keys(fixed).map((k) => [k, ''])) : {}), page: page - 1 }, '#videos')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">{t('pager.previous')}</a>}
                      <span className="tabular-nums text-neutral-400">{t('pager.pageOf', { page: Math.min(page, pages), pages })}</span>
                      {page < pages && <a href={qs({ ...params, ...(at ? Object.fromEntries(Object.keys(fixed).map((k) => [k, ''])) : {}), page: page + 1 }, '#videos')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">{t('pager.next')}</a>}
                    </nav>
                  )}
                  <p className="mt-4 text-[11px] text-neutral-500">{t('facebook.playNote')}</p>
                </Section>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
