// Server-side (React Server Component) API access for the landing pages.
// API_INTERNAL_URL lets the web pods talk to the API over the cluster
// network (http://nouvellesdupays-api...:4000) instead of going back out
// through the public ingress; it falls back to the public URL.
import type { LandingPayload, LandingVideo } from './types';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiUnavailableError extends Error {}

// revalidate 0 = no cache (fresh on every request).
async function getJson<T>(path: string, revalidate = 60): Promise<T | null> {
  let res: Response;
  try {
    const caching: RequestInit = revalidate === 0 ? { cache: 'no-store' } : { next: { revalidate } };
    res = await fetch(`${API_URL}${path}`, { ...caching, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    console.error(`[serverApi] ${path} unreachable: ${(err as Error).message}`);
    throw new ApiUnavailableError(path);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[serverApi] ${path} returned ${res.status}`);
    throw new ApiUnavailableError(path);
  }
  return res.json() as Promise<T>;
}

export const serverApi = {
  // Not cached: with a revalidate window, Next.js kept serving the last good
  // render after an admin suspended a video (the refresh got a 404 and the
  // stale page stayed public until the web pods restarted - seen 2026-10-08).
  // Fetching fresh makes suspend/reject take effect on the next request.
  landing: (slug: string) => getJson<LandingPayload>(`/api/youtube/videos/${encodeURIComponent(slug)}`, 0),
  videos: (params = '') => getJson<LandingVideo[]>(`/api/youtube/videos${params}`, 120),
};

export const SITE_URL = 'https://nouvellesdupays.com';
