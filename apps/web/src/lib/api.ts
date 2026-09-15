import type { Article, Country, EditorialProfile, Publisher, TitrologieCluster, VideoChannels } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export interface PublisherRegistration {
  name: string;
  homepage_url: string;
  feed_url: string;
  country_iso: string;
  language: string;
  contact_email?: string;
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

  // Not a getJson call -- POST, and a 4xx here is an expected outcome
  // (validation/verification failure) the caller needs the parsed body
  // for, not just a thrown error.
  registerPublisher: async (payload: PublisherRegistration) => {
    const res = await fetch(`${API_URL}/api/publishers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  },
};
