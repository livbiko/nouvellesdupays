// Server-side (React Server Component) API access for the landing pages.
// API_INTERNAL_URL lets the web pods talk to the API over the cluster
// network (http://nouvellesdupays-api...:4000) instead of going back out
// through the public ingress; it falls back to the public URL.
import type { LandingPayload, LandingVideo } from './types';

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiUnavailableError extends Error {}

async function getJson<T>(path: string, revalidate = 60): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
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
  landing: (slug: string) => getJson<LandingPayload>(`/api/youtube/videos/${encodeURIComponent(slug)}`),
  videos: (params = '') => getJson<LandingVideo[]>(`/api/youtube/videos${params}`, 120),
};

export const SITE_URL = 'https://nouvellesdupays.com';
