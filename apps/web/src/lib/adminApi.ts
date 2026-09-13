// Admin API client -- separate from lib/api.ts (the public read API) since
// every call here needs an Authorization header and treats 401 specially
// (redirect to login), neither of which the public client needs.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'ndp_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export interface Submission {
  id: number;
  name: string;
  homepage_url: string;
  feed_url: string;
  feed_type: string;
  country_name: string;
  iso_code: string;
  language: string;
  contact_email: string | null;
  status: 'pending' | 'approved' | 'rejected';
  verification_detail: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface AdminPublisher {
  id: number;
  name: string;
  homepage_url: string;
  feed_status: 'active' | 'unavailable' | 'pending';
  language: string;
  source_type: string;
  terms_url: string | null;
  license_status: string;
  attribution_required: boolean;
  country_name: string;
  iso_code: string;
  feed_count: number;
}

export const SOURCE_TYPES = [
  'NEWS_AGENCY', 'NEWSPAPER', 'TV', 'RADIO', 'MAGAZINE', 'ONLINE_NEWS',
  'INVESTIGATIVE', 'BLOG', 'JOURNALIST', 'YOUTUBE_NEWS', 'PODCAST',
  'SOCIAL_NEWS', 'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER',
] as const;

export const LICENSE_STATUSES = [
  'unclear', 'headline_excerpt_only', 'licensed_full_content', 'partnership_agreed',
] as const;

class UnauthorizedError extends Error {}

async function adminFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError('Session expirée ou invalide');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Requête échouée (${res.status})`);
  }
  return res.json();
}

export const adminApi = {
  login: async (password: string): Promise<string> => {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error('Mot de passe incorrect');
    const { token } = await res.json();
    setToken(token);
    return token;
  },

  submissions: (status: string = 'pending') =>
    adminFetch<Submission[]>(`/api/admin/submissions?status=${status}`),

  approveSubmission: (id: number) =>
    adminFetch<{ status: string; publisher_id: number }>(`/api/admin/submissions/${id}/approve`, { method: 'POST' }),

  rejectSubmission: (id: number, note?: string) =>
    adminFetch<{ status: string }>(`/api/admin/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  publishers: (countryIso?: string) =>
    adminFetch<AdminPublisher[]>(`/api/admin/publishers${countryIso ? `?country_iso=${countryIso}` : ''}`),

  updatePublisher: (id: number, fields: Partial<Pick<AdminPublisher, 'feed_status' | 'source_type' | 'terms_url' | 'license_status' | 'attribution_required'>>) =>
    adminFetch<{ status: string }>(`/api/admin/publishers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
};

export { UnauthorizedError };
