import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import VideoDirectory from '@/components/VideoDirectory';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { LandingVideo } from '@/lib/types';

// Rendered per request: the API isn't reachable during `next build` (Docker
// image build), so prerendering would bake an error state into the page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vidéos — NouvellesDuPays',
  description: 'Vidéos d’actualité de chaînes et médias indépendants, sélectionnées par l’équipe NouvellesDuPays.',
  alternates: { canonical: '/youtube' },
};

export default async function YoutubeIndex() {
  let videos: LandingVideo[] | null = null;
  let unavailable = false;
  try {
    videos = (await serverApi.videos('?limit=60')) ?? [];
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
    unavailable = true;
  }
  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour au globe</Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
            Vidéos <span className="text-orange-500">sélectionnées</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            Des vidéos d’actualité de chaînes et médias de nombreux pays. <Link href="/submit-video" className="underline">Proposer une vidéo</Link>
          </p>
          {unavailable ? (
            <p className="mt-8 text-red-400 text-sm">Les vidéos sont momentanément indisponibles. Merci de réessayer plus tard.</p>
          ) : (
            <VideoDirectory videos={videos ?? []} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
