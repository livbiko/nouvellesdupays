import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import ChannelVideosToggle from '@/components/ChannelVideosToggle';
import { Breadcrumbs, Unavailable } from '@/components/AfricaBits';
import { countrySlug } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { CountryCreator, CountryCreatorsPage, CreatorKind } from '@/lib/types';

// A country's YouTube creator directory (Build #255, brief section 8), served at /youtube/<country-slug> since
// Build #261 (/creators/pays/<slug> redirects there). The page exists only for a country with at least 5 approved
// creators (the API answers 404 below that), so no empty country pages. Numbers are the latest public ones with
// their date, never estimates; growth needs a 25-40 day old snapshot and is not shown until there is one.
// ?type=, ?categorie= and ?tri=score|abonnes filter and sort.

export type CountryPageSearch = { type?: string; categorie?: string; tri?: string };

const KIND_LABEL: Record<CreatorKind, string> = { individual: 'Créateur', group: 'Collectif', media_brand: 'Marque média' };
const KIND_FILTER: { kind: CreatorKind | ''; label: string }[] = [
  { kind: '', label: 'Tous' }, { kind: 'individual', label: 'Créateurs' }, { kind: 'media_brand', label: 'Marques médias' },
];
const PLATFORM: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok' };
const SORTS = [{ key: 'score', label: 'Classement' }, { key: 'abonnes', label: 'Abonnés' }];

const nf = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

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

export function countryMetadata(slug: string, page: CountryCreatorsPage): Metadata {
  const name = page.country.name;
  return {
    title: `YouTube : créateurs et médias en ligne, ${name} — NouvellesDuPays`,
    description: `Les ${page.creators.length} chaînes YouTube de créateurs et médias du pays ${name} sélectionnées par NouvellesDuPays : audience publique, vidéos récentes et classement.`,
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

export default function CountryCreatorsView({ slug, page, sp }: { slug: string; page: CountryCreatorsPage | 'unavailable'; sp: CountryPageSearch }) {
  if (page === 'unavailable') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs items={[{ href: '/youtube', label: 'Vidéos & Chaînes' }]} />
        <div className="mt-8"><Unavailable /></div>
        <SiteFooter />
      </main>
    );
  }

  const { country, creators } = page;
  const categories = [...new Map(creators.flatMap((c) => c.categories).map((c) => [c.slug, c.name_fr])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const q = {
    type: KIND_FILTER.some((k) => k.kind === sp.type) ? String(sp.type) : '',
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
      <Breadcrumbs items={[{ href: '/youtube', label: 'Vidéos & Chaînes' }, { label: country.name }]} />
      <header className="mt-4 flex items-center gap-4">
        {country.flag_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={country.flag_url} alt={`Drapeau : ${country.name}`} width={56} height={37} className="rounded shrink-0" />
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight">YouTube : créateurs et médias en ligne, {country.name}</h1>
          <p className="text-neutral-400 text-sm mt-1">{creators.length} chaînes sélectionnées par notre équipe</p>
        </div>
      </header>
      <p className="text-neutral-400 mt-3 max-w-2xl text-sm">
        Classement dans le pays selon le score de performance YouTube (0-100 : audience, vues récentes, engagement,
        croissance et régularité). Il mesure la performance, pas la fiabilité de l’information. Les chiffres sont les
        derniers relevés publics, avec leur date ; un chiffre absent n’est pas disponible, jamais estimé.
      </p>

      <nav aria-label="Filtres" className="mt-6 flex flex-wrap gap-2 text-sm">
        {KIND_FILTER.map((k) => <Chip key={k.kind || 'all'} to={href(slug, { ...q, type: k.kind })} active={q.type === k.kind}>{k.label}</Chip>)}
      </nav>
      {categories.length > 1 && (
        <nav aria-label="Catégories" className="mt-2 flex flex-wrap gap-2 text-sm">
          <Chip to={href(slug, { ...q, categorie: '' })} active={!q.categorie}>Toutes catégories</Chip>
          {categories.map(([s, name]) => <Chip key={s} to={href(slug, { ...q, categorie: s })} active={q.categorie === s}>{name}</Chip>)}
        </nav>
      )}
      <nav aria-label="Tri" className="mt-2 flex flex-wrap gap-2 text-sm items-center">
        <span className="text-neutral-500">Trier par</span>
        {SORTS.map((s) => <Chip key={s.key} to={href(slug, { ...q, tri: s.key })} active={q.tri === s.key}>{s.label}</Chip>)}
      </nav>

      {list.length === 0 ? (
        <p className="mt-8 text-neutral-500 text-sm">Aucun profil avec ces filtres.</p>
      ) : (
        <ol className="mt-6 grid grid-cols-1 gap-3">
          {list.map((c) => <CreatorCard key={c.slug} c={c} />)}
        </ol>
      )}

      <section aria-label="À propos de ces chiffres" className="mt-8 text-xs text-neutral-500 space-y-1">
        {rankedAt && <p>Classement calculé le {day(rankedAt)}. {ranked.length < creators.length && 'Un profil sélectionné récemment est classé dès que ses vidéos récentes ont été relevées.'}</p>}
        <p>Croissance : pas encore assez d’historique (il faut un relevé d’au moins 25 jours).</p>
        {!withLanguage && <p>Filtre par langue : bientôt, quand la langue des chaînes sera renseignée.</p>}
        <p>Plateformes : YouTube pour l’instant ; Facebook et TikTok quand leur accès officiel aux données sera disponible.</p>
        <p>Une erreur ? <Link href="/contact" className="text-orange-400 hover:underline">Contactez-nous</Link>.</p>
      </section>
      <SiteFooter />
    </main>
  );
}

function CreatorCard({ c }: { c: CountryCreator }) {
  const m = c.channel?.metrics ?? {};
  const subs = subscribers(c);
  const measured = (m.subscribers ?? m.followers ?? m.total_views)?.measured_at;
  const recent = [
    m.recent_uploads_30d && `${nf.format(m.recent_uploads_30d.value)} vidéos en 30 jours`,
    m.avg_recent_views && `${nf.format(m.avg_recent_views.value)} vues moyennes récentes`,
    m.engagement_rate_bp && `engagement ${(m.engagement_rate_bp.value / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`,
  ].filter(Boolean);
  const primary = c.categories.find((k) => k.is_primary) ?? c.categories[0];
  const verified = c.confidence === 'VERIFIED' || c.confidence === 'HIGH_CONFIDENCE';
  return (
    <li className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="flex gap-3">
        <span className="w-10 shrink-0 text-center pt-2 tabular-nums" title={c.rank != null ? `Classement dans le pays (${c.total} classés)` : 'Pas encore classé'}>
          {c.rank != null ? <span className="text-lg font-semibold text-orange-400">{ordinal(c.rank)}</span> : <span className="text-neutral-600">—</span>}
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
            {[c.channel?.handle && `@${c.channel.handle}`, KIND_LABEL[c.creator_kind], primary?.name_fr].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs mt-1">
            <span className={verified ? 'text-green-400' : 'text-neutral-400'}>
              {verified ? 'Profil vérifié' : 'Sélectionné par la rédaction (identité non vérifiée)'}
            </span>
          </p>
          {(subs != null || m.total_views) && (
            <p className="text-sm text-neutral-300 mt-1 tabular-nums">
              {[subs != null && `${nf.format(subs)} abonnés`, m.total_views && `${nf.format(m.total_views.value)} vues au total`].filter(Boolean).join(' · ')}
              {measured && <span className="text-xs text-neutral-600"> (relevé le {day(measured)})</span>}
            </p>
          )}
          {recent.length > 0 && <p className="text-xs text-neutral-400 mt-1">{recent.join(' · ')}</p>}
        </div>
        <div className="text-right shrink-0 text-xs space-y-1">
          {c.score != null && <span className="block tabular-nums text-orange-400">score {Math.round(c.score)}</span>}
          {c.channel && (
            <a href={c.channel.url} target="_blank" rel="noopener noreferrer" className="block text-neutral-300 hover:text-orange-400">
              {PLATFORM[c.channel.platform] ?? c.channel.platform} ↗
            </a>
          )}
        </div>
      </div>
      {c.channel?.channel_id && <ChannelVideosToggle channelId={c.channel.channel_id} name={c.display_name} />}
    </li>
  );
}
