import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import VideoDirectory from '@/components/VideoDirectory';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import { regionByName } from '@/lib/africa';
import type { CreatorListEntry, LandingVideo, VideoChannel } from '@/lib/types';

// Build #244: the YouTube creator ranking (approved creators with a ranking, worker creator-rankings.js) is shown
// here only once it has MIN_RANKED entries (owner, 11-12); below that a single line points to /creators.
const MIN_RANKED = 5;
const TOP_RANKED = 12;
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

function creatorPlace(c: CreatorListEntry): string {
  if (c.country_name) return c.country_name;
  const r = c.region ? regionByName(c.region) : null;
  return r ? r.label : c.region || '';
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vidéos & Chaînes — NouvellesDuPays',
  description: "Découvrez les créateurs et chaînes d'information africaines sélectionnés par NouvellesDuPays.",
  alternates: { canonical: '/youtube' },
};

function fmtSubscribers(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function ChannelCard({ ch }: { ch: VideoChannel }) {
  const ytUrl = ch.channel_url || (ch.youtube_channel_id ? `https://www.youtube.com/channel/${ch.youtube_channel_id}` : null);
  const subs = fmtSubscribers(ch.subscriber_count);
  return (
    <li>
      <a
        href={ytUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-orange-600 transition-colors h-full"
      >
        <div className="flex items-center gap-3">
          {ch.logo_url ? (
            <img src={ch.logo_url} alt="" width={40} height={40} className="rounded-full w-10 h-10 object-cover flex-shrink-0 bg-neutral-800" loading="lazy" />
          ) : (
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-orange-700 to-neutral-800 flex items-center justify-center text-lg font-bold text-white">
              {ch.name.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <span className="block text-sm font-semibold leading-tight group-hover:text-orange-400 truncate">{ch.name}</span>
            {ch.country_name && (
              <span className="block text-xs text-neutral-500 truncate">
                {ch.country_flag_url && (
                  <img src={ch.country_flag_url} alt="" width={14} height={10} className="inline mr-1 align-text-bottom" loading="lazy" />
                )}
                {ch.country_name}
                {subs && <> · {subs} abonnés</>}
              </span>
            )}
            {!ch.country_name && subs && (
              <span className="block text-xs text-neutral-500">{subs} abonnés</span>
            )}
          </div>
        </div>
        {ch.description && (
          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{ch.description}</p>
        )}
        {ch.latest_video?.title && (
          <p className="text-xs text-neutral-600 line-clamp-1 mt-auto pt-1 border-t border-neutral-800">
            ▶ {ch.latest_video.title}
          </p>
        )}
      </a>
    </li>
  );
}

export default async function YoutubeIndex() {
  let videos: LandingVideo[] | null = null;
  let channels: VideoChannel[] | null = null;
  let unavailable = false;

  try {
    [videos, channels] = await Promise.all([
      serverApi.videos('?limit=60'),
      serverApi.africaChannels(48),
    ]);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    unavailable = true;
  }
  // The ranking is extra: if it cannot be loaded the rest of the page still renders, without the section.
  let creators: CreatorListEntry[] | null = null;
  try {
    creators = (await serverApi.creators('?limit=100')) ?? [];
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
  }
  const ranked = (creators ?? []).filter((c) => c.score != null && c.rank != null)
    .sort((a, b) => (a.rank as number) - (b.rank as number));

  const hasChannels = channels && channels.length > 0;

  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour au globe</Link>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
            Créateurs & <span className="text-orange-500">Chaînes africaines</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            Chaînes d'information et créateurs indépendants d'Afrique sélectionnés par notre équipe.{' '}
            <Link href="/submit-video" className="underline">Proposer une vidéo</Link>
          </p>

          {unavailable && (
            <p className="mt-8 text-red-400 text-sm">Contenu momentanément indisponible. Merci de réessayer plus tard.</p>
          )}

          {creators !== null && ranked.length >= MIN_RANKED && (
            <section className="mt-10" aria-labelledby="classement">
              <h2 id="classement" className="text-base font-semibold text-neutral-200 mb-1">
                Classement des créateurs <span className="text-orange-500">YouTube</span>
              </h2>
              <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
                Créateurs vérifiés par notre équipe, classés par un score de 0 à 100 calculé à partir des chiffres publics de
                YouTube (audience, vues récentes, engagement, croissance, régularité). Il mesure la performance, pas la
                fiabilité de l’information.
              </p>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ranked.slice(0, TOP_RANKED).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/creators/${c.slug}`}
                      className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/60 p-3 hover:border-neutral-600">
                      <span className="w-6 text-right text-sm font-bold tabular-nums text-neutral-400">{c.rank}</span>
                      {c.profile_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.profile_image_url} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-full object-cover bg-neutral-800" />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-neutral-800" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{c.display_name}</span>
                        <span className="block text-xs text-neutral-500 truncate">
                          {[creatorPlace(c), c.primary_category, c.subscribers != null ? `${compact.format(c.subscribers)} abonnés` : null]
                            .filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums text-orange-400" title="Score de performance YouTube (0-100)">
                        {Math.round(c.score as number)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm">
                <Link href="/creators" className="text-orange-400 hover:underline">Tous les créateurs vérifiés →</Link>
              </p>
            </section>
          )}
          {creators !== null && ranked.length < MIN_RANKED && (
            <p className="mt-6 text-sm text-neutral-400">
              Créateurs vérifiés : <Link href="/creators" className="text-orange-400 hover:underline">voir l’annuaire →</Link>
            </p>
          )}

          {!unavailable && hasChannels && (
            <section className="mt-10">
              <h2 className="text-base font-semibold text-neutral-200 mb-4">
                Chaînes <span className="text-orange-500">{channels!.length}</span>
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {channels!.map((ch) => (
                  <ChannelCard key={ch.id} ch={ch} />
                ))}
              </ul>
            </section>
          )}

          {!unavailable && (
            <section className="mt-12">
              <h2 className="text-base font-semibold text-neutral-200 mb-4">
                Vidéos <span className="text-neutral-500 font-normal text-sm">sélectionnées</span>
              </h2>
              <VideoDirectory videos={videos ?? []} />
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
