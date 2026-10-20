import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs } from '@/components/AfricaBits';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { PublisherSearchResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Repertoire des sources — NouvellesDuPays',
  description: 'Sources d’information africaines : journaux, radios, télévisions et médias en ligne, triés par score éditorial.',
  alternates: { canonical: '/publishers' },
};

const BAND_COLOR: Record<NonNullable<PublisherSearchResult['score_band']>, string> = {
  priority: 'text-emerald-400',
  high:     'text-green-400',
  good:     'text-yellow-400',
  moderate: 'text-orange-400',
  low:      'text-neutral-400',
};
const BAND_DOT: Record<NonNullable<PublisherSearchResult['score_band']>, string> = {
  priority: 'bg-emerald-500',
  high:     'bg-green-500',
  good:     'bg-yellow-500',
  moderate: 'bg-orange-400',
  low:      'bg-neutral-600',
};

const nf = new Intl.NumberFormat('fr-FR');
function fmtSubs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')} k`;
  return nf.format(n);
}

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp   = await searchParams;
  const q    = typeof sp.q === 'string' ? sp.q.trim() : '';

  let results: PublisherSearchResult[] = [];
  let unavailable = false;
  try {
    results = (await serverApi.publisherSearch(q, 200)) ?? [];
  } catch (err) {
    if (err instanceof ApiUnavailableError) { unavailable = true; } else { throw err; }
  }

  const crumbs = [
    { href: '/', label: 'Globe' },
    { label: 'Sources' },
  ];

  const scored   = results.filter((p) => p.overall_score != null);
  const unscored = results.filter((p) => p.overall_score == null);

  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
            Sources d&apos;information
          </h1>
          <p className="text-neutral-400 text-sm mt-1 mb-6">
            {q
              ? `${results.length} source${results.length !== 1 ? 's' : ''} correspondant à « ${q} »`
              : `${results.length} sources actives indexées — triées par score éditorial`}
          </p>

          <form action="/publishers" method="get" className="flex gap-2 mb-8">
            <input
              type="search" name="q" defaultValue={q}
              placeholder="Rechercher par nom…"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-orange-500"
              aria-label="Rechercher un média"
            />
            <button type="submit" className="px-4 py-2 text-sm rounded bg-orange-600 hover:bg-orange-500 font-medium transition-colors">
              Rechercher
            </button>
            {q && (
              <Link href="/publishers" className="px-3 py-2 text-sm rounded border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-neutral-200 transition-colors">
                Effacer
              </Link>
            )}
          </form>

          {unavailable && (
            <p className="text-sm text-neutral-500 py-4">Le service est momentanément indisponible. Veuillez réessayer.</p>
          )}
          {!unavailable && results.length === 0 && (
            <p className="text-sm text-neutral-500 py-4">Aucune source ne correspond à votre recherche.</p>
          )}
          {!unavailable && results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Répertoire des sources">
                <thead>
                  <tr className="text-left text-xs text-neutral-500 border-b border-neutral-800">
                    <th className="py-2 pr-3 w-8">#</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Pays</th>
                    <th className="py-2 pr-3 text-right hidden sm:table-cell">Abonnés</th>
                    <th className="py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {scored.map((pub, i) => (
                    <tr key={pub.id} className="hover:bg-neutral-900/50">
                      <td className="py-2 pr-3 text-neutral-600 tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">
                        <Link href={`/source/${encodeURIComponent(pub.slug)}`} className="hover:text-orange-400">{pub.name}</Link>
                      </td>
                      <td className="py-2 pr-3 text-neutral-400 whitespace-nowrap">
                        {pub.country_flag_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pub.country_flag_url} alt="" width={18} height={12} className="inline-block mr-1.5 rounded-sm align-text-bottom" loading="lazy" />
                        )}
                        <span className="hidden sm:inline">{pub.country_name}</span>
                        <span className="sm:hidden">{pub.country_iso}</span>
                      </td>
                      <td className="py-2 pr-3 text-right text-neutral-400 tabular-nums hidden sm:table-cell">
                        {pub.top_subscribers != null ? fmtSubs(pub.top_subscribers) : <span className="text-neutral-700">—</span>}
                      </td>
                      <td className="py-2 text-right">
                        {pub.overall_score != null && pub.score_band != null ? (
                          <><span className={`tabular-nums font-bold ${BAND_COLOR[pub.score_band]}`}>{pub.overall_score}</span><span className="text-neutral-600 text-xs">/100</span></>
                        ) : <span className="text-neutral-700">—</span>}
                      </td>
                    </tr>
                  ))}
                  {unscored.length > 0 && scored.length > 0 && (
                    <tr><td colSpan={5} className="py-3 text-xs text-neutral-600 italic">
                      {unscored.length} source{unscored.length !== 1 ? 's' : ''} sans score (profil éditorial en attente)
                    </td></tr>
                  )}
                  {unscored.map((pub) => (
                    <tr key={pub.id} className="hover:bg-neutral-900/50 opacity-60">
                      <td className="py-2 pr-3 text-neutral-700">—</td>
                      <td className="py-2 pr-3 font-medium">
                        <Link href={`/source/${encodeURIComponent(pub.slug)}`} className="hover:text-orange-400">{pub.name}</Link>
                      </td>
                      <td className="py-2 pr-3 text-neutral-500 whitespace-nowrap">
                        {pub.country_flag_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pub.country_flag_url} alt="" width={18} height={12} className="inline-block mr-1.5 rounded-sm align-text-bottom" loading="lazy" />
                        )}
                        <span className="hidden sm:inline">{pub.country_name}</span>
                        <span className="sm:hidden">{pub.country_iso}</span>
                      </td>
                      <td className="py-2 pr-3 text-right text-neutral-500 tabular-nums hidden sm:table-cell">
                        {pub.top_subscribers != null ? fmtSubs(pub.top_subscribers) : <span className="text-neutral-700">—</span>}
                      </td>
                      <td className="py-2 text-right text-neutral-700">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-10 text-sm">
            <Link href="/" className="text-orange-400 hover:underline">← Retour au globe</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
