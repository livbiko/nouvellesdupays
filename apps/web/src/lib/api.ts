import type { Article, Country, Publisher } from './types';

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
  articles: (iso: string, opts?: { category?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.category) params.set('category', opts.category);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return getJson<Article[]>(`/api/countries/${iso}/articles${qs ? `?${qs}` : ''}`);
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
