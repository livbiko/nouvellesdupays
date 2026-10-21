import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import VideoDirectory from '@/components/VideoDirectory';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { LandingVideo, VideoChannel } from '@/lib/types';

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
