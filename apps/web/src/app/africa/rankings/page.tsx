import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs, Section, Unavailable } from '@/components/AfricaBits';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { RankingsData, RankingsEntry } from '@/lib/types';

// /africa/rankings — spec section 16: Most Watched / Most Followed / Trending.
// Values are only shown when audience_metrics has real rows (source = youtube_data_api
// or reviewer). When the table is empty, every section shows a "waiting for data" notice
// so the page is useful even before YOUTUBE_API_KEY is configured.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Médias africains les plus suivis — NouvellesDuPays',
  description: 'Les chaînes YouTube, pages Facebook, comptes TikTok et sites africains les plus suivis, classés par abonnés et vues réelles.',
  alternates: { canonical: '/africa/rankings' },
};

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', x: 'X / Twitter', instagram: 'Instagram',
};
const METRIC_LABEL: Record<string, string> = {
  subscribers: 'abonnés', followers: 'abonnés', total_views: 'vues au total',
  video_count: 'vidéos', avg_recent_views: 'vues moyennes', recent_uploads_30d: 'vidéos / 30 j',
};

const nf = new Intl.NumberFormat('fr-FR');

function fmt(v: number) { return nf.format(v); }

function EmptyNotice() {
  return (
    <p className="text-sm text-neutral-500 py-4">
      Aucune donnée disponible pour l'instant — les statistiques sont collectées via l'API YouTube
      (abonnés, vues) et mises à jour chaque semaine une fois{' '}
      <code className="text-xs bg-neutral-800 px-1 py-0.5 rounded">YOUTUBE_API_KEY</code> configurée.
    </p>
  );
}

function RankingTable({ entries, caption }: { entries: RankingsEntry[]; caption: string }) {
  if (entries.length === 0) return <EmptyNotice />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={caption}>
        <thead>
          <tr className="text-left text-xs text-neutral-500 border-b border-neutral-800">
            <th className="py-2 pr-3 w-8">#</th>
            <th className="py-2 pr-3">Média</th>
            <th className="py-2 pr-3">Pays</th>
            <th className="py-2 pr-3">{PLATFORM_LABEL[entries[0]?.platform] ?? 'Plateforme'}</th>
            <th className="py-2 text-right">{METRIC_LABEL[entries[0]?.metric_name] ?? 'Audience'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900">
          {entries.map((e, i) => (
            <tr key={`${e.id}-${e.account_url}`} className="hover:bg-neutral-900/50">
              <td className="py-2 pr-3 text-neutral-600 tabular-nums">{i + 1}</td>
              <td className="py-2 pr-3 font-medium">
                {e.slug ? (
                  <Link href={`/source/${e.slug}`} className="hover:text-orange-400">{e.name}</Link>
                ) : (
                  <a href={e.homepage_url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400">{e.name}</a>
                )}
              </td>
              <td className="py-2 pr-3 text-neutral-400">
                {e.country_flag_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.country_flag_url} alt="" width={18} height={12} className="inline-block mr-1.5 rounded-sm align-text-bottom" loading="lazy" />
                )}
                {e.country_name}
              </td>
              <td className="py-2 pr-3">
                <a href={e.account_url} target="_blank" rel="noopener noreferrer"
                   className="text-neutral-400 hover:text-orange-400 text-xs truncate max-w-[180px] block">
                  {e.handle ? `@${e.handle}` : e.account_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
              </td>
              <td className="py-2 text-right tabular-nums font-medium">{fmt(e.metric_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RankingsPage() {
  let data: RankingsData | null = null;
  let unavailable = false;
  try {
    data = await serverApi.rankings();
  } catch (err) {
    if (err instanceof ApiUnavailableError) { unavailable = true; } else { throw err; }
  }

  const crumbs = [
    { href: '/', label: 'Globe' },
    { href: '/africa', label: 'Afrique' },
    { label: 'Classements' },
  ];

  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
            Médias africains les plus <span className="text-orange-500">suivis</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            Classements basés uniquement sur des données officielles et publiquement vérifiables.
            Les sources sans données mesurées n'apparaissent pas dans ces listes.
          </p>

          {unavailable && <Unavailable />}

          {!unavailable && (
            <>
              <Section id="yt-subs" title="YouTube — Abonnés">
                <RankingTable
                  entries={data?.youtube_by_subscribers ?? []}
                  caption="Top chaînes YouTube africaines par abonnés"
                />
              </Section>

              <Section id="yt-views" title="YouTube — Vues totales">
                <RankingTable
                  entries={data?.youtube_by_views ?? []}
                  caption="Top chaînes YouTube africaines par vues"
                />
              </Section>

              <Section id="all-followers" title="Toutes plateformes — Audience">
                <RankingTable
                  entries={data?.all_by_followers ?? []}
                  caption="Top médias africains toutes plateformes par audience"
                />
              </Section>

              <p className="mt-8 text-xs text-neutral-600">
                Données mises à jour chaque semaine via l'API officielle YouTube.
                Les chiffres Facebook, TikTok et Instagram sont saisis par la rédaction à partir de données publiques.
              </p>
            </>
          )}

          <p className="mt-10 text-sm">
            <Link href="/africa" className="text-orange-400 hover:underline">← Retour à l'Afrique</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
