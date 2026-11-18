import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import DirectoryCard from '@/components/DirectoryCard';
import DirectoryFilters from '@/components/DirectoryFilters';
import { Breadcrumbs, Unavailable } from '@/components/AfricaBits';
import { SITE_URL, serverApi } from '@/lib/serverApi';
import { countrySlug } from '@/lib/africa';
import { frCountry } from '@/lib/countryNames';
import {
  ALL_COUNTRIES, YOUTUBE_REGIONS, categoryPath, countryPlace, inPlace, placeChain, placePath, regionBySlug, type YoutubePlace,
} from '@/lib/youtubePlaces';
import type { DirectoryCategory, YoutubeDirectory } from '@/lib/types';

// CR-2026-11-17-03: the nested /youtube pages, generated from the database (no page per country in the code):
//   /youtube/<region>                         a continent or an African region
//   /youtube/<country>                        a country without a creator page (Build #261 keeps the others)
//   /youtube/<place>/<category>[/<sub>]       a main category / subcategory in a region or country
//   /youtube/categorie/<category>[/<sub>]     the same for every country
// Each page: breadcrumb, French description, nested menu (places, then categories with their subcategories and
// counts), count, search and filters, cards, the most followed. Empty places and categories are 404 (no empty pages).
export type ListingSearch = { q?: string; type?: string; lang?: string; sort?: string; page?: string };

export type Listing = {
  place: YoutubePlace;
  main: DirectoryCategory | null;
  sub: DirectoryCategory | null;
  taxonomy: DirectoryCategory[];
  menu: YoutubeDirectory['facets'];
  allCountries: YoutubeDirectory['facets']['countries'];
};

const PER = 24;
const SORTS = [['populaires', 'Les plus suivies'], ['vues', 'Les plus vues'], ['alpha', 'A-Z']] as const;

// Resolves a path to a listing, null when it names nothing (404) or something empty, 'unavailable' when the API
// cannot answer (never a 404: a busy or rate-limited API must not tell search engines the page is gone).
// cache(): generateMetadata and the page share one resolution per request (half the API calls).
export const resolveListing = cache(async (placeSlug: string, cat?: string, sub?: string): Promise<Listing | null | 'unavailable'> => {
  let base: YoutubeDirectory | null;
  try {
    base = await serverApi.youtubeDirectory('?per=1');
  } catch {
    return 'unavailable';
  }
  if (!base) return null;
  const taxonomy = base.taxonomy ?? [];
  let place: YoutubePlace | null = regionBySlug(placeSlug);
  if (!place && placeSlug === ALL_COUNTRIES.slug && cat) place = ALL_COUNTRIES;
  if (!place) {
    const c = base.facets.countries.find((x) => countrySlug(x.name) === placeSlug);
    if (c) place = countryPlace(c);
  }
  if (!place) return null;
  const main = cat ? taxonomy.find((t) => t.slug === cat && !t.parent_slug) ?? null : null;
  const subCat = sub ? taxonomy.find((t) => t.slug === sub && t.parent_slug === cat) ?? null : null;
  if ((cat && !main) || (sub && !subCat)) return null;

  let menu = base.facets;
  if (place.kind !== 'all') {
    let placeData: YoutubeDirectory | null;
    try {
      placeData = await serverApi.youtubeDirectory(`?${new URLSearchParams({ ...place.query, per: '1' })}`);
    } catch {
      return 'unavailable';
    }
    if (!placeData?.place_facets || placeData.total === 0) return null;
    menu = placeData.place_facets;
  }
  const count = (slug: string) => menu.categories.find((c) => c.slug === slug)?.count ?? 0;
  if ((main && !count(main.slug)) || (subCat && !count(subCat.slug))) return null;
  return { place, main, sub: subCat, taxonomy, menu, allCountries: base.facets.countries };
});

function pathOf(l: Listing): string {
  if (l.main) return categoryPath(l.place, l.main.slug, l.sub?.slug);
  return placePath(l.place);
}

function titleOf(l: Listing): string {
  const what = l.sub?.name_fr ?? l.main?.name_fr;
  if (l.place.kind === 'all') return `${what} : chaînes YouTube de tous les pays`;
  return what ? `${what} : chaînes YouTube, ${l.place.label}` : `Chaînes YouTube et créateurs, ${l.place.label}`;
}

function descriptionOf(l: Listing, total?: number): string {
  const own = (l.sub ?? l.main)?.description_fr;
  if (own) return own;
  const n = total != null ? `${total} ` : '';
  const what = l.sub ? `de la catégorie « ${l.sub.name_fr} »` : l.main ? `de la catégorie « ${l.main.name_fr} »` : 'd’information, médias et créateurs';
  const where = l.place.kind === 'all' ? 'dans tous les pays' : `: ${l.place.label}`;
  return `${n}chaînes YouTube ${what} ${where}, répertoriées par NouvellesDuPays. Chiffres publics relevés sur YouTube ; un chiffre absent n’est pas disponible, jamais estimé.`;
}

export function listingMetadata(l: Listing): Metadata {
  const title = `${titleOf(l)} — NouvellesDuPays`;
  const description = descriptionOf(l).slice(0, 200);
  const url = pathOf(l);
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', locale: 'fr_FR', siteName: 'NouvellesDuPays' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export function ListingUnavailable() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ href: '/youtube', label: 'Vidéos & Médias' }]} />
      <div className="mt-8"><Unavailable /></div>
      <SiteFooter />
    </main>
  );
}

export default async function YoutubeListing({ l, sp }: { l: Listing; sp: ListingSearch }) {
  const path = pathOf(l);
  const s = (v?: string) => String(v || '').slice(0, 100);
  const filters = { q: s(sp.q), type: s(sp.type), lang: s(sp.lang) };
  const sort = SORTS.some(([k]) => k === sp.sort) ? String(sp.sort) : 'populaires';
  const page = Math.max(parseInt(String(sp.page || '1'), 10) || 1, 1);
  const query = new URLSearchParams({
    ...l.place.query, ...(l.sub || l.main ? { category: (l.sub ?? l.main)!.slug } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), sort, page: String(page), per: String(PER),
  });
  let data: YoutubeDirectory | null = null;
  try {
    data = await serverApi.youtubeDirectory(`?${query}`);
  } catch {
    data = null;
  }
  if (!data) return <ListingUnavailable />;

  const typeLabel = Object.fromEntries(data.facets.types.map((t) => [t.key, t.label]));
  const catLabel = Object.fromEntries(l.taxonomy.map((t) => [t.slug, t.name_fr]));
  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries({ ...filters, sort }).filter(([, v]) => v)), ...over });
    if (q.get('sort') === 'populaires') q.delete('sort');
    if (q.get('page') === '1') q.delete('page');
    const qs = q.toString();
    return `${path}${qs ? `?${qs}` : ''}`;
  };
  const pages = Math.ceil(data.total / PER);

  // Breadcrumb: Vidéos & Médias › region › country › category › subcategory.
  const crumbs: { href?: string; label: string }[] = [{ href: '/youtube', label: 'Vidéos & Médias' }];
  if (l.place.kind === 'all') crumbs.push({ href: '/youtube#categories', label: 'Catégories' });
  else for (const p of placeChain(l.place)) crumbs.push({ href: placePath(p), label: p.label });
  if (l.main) crumbs.push({ href: categoryPath(l.place, l.main.slug), label: l.main.name_fr });
  if (l.sub) crumbs.push({ label: l.sub.name_fr });
  crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };

  // Nested menu: places inside this one, then categories present here with their subcategories.
  const menuCount = (slug: string) => l.menu.categories.find((c) => c.slug === slug)?.count ?? 0;
  const mains = l.taxonomy.filter((t) => !t.parent_slug && menuCount(t.slug));
  const subsOf = (slug: string) => l.taxonomy.filter((t) => t.parent_slug === slug && menuCount(t.slug));
  const childRegions = l.place.kind === 'region' && l.place.slug === 'afrique'
    ? YOUTUBE_REGIONS.filter((r) => r.parent?.slug === 'afrique') : [];
  const countries = l.place.kind === 'region'
    ? l.menu.countries.filter((c) => inPlace(c, l.place))
      .map((c) => ({ ...c, label: frCountry(c.iso, c.name) })).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [...crumbs.slice(0, -1), { ...crumbs[crumbs.length - 1], href: path }].map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: c.label, item: `${SITE_URL}${c.href ?? path}`,
        })),
      },
      {
        '@type': 'ItemList', name: titleOf(l), numberOfItems: data.total,
        itemListElement: data.items.map((e, i) => ({ '@type': 'ListItem', position: (page - 1) * PER + i + 1, name: e.name, ...(e.url ? { url: e.url } : {}) })),
      },
    ],
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 flex items-start gap-4">
        {l.place.flagUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.place.flagUrl} alt="" width={48} height={32} className="mt-1 rounded shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{titleOf(l)}</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">{descriptionOf(l, data.total)}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-label="Navigation par lieu et par catégorie" className="space-y-5 text-sm">
          {childRegions.length > 0 && (
            <nav aria-label="Régions">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Régions</h2>
              <ul className="space-y-1">
                {childRegions.map((r) => <li key={r.slug}><Link href={placePath(r)} className="text-neutral-300 hover:text-orange-400">{r.label}</Link></li>)}
              </ul>
            </nav>
          )}
          {countries.length > 0 && (
            <nav aria-label="Pays">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Pays</h2>
              <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {countries.map((c) => (
                  <li key={c.iso}>
                    <Link href={`/youtube/${countrySlug(c.name)}${l.main ? `/${l.main.slug}${l.sub ? `/${l.sub.slug}` : ''}` : ''}`}
                      className="flex items-center gap-2 text-neutral-300 hover:text-orange-400">
                      {c.flag_url && <img src={c.flag_url} alt="" width={16} height={11} loading="lazy" className="rounded-sm" />}
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="tabular-nums text-xs text-neutral-500">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <nav aria-label="Catégories">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Catégories</h2>
            <ul className="space-y-1">
              {l.place.kind !== 'all' && (
                <li><Link href={placePath(l.place)} aria-current={!l.main ? 'page' : undefined}
                  className={!l.main ? 'font-semibold text-orange-400' : 'text-neutral-300 hover:text-orange-400'}>Toutes les catégories</Link></li>
              )}
              {mains.map((m) => {
                const open = l.main?.slug === m.slug;
                const subs = subsOf(m.slug);
                return (
                  <li key={m.slug}>
                    <Link href={categoryPath(l.place, m.slug)} aria-current={open && !l.sub ? 'page' : undefined}
                      className={`flex justify-between gap-2 ${open ? 'font-semibold text-orange-400' : 'text-neutral-300 hover:text-orange-400'}`}>
                      <span>{m.name_fr}</span><span className="tabular-nums text-xs text-neutral-500">{menuCount(m.slug)}</span>
                    </Link>
                    {open && subs.length > 0 && (
                      <ul className="mt-1 space-y-1 border-l border-neutral-800 pl-3">
                        {subs.map((c) => (
                          <li key={c.slug}>
                            <Link href={categoryPath(l.place, m.slug, c.slug)} aria-current={l.sub?.slug === c.slug ? 'page' : undefined}
                              className={`flex justify-between gap-2 ${l.sub?.slug === c.slug ? 'text-orange-400' : 'text-neutral-400 hover:text-orange-400'}`}>
                              <span>{c.name_fr}</span><span className="tabular-nums text-xs text-neutral-500">{menuCount(c.slug)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          <DirectoryFilters facets={data.facets} total={data.total} action={path} fixedPlace fixedCategory
            params={{ ...filters, country: '', continent: '', category: '', sort }} />
          <nav aria-label="Tri" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">Trier :</span>
            {SORTS.map(([k, label]) => (
              <Link key={k} href={href({ sort: k, page: '1' })} aria-current={sort === k ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 ${sort === k ? 'border-orange-500 text-orange-300' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                {label}
              </Link>
            ))}
          </nav>
          {data.items.length === 0 ? (
            <p className="mt-8 text-sm text-neutral-500">Aucune chaîne avec ces filtres. <Link href={path} className="text-orange-400 hover:underline">Réinitialiser</Link></p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((e) => {
                // On a subcategory page the card shows that subcategory, elsewhere the entry's main one.
                const cat = l.sub && e.categories.includes(l.sub.slug) ? l.sub.slug : e.primary_category;
                return (
                  <DirectoryCard key={e.key} e={e} from="youtube_category_page" typeLabel={e.type ? typeLabel[e.type] ?? null : null}
                    categoryLabel={cat ? catLabel[cat] ?? null : null} />
                );
              })}
            </ul>
          )}
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center gap-3 text-sm">
              {page > 1 && <Link href={href({ page: String(page - 1) })} className="text-orange-400 hover:underline">← Précédente</Link>}
              <span className="text-neutral-500">Page {page} sur {pages}</span>
              {page < pages && <Link href={href({ page: String(page + 1) })} className="text-orange-400 hover:underline">Suivante →</Link>}
            </nav>
          )}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <SiteFooter />
    </main>
  );
}
