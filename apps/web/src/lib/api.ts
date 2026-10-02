import type { Article, Country, EditorialProfile, Publisher, TitrologieCluster, VideoChannels } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export interface PostResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  body: T & { error?: string; detail?: string; reason?: string };
}

// POST helper for the public forms -- a 4xx is an expected outcome the
// caller needs the parsed body for, not an exception.
export async function postJson<T = Record<string, unknown>>(path: string, payload: unknown): Promise<PostResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: 'Impossible de joindre le serveur. Vérifiez votre connexion.' } as PostResult<T>['body'] };
  }
}

export const api = {
  countries: () => getJson<Country[]>('/api/countries'),
  country: (iso: string) => getJson<Country>(`/api/countries/${iso}`),
  publishers: (iso: string) => getJson<Publisher[]>(`/api/countries/${iso}/publishers`),
  featured: (iso: string) => getJson<Article[]>(`/api/countries/${iso}/featured`),
  videoChannels: (iso: string) => getJson<VideoChannels>(`/api/countries/${iso}/video-channels`),
  titrologie: (iso: string) => getJson<TitrologieCluster[]>(`/api/countries/${iso}/titrologie`),
  articles: (iso: string, opts?: { category?: string; limit?: number; distinctPublisher?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.category) params.set('category', opts.category);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.distinctPublisher) params.set('distinct_publisher', '1');
    const qs = params.toString();
    return getJson<Article[]>(`/api/countries/${iso}/articles${qs ? `?${qs}` : ''}`);
  },
  // Not a getJson call -- a 404 here (no profile authored yet) is an
  // expected, common outcome, not an error worth throwing over.
  editorialProfile: async (publisherId: number): Promise<EditorialProfile | null> => {
    const res = await fetch(`${API_URL}/api/publishers/${publisherId}/editorial-profile`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API editorial-profile failed: ${res.status}`);
    return res.json();
  },
};
