import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import VideoDirectory from '@/components/VideoDirectory';
import DirectoryCard from '@/components/DirectoryCard';
import DirectoryFilters, { type DirectoryParams } from '@/components/DirectoryFilters';
import SafeImg from '@/components/SafeImg';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import { countrySlug, regionByName } from '@/lib/africa';
import { frCountry } from '@/lib/countryNames';
import type { CreatorCountry, CreatorListEntry, DirectoryEntry, LandingVideo, YoutubeDirectory } from '@/lib/types';

// CR-2026-11-16-11 (redesign phase 1): /youtube as one page of sections behind a tab bar - search and filters over every
// video channel and approved creator (GET /api/youtube/directory), independent creators, countries by continent,
// categories, rankings with their method, selected videos. Everything in French (owner, 11-16). Built from stored
// data only: no "latest video", trending or live section until phase 3 stores that data (no YouTube feed fetching -
// youtube.com/robots.txt disallows /feeds/videos.xml). Earlier: Build #244 ranking (MIN_RANKED), #261 country pages.
const MIN_RANKED = 5;
const TOP_RANKED = 10;
const PER_PAGE = 24;
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export const dynamic = 'force-dynamic';

const TITLE = 'Vidéos & Médias — NouvellesDuPays';
const DESCRIPTION = "Chaînes d'information, journalistes indépendants, télévisions en continu et créateurs influents d'Afrique et du monde entier : recherchez par pays, catégorie, type de chaîne et langue.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/youtube' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/youtube', type: 'website', locale: 'fr_FR', siteName: 'NouvellesDuPays' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const TABS = [
  ['decouvrir', 'Découvrir'],
  ['chaines', "Chaînes d'info"],
  ['independants', 'Créateurs indépendants'],
  ['pays', 'Pays'],
  ['categories', 'Catégories'],
  ['classements', 'Classements'],
  ['videos', 'Vidéos'],
] as const;

const SORTS = [
  ['populaires', 'Les plus suivies'],
  ['vues', 'Les plus vues'],
  ['score', 'Meilleur score'],
  ['croissance', 'Croissance'],
  ['alpha', 'A → Z'],
] as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

function creatorPlace(c: CreatorListEntry): string {
  if (c.country_iso) return frCountry(c.country_iso, c.country_name);
  const r = c.region ? regionByName(c.region) : null;
  return r ? r.label : c.region || '';
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
      serverApi.videos('?limit=60'),
    ]);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    unavailable = true;
  }
  // The ranking and country pages are extra: if they cannot be loaded the rest of the page still renders.
  let creators: CreatorListEntry[] = [];
  let countryPages: CreatorCountry[] = [];
  try {
    [creators, countryPages] = await Promise.all([
      serverApi.creators('?limit=200').then((r) => r ?? []),
      serverApi.creatorCountries().then((r) => (r ?? []).filter((c) => c.has_page)).catch(() => []),
    ]);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
  }

  // French country names, made here on the server so the filters' client component renders the same text.
  const facets = dir ? {
    ...dir.facets,
    countries: dir.facets.countries.map((c) => ({ ...c, name: frCountry(c.iso, c.name) })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  } : undefined;
  const typeLabel = Object.fromEntries((facets?.types ?? []).map((t) => [t.key, t.label]));
  const catLabel = Object.fromEntries((facets?.categories ?? []).map((c) => [c.slug, c.name_fr]));
  const card = (e: DirectoryEntry, from?: string) => (
    <DirectoryCard key={e.key} e={e} from={from} typeLabel={e.type ? typeLabel[e.type] ?? null : null}
      categoryLabel={e.primary_category ? catLabel[e.primary_category] ?? null : null} />
  );
  const pageIsos = new Set(countryPages.map((c) => c.iso));
  const ranked = creators.filter((c) => c.score != null && c.rank != null).sort((a, b) => (a.rank as number) - (b.rank as number));
  // Africa first (brief section 2): the best-ranked African creator, else the overall n°1.
  const featured = ranked.find((c) => c.region != null && /Africa/.test(c.region)) ?? ranked[0] ?? null;
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
    name: 'Chaînes vidéo et créateurs — NouvellesDuPays',
    itemListElement: dir.items.slice(0, 24).map((e, i) => ({
      '@type': 'ListItem', position: i + 1, name: e.name,
      url: e.profile_path ? `https://nouvellesdupays.com${e.profile_path}` : e.url ?? undefined,
    })),
  };

  return (
    <>
      <main className="min-h-screen px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour au globe</Link>

          {/* Hero */}
          <header id="decouvrir" className="scroll-mt-20 pt-4">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  NouvellesDuPays — <span className="text-orange-500">Vidéos & Médias</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                  Découvrez les chaînes d&apos;information, les journalistes indépendants, les télévisions en continu et les
                  créateurs influents d&apos;Afrique et du monde entier.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  {facets && <>{dir!.facets.countries.length} pays · </>}
                  Sélection de notre équipe, chiffres publics de YouTube.{' '}
                  <Link href="/submit-video" className="underline hover:text-neutral-300">Proposer une vidéo ou une chaîne</Link>
                </p>
              </div>
              {featured && (
                <div className="rounded-2xl border border-orange-900/60 bg-gradient-to-br from-orange-950/40 to-neutral-900 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">{featured.region != null && /Africa/.test(featured.region) ? 'À la une · meilleur score africain' : 'À la une · n°1 du classement'}</p>
                  <Link href={`/creators/${featured.slug}`} className="mt-3 flex items-center gap-3 hover:text-orange-300">
                    {featured.profile_image_url
                      ? <SafeImg src={featured.profile_image_url} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full bg-neutral-800 object-cover" />
                      : <span className="h-[52px] w-[52px] rounded-full bg-neutral-800" aria-hidden="true" />}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{featured.display_name}</span>
                      <span className="block truncate text-xs text-neutral-400">
                        {[creatorPlace(featured), featured.primary_category, featured.subscribers != null ? `${compact.format(featured.subscribers)} abonnés` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </div>
              )}
            </div>
            {facets && <DirectoryFilters facets={facets} params={params} total={dir!.total} />}
          </header>

          {/* Tabs */}
          <nav aria-label="Sections de la page" className="sticky top-0 z-20 -mx-4 mt-6 border-b border-neutral-800 bg-neutral-950/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
            <ul className="flex gap-1 overflow-x-auto py-2 text-sm [scrollbar-width:none]">
              {TABS.map(([id, label]) => (
                <li key={id} className="flex-shrink-0">
                  <a href={`${qs(params)}#${id}`} className="block rounded-full px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white">{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {unavailable && (
            <p className="mt-8 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              Contenu momentanément indisponible. Merci de réessayer dans quelques instants.
            </p>
          )}

          {/* Country pages (Build #261) */}
          {countryPages.length > 0 && (
            <Section id="pages-pays" title="Chaînes YouTube" accent="par pays"
              intro="Une page par pays dès que notre équipe y a sélectionné au moins 5 chaînes : classement, audience publique et vidéos récentes.">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {countryPages.map((c) => {
                  const top = creators.filter((x) => x.country_iso === c.iso).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 3);
                  return (
                    <li key={c.iso}>
                      <Link href={`/youtube/${countrySlug(c.name)}`} className="block h-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-orange-600">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold">{frCountry(c.iso, c.name)}</span>
                          <span className="text-xs tabular-nums text-neutral-500">{c.approved} chaînes</span>
                        </span>
                        <span className="mt-2 block truncate text-xs text-neutral-400">{top.map((t) => t.display_name).join(' · ')}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Directory */}
          {dir && (
            <Section id="chaines" title="Explorer les" accent="chaînes"
              intro="Télévisions, médias en ligne, voix locales et créateurs. Les chiffres viennent de YouTube ; une chaîne sans chiffre public n’en affiche pas.">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-500">Trier :</span>
                {SORTS.map(([key, label]) => (
                  <a key={key} href={qs({ ...params, sort: key }, '#chaines')} aria-current={params.sort === key ? 'true' : undefined}
                    className={`rounded-full border px-3 py-1 ${params.sort === key ? 'border-orange-500 bg-orange-950/50 text-orange-300' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                    {label}
                  </a>
                ))}
              </div>
              {dir.items.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{dir.items.map((e) => card(e))}</ul>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-400">
                  Aucune chaîne ne correspond à ces critères.{' '}
                  <a href="/youtube#chaines" className="text-orange-400 hover:underline">Réinitialiser les filtres</a>
                </div>
              )}
              {pages > 1 && (
                <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm">
                  {page > 1 && <a href={qs({ ...params, page: page - 1 }, '#chaines')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">← Précédent</a>}
                  <span className="tabular-nums text-neutral-400">Page {Math.min(page, pages)} sur {pages}</span>
                  {page < pages && <a href={qs({ ...params, page: page + 1 }, '#chaines')} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-neutral-500">Suivant →</a>}
                </nav>
              )}
            </Section>
          )}

          {/* Independent creators */}
          {independents && independents.items.length > 0 && (
            <Section id="independants" title="Voix" accent="indépendantes africaines"
              intro="Journalistes indépendants, analystes et créateurs d’Afrique, présentés à part des médias institutionnels. Un créateur n’est pas forcément un journaliste : sa fiche indique ce que nous savons de lui.">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{independents.items.map((e) => card(e, 'youtube_independants'))}</ul>
              {independents.total > independents.items.length && (
                <p className="mt-3 text-sm"><a href={qs({ type: 'createur-independant', continent: 'afrique' }, '#chaines')} className="text-orange-400 hover:underline">Voir les {independents.total} créateurs indépendants →</a></p>
              )}
            </Section>
          )}

          {/* Countries by continent */}
          {facets && facets.countries.length > 0 && (
            <Section id="pays" title="Explorer par" accent="pays" intro="L’Afrique d’abord, puis les autres continents. Le nombre indique les chaînes et créateurs référencés.">
              <div className="space-y-6">
                {facets.continents.map((c) => {
                  const list = facets.countries.filter((x) => x.continent === c.key);
                  if (!list.length) return null;
                  return (
                    <div key={c.key}>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">{c.label} <span className="font-normal text-neutral-500">· {list.length} pays</span></h3>
                      <ul className={`grid gap-2 ${c.key === 'afrique' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}>
                        {list.map((x) => (
                          <li key={x.iso}>
                            <a href={pageIsos.has(x.iso) ? `/youtube/${countrySlug(x.name)}` : qs({ country: x.iso }, '#chaines')}
                              className="flex h-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm hover:border-neutral-600">
                              {x.flag_url && <img src={x.flag_url} alt="" width={20} height={14} loading="lazy" className="h-3.5 w-5 flex-shrink-0 rounded-sm object-cover" />}
                              <span className="min-w-0 flex-1 truncate">{x.name}</span>
                              <span className="text-xs tabular-nums text-neutral-500">{x.count}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Categories */}
          {facets && facets.categories.length > 0 && (
            <Section id="categories" title="Explorer par" accent="catégorie">
              <ul className="flex flex-wrap gap-2">
                {facets.categories.filter((c) => !c.parent_slug).map((c) => (
                  <li key={c.slug}>
                    <a href={qs({ category: c.slug }, '#chaines')} className="block rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 hover:border-orange-500">
                      {c.name_fr} <span className="tabular-nums text-neutral-500">{c.count}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Rankings */}
          {ranked.length >= MIN_RANKED && (
            <Section id="classements" title="Classements" accent="YouTube"
              intro="Classement de performance des créateurs sélectionnés, calculé à partir des chiffres publics de YouTube. Il ne juge pas l’exactitude des informations.">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* min-w-0: grid items otherwise grow to their longest line (432 px wide page on a 390 px phone). */}
                <div className="min-w-0">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-300">Meilleurs scores</h3>
                  <ol className="space-y-2">
                    {ranked.slice(0, TOP_RANKED).map((c) => (
                      <li key={c.slug}>
                        <Link href={`/creators/${c.slug}`} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 hover:border-neutral-600">
                          <span className="w-6 text-right text-sm font-bold tabular-nums text-neutral-400">{c.rank}</span>
                          {c.profile_image_url
                            ? <SafeImg src={c.profile_image_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 rounded-full bg-neutral-800 object-cover" />
                            : <span className="h-9 w-9 rounded-full bg-neutral-800" aria-hidden="true" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{c.display_name}</span>
                            <span className="block truncate text-xs text-neutral-500">
                              {[creatorPlace(c), c.primary_category, c.subscribers != null ? `${compact.format(c.subscribers)} abonnés` : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="text-sm font-bold tabular-nums text-orange-400" title="Score de performance YouTube (0-100)">{Math.round(c.score as number)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="min-w-0 space-y-6">
                  {growth.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">Croissance la plus rapide</h3>
                      <ol className="space-y-2">
                        {growth.map((e) => (
                          <li key={e.key} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
                            {e.profile_path ? <Link href={e.profile_path} className="truncate hover:text-orange-400">{e.name}</Link> : <span className="truncate">{e.name}</span>}
                            <span className="flex-shrink-0 text-xs tabular-nums text-neutral-400" title="Score de croissance (0-100) : abonnés gagnés sur 30 jours">croissance {Math.round(e.growth as number)}/100</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {byCategory.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">Par catégorie</h3>
                      <ul className="space-y-2 text-sm">
                        {byCategory.map(([cat, list]) => (
                          <li key={cat} className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
                            <span className="text-xs text-neutral-500">{cat}</span>
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
                      <h3 className="mb-2 text-sm font-semibold text-neutral-300">Par pays</h3>
                      <p className="flex flex-wrap gap-2 text-sm">
                        {countryPages.map((c) => <Link key={c.iso} href={`/youtube/${countrySlug(c.name)}`} className="rounded-full border border-neutral-700 px-3 py-1 hover:border-orange-500">{frCountry(c.iso, c.name)}</Link>)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <details className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300">
                <summary className="cursor-pointer font-semibold">Comment le score est calculé</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-400">
                  <li>Cinq dimensions notées de 0 à 100 à partir des données publiques de l’API YouTube : audience (abonnés), vues récentes, engagement, croissance des abonnés sur 30 jours et régularité des publications.</li>
                  <li>Le score global est une moyenne pondérée des dimensions disponibles ; il faut au moins deux dimensions pour qu’un score soit publié.</li>
                  <li>Une donnée manquante ou masquée n’est jamais estimée : la dimension est simplement absente.</li>
                  <li>Le classement est recalculé environ toutes les 20 heures. Il mesure la performance d’une chaîne, pas la fiabilité ni l’exactitude de ses informations.</li>
                </ul>
              </details>
            </Section>
          )}
          {ranked.length < MIN_RANKED && (
            <p id="classements" className="mt-8 text-sm text-neutral-400">
              Créateurs sélectionnés : <Link href="/creators" className="text-orange-400 hover:underline">voir l’annuaire →</Link>
            </p>
          )}

          {/* Selected videos (existing) */}
          {!unavailable && (
            <Section id="videos" title="Vidéos" accent="sélectionnées">
              <VideoDirectory videos={videos ?? []} />
            </Section>
          )}

          {!filtered && featured && (
            <p className="mt-10 text-xs text-neutral-600">
              Les liens « YouTube ↗ » ouvrent la chaîne d’origine sur YouTube. NouvellesDuPays référence ces chaînes ; il ne les héberge pas.
            </p>
          )}
        </div>
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      </main>
      <SiteFooter />
    </>
  );
}
