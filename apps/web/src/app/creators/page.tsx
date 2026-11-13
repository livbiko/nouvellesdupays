import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs, Unavailable } from '@/components/AfricaBits';
import { regionByName } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { CreatorKind, CreatorListEntry } from '@/lib/types';

// /creators: the public creator directory (Build #231). Only creators a reviewer approved are listed; numbers are
// the latest publicly measured ones (YouTube Data API or a reviewer), never estimates. ?pays=<iso> and ?type=<kind>
// filter the list. Rendered per request like /source.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créateurs et médias en ligne africains — NouvellesDuPays',
  description: 'Les créateurs de contenu et médias en ligne africains sélectionnés par NouvellesDuPays : chaînes, pays, catégories et audience publique.',
  alternates: { canonical: '/creators' },
};

const KIND_LABEL: Record<CreatorKind, string> = {
  individual: 'Créateur', group: 'Collectif', media_brand: 'Marque média',
};
const KIND_FILTER: { kind: CreatorKind | ''; label: string }[] = [
  { kind: '', label: 'Tous' }, { kind: 'individual', label: 'Créateurs' }, { kind: 'media_brand', label: 'Marques médias' },
];

type Props = { searchParams: Promise<{ pays?: string; type?: string }> };

const nf = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

function place(c: CreatorListEntry): string {
  if (c.country_name) return c.country_name;
  const r = c.region ? regionByName(c.region) : null;
  return r ? r.label : c.region || '';
}

function href(pays: string, type: string): string {
  const q = new URLSearchParams();
  if (pays) q.set('pays', pays);
  if (type) q.set('type', type);
  const s = q.toString();
  return s ? `/creators?${s}` : '/creators';
}

export default async function CreatorsPage({ searchParams }: Props) {
  const sp = await searchParams;
  let all: CreatorListEntry[] | null;
  try {
    all = (await serverApi.creators('?limit=500')) ?? [];
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    all = null;
  }
  const pays = String(sp.pays || '').toUpperCase();
  const type = KIND_FILTER.some((k) => k.kind === sp.type) ? String(sp.type) : '';
  const countries = all
    ? [...new Map(all.filter((c) => c.country_iso).map((c) => [c.country_iso as string, c.country_name as string])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'fr'))
    : [];
  const list = (all ?? []).filter((c) => (!pays || c.country_iso === pays) && (!type || c.creator_kind === type));

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ href: '/africa', label: 'Afrique' }, { label: 'Créateurs' }]} />
      <header className="mt-4">
        <h1 className="text-2xl font-bold leading-tight">Créateurs et médias en ligne</h1>
        <p className="text-neutral-400 mt-2 max-w-2xl text-sm">
          Créateurs sélectionnés par notre équipe. Les profils « vérifiés » sont reliés à une preuve publique (site officiel,
          lien croisé, badge) ; les profils « sélectionnés » ont été retenus par la rédaction sans vérification d’identité. Les audiences sont les derniers chiffres publics, jamais des estimations. Le score
          (0-100) combine audience, vues récentes, engagement, croissance et régularité ; il mesure la performance, pas la
          fiabilité de l’information.
        </p>
      </header>

      {all === null ? (
        <div className="mt-8"><Unavailable /></div>
      ) : (
        <>
          <nav aria-label="Filtres" className="mt-6 flex flex-wrap gap-2 text-sm">
            {KIND_FILTER.map((k) => (
              <Link key={k.kind || 'all'} href={href(pays, k.kind)}
                className={`rounded-full border px-3 py-1 ${type === k.kind ? 'border-orange-400 text-orange-400' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                {k.label}
              </Link>
            ))}
            {countries.length > 1 && <span className="w-px bg-neutral-800 mx-1" aria-hidden="true" />}
            {countries.length > 1 && [['', 'Tous les pays'] as [string, string], ...countries].map(([iso, name]) => (
              <Link key={iso || 'all-countries'} href={href(iso, type)}
                className={`rounded-full border px-3 py-1 ${pays === iso ? 'border-orange-400 text-orange-400' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                {name}
              </Link>
            ))}
          </nav>

          {list.length === 0 ? (
            <p className="mt-8 text-neutral-500 text-sm">
              Aucun profil pour l’instant{pays || type ? ' avec ces filtres' : ''}. Les profils apparaissent ici une fois sélectionnés par notre équipe.
            </p>
          ) : (
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {list.map((c) => (
                <li key={c.slug}>
                  <Link href={`/creators/${c.slug}`}
                    className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/60 p-3 hover:border-neutral-600">
                    {c.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.profile_image_url} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 rounded-full object-cover bg-neutral-800" />
                    ) : (
                      <span className="h-11 w-11 rounded-full bg-neutral-800" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{c.display_name}</span>
                      <span className="block text-xs text-neutral-500 truncate">
                        {[KIND_LABEL[c.creator_kind], place(c), c.primary_category].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="text-right whitespace-nowrap">
                      {c.subscribers != null && <span className="block text-sm tabular-nums text-neutral-300">{nf.format(c.subscribers)} abonnés</span>}
                      {c.score != null && <span className="block text-xs tabular-nums text-orange-400" title="Score de performance YouTube (0-100)">score {Math.round(c.score)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <SiteFooter />
    </main>
  );
}
