import { notFound, redirect } from 'next/navigation';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';

// /watch/<youtube-video-id> -> /youtube/<slug>, keeping the query string so
// UTM/fbclid attribution survives the redirect.
export default async function WatchRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { videoId } = await params;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) notFound();
  let data = null;
  try {
    data = await serverApi.landing(videoId);
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
  }
  if (!data) notFound();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/youtube/${data.video.slug}${query ? `?${query}` : ''}`);
}
