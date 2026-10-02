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
  country_name: string;
  iso_code: string;
  language: string;
  contact_email: string | null;
  status: 'submitted' | 'pending' | 'approved' | 'active' | 'rejected' | 'suspended';
  feed_url: string | null;
  feed_type: string | null;
  ingestion_method: 'feed' | 'api' | 'sitemap' | 'html';
  domain: string | null;
  region: string | null;
  city: string | null;
  description: string | null;
  categories: string[];
  contact_name: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  api_url: string | null;
  logo_url: string | null;
  sitemap_url: string | null;
  category_urls: string[];
  article_url_patterns: string[];
  permission_confirmed: boolean;
  publisher_id: number | null;
  verification_detail: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface AdminPublisher {
  id: number;
  name: string;
  homepage_url: string;
  feed_status: 'active' | 'unavailable' | 'pending' | 'suspended';
  language: string;
  source_type: string;
  terms_url: string | null;
  license_status: string;
  attribution_required: boolean;
  country_name: string;
  iso_code: string;
  feed_count: number;
  logo_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
  region: string | null;
  city: string | null;
  description: string | null;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  error_sources: number | null;
  source_types: string[] | null;
  article_count: number;
  last_article_at: string | null;
  clicks_30d: number;
}

export interface Source {
  id: number;
  publisher_id: number;
  feed_url: string;
  feed_type: 'rss' | 'atom' | 'sitemap-news' | 'sitemap' | 'html';
  last_fetched_at: string | null;
  last_status: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_failures: number;
  crawl_frequency_minutes: number | null;
  enabled: boolean;
  allowed_domains: string[];
  respect_robots_txt: boolean;
  category_urls: string[];
  article_url_patterns: string[];
  parser_config: Record<string, unknown>;
  article_count: number;
}

export interface SourceTestResult {
  ok: boolean;
  detail: string;
  sample?: { title: string; link: string; published_at: string | null }[];
  log?: string[];
  duration_ms: number;
}

export interface AdminVideo {
  id: number;
  youtube_video_id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  channel_url: string | null;
  country_iso: string | null;
  country_name: string | null;
  language: string | null;
  category: string | null;
  published_at: string | null;
  contact_email: string | null;
  metadata_source: 'youtube_api' | 'oembed' | 'submitter';
  availability: 'available' | 'unavailable' | 'unknown';
  status: 'submitted' | 'pending' | 'approved' | 'rejected' | 'suspended';
  reviewer_note: string | null;
  landing_headline: string | null;
  landing_cta_text: string | null;
  is_featured: boolean;
  submitted_at: string;
  approved_at: string | null;
}

export interface AdminChannel {
  id: number;
  youtube_channel_id: string | null;
  handle: string | null;
  channel_url: string;
  name: string | null;
  description: string | null;
  country_iso: string | null;
  country_name: string | null;
  category: string | null;
  contact_email: string | null;
  verification: 'verified' | 'unverified' | 'invalid';
  status: 'submitted' | 'pending' | 'approved' | 'rejected' | 'suspended';
  video_count: number;
  submitted_at: string;
}

export type Settings = Record<string, string | number | boolean>;
export interface SettingsResponse {
  settings: Settings;
  secrets: { meta_access_token_configured: boolean; youtube_api_key_configured: boolean; meta_graph_api_version: string };
}

export interface LiveEvent {
  id: number;
  event_id: string;
  event_name: string;
  event_category: string;
  occurred_at: string;
  received_at: string;
  page_path: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  channel: string | null;
  visitor: string;
  session: string;
  country_iso: string | null;
  video_id: number | null;
  publisher_id: number | null;
  properties: Record<string, unknown>;
  is_debug: boolean;
  source: 'client' | 'server';
  meta_status: string;
}

export interface Campaign {
  id: number;
  utm_campaign: string;
  label: string | null;
  platform: string;
  objective: string | null;
  status: string;
  notes: string | null;
  total_spend: string;
  currency: string | null;
  spend: { id: number; spend_date: string; utm_content: string; amount: string; currency: string; impressions: number | null; link_clicks: number | null }[];
}

export interface Lead {
  id: number;
  email: string;
  name: string | null;
  country_name: string | null;
  interests: string[];
  marketing_consent: boolean;
  source_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  video_slug: string | null;
  created_at: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

export interface Invitation {
  id: number;
  discovered_source_id: number;
  source_name: string;
  homepage_url: string;
  country_name: string | null;
  iso_code: string | null;
  channel: 'email' | 'whatsapp' | 'contact_form' | 'linkedin' | 'facebook' | 'x';
  template_used: string | null;
  subject: string | null;
  body: string | null;
  status: 'drafted' | 'awaiting_approval' | 'approved' | 'sent' | 'opened' | 'replied' | 'bounced' | 'opted_out' | 'rejected_by_reviewer';
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export const INVITATION_STATUSES = [
  'drafted', 'awaiting_approval', 'approved', 'sent', 'opened', 'replied', 'bounced', 'opted_out', 'rejected_by_reviewer',
] as const;

export interface EvidenceSource {
  category: string;
  url: string;
  note?: string;
  accessed_at?: string;
}

export interface EditorialProfile {
  publisher_id: number;
  publisher_name: string;
  homepage_url: string;
  country_name: string;
  iso_code: string;
  profile_id: number | null;
  ownership_type: string | null;
  owner: string | null;
  classification_tags: string[];
  political_party_association: string | null;
  historical_context: string | null;
  current_context: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  evidence_summary: string | null;
  evidence_sources: EvidenceSource[];
  classification_date: string | null;
  last_reviewed: string | null;
  evidence_date: string | null;
  review_required: boolean | null;
}

export const EDITORIAL_TAGS = [
  'public_state', 'government_aligned', 'party_aligned', 'opposition_aligned',
  'independent', 'commercial_generalist', 'editorially_mixed', 'specialist', 'unknown',
] as const;

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;

export const SOURCE_TYPES = [
  'NEWS_AGENCY', 'NEWSPAPER', 'TV', 'RADIO', 'MAGAZINE', 'ONLINE_NEWS',
  'INVESTIGATIVE', 'BLOG', 'JOURNALIST', 'YOUTUBE_NEWS', 'PODCAST',
  'SOCIAL_NEWS', 'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER',
] as const;

export const LICENSE_STATUSES = [
  'unclear', 'headline_excerpt_only', 'licensed_full_content', 'partnership_agreed',
] as const;

class UnauthorizedError extends Error {}

export async function adminFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
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

  submissionAction: (id: number, action: 'review' | 'activate' | 'suspend', note?: string) =>
    adminFetch<{ status: string }>(`/api/admin/submissions/${id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) }),

  sources: (publisherId: number) => adminFetch<Source[]>(`/api/admin/publishers/${publisherId}/sources`),
  addSource: (publisherId: number, fields: Partial<Source>) =>
    adminFetch<{ id: number }>(`/api/admin/publishers/${publisherId}/sources`, { method: 'POST', body: JSON.stringify(fields) }),
  updateSource: (id: number, fields: Partial<Source>) =>
    adminFetch<{ status: string }>(`/api/admin/sources/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  testSource: (id: number) => adminFetch<SourceTestResult>(`/api/admin/sources/${id}/test`, { method: 'POST', body: '{}' }),

  videos: (status = 'all') => adminFetch<AdminVideo[]>(`/api/admin/youtube/videos?status=${status}`),
  videoAction: (id: number, action: 'review' | 'approve' | 'reject' | 'suspend' | 'refresh', note?: string) =>
    adminFetch<{ status?: string; availability?: string }>(`/api/admin/youtube/videos/${id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) }),
  updateVideo: (id: number, fields: Record<string, unknown>) =>
    adminFetch<{ status: string; slug: string }>(`/api/admin/youtube/videos/${id}`, { method: 'PATCH', body: JSON.stringify(fields) }),
  channels: (status = 'all') => adminFetch<AdminChannel[]>(`/api/admin/youtube/channels?status=${status}`),
  channelAction: (id: number, action: 'approve' | 'reject' | 'suspend', note?: string) =>
    adminFetch<{ status: string }>(`/api/admin/youtube/channels/${id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) }),

  settings: () => adminFetch<SettingsResponse>('/api/admin/settings'),
  saveSettings: (fields: Settings) => adminFetch<SettingsResponse>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(fields) }),

  dashboard: (qs: string) => adminFetch<Dashboard>(`/api/admin/analytics/dashboard?${qs}`),
  filterOptions: (qs: string) => adminFetch<FilterOptions>(`/api/admin/analytics/filters?${qs}`),
  live: (afterId: number, visitorId?: string) =>
    adminFetch<{ events: LiveEvent[]; server_time: string }>(`/api/admin/analytics/live?after_id=${afterId}${visitorId ? `&visitor_id=${visitorId}` : ''}`),

  campaigns: () => adminFetch<{ campaigns: Campaign[]; unregistered_campaigns: string[] }>('/api/admin/campaigns'),
  saveCampaign: (fields: Partial<Campaign>) => adminFetch<{ id: number }>('/api/admin/campaigns', { method: 'POST', body: JSON.stringify(fields) }),
  addSpend: (campaignId: number, fields: Record<string, unknown>) =>
    adminFetch<{ id: number }>(`/api/admin/campaigns/${campaignId}/spend`, { method: 'POST', body: JSON.stringify(fields) }),
  deleteSpend: (id: number) => adminFetch<{ status: string }>(`/api/admin/campaign-spend/${id}`, { method: 'DELETE' }),

  leads: () => adminFetch<Lead[]>('/api/admin/leads'),
  contactMessages: () => adminFetch<ContactMessage[]>('/api/admin/contact-messages'),
  updateContactMessage: (id: number, status: ContactMessage['status']) =>
    adminFetch<{ status: string }>(`/api/admin/contact-messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Export: authenticated download (Bearer header), saved via a blob URL.
  download: async (qs: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/admin/analytics/export?${qs}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401) {
      clearToken();
      throw new UnauthorizedError('Session expirée ou invalide');
    }
    if (!res.ok) throw new Error(`Export échoué (${res.status})`);
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'export';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  submissions: (status: string = 'pending') =>
    adminFetch<Submission[]>(`/api/admin/submissions?status=${status}`),

  approveSubmission: (id: number) =>
    adminFetch<{ status: string; publisher_id: number; live: boolean }>(`/api/admin/submissions/${id}/approve`, {
      method: 'POST',
      body: '{}',
    }),

  rejectSubmission: (id: number, note?: string) =>
    adminFetch<{ status: string }>(`/api/admin/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  publishers: (countryIso?: string) =>
    adminFetch<AdminPublisher[]>(`/api/admin/publishers${countryIso ? `?country_iso=${countryIso}` : ''}`),

  updatePublisher: (id: number, fields: Partial<AdminPublisher>) =>
    adminFetch<{ status: string }>(`/api/admin/publishers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),

  invitations: (status: string = 'sent') =>
    adminFetch<Invitation[]>(`/api/admin/invitations?status=${status}`),

  updateInvitationStatus: (id: number, status: Invitation['status']) =>
    adminFetch<{ status: string }>(`/api/admin/invitations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  editorialProfiles: (countryIso?: string) =>
    adminFetch<EditorialProfile[]>(`/api/admin/editorial-profiles${countryIso ? `?country_iso=${countryIso}` : ''}`),

  saveEditorialProfile: (
    publisherId: number,
    fields: Partial<Pick<EditorialProfile,
      'ownership_type' | 'owner' | 'classification_tags' | 'political_party_association' |
      'historical_context' | 'current_context' | 'confidence' | 'evidence_summary' |
      'evidence_sources' | 'evidence_date' | 'review_required'>>
  ) =>
    adminFetch<{ status: string; profile_id: number }>(`/api/admin/editorial-profiles/${publisherId}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),
};

export { UnauthorizedError };

// --- Analytics dashboard types --------------------------------------------

export interface Totals {
  unique_visitors: number;
  total_visitors: number;
  sessions: number;
  page_views: number;
  facebook_visitors: number;
  ad_visitors: number;
  organic_visitors: number;
  youtube_visitors: number;
  landing_page_views: number;
  clicks: number;
  registration_starts: number;
  registrations: number;
  leads: number;
  conversion_rate: number | null;
  lead_rate: number | null;
}

export interface CampaignRow {
  campaign: string | null;
  source: string | null;
  medium: string | null;
  content: string | null;
  visitors: number;
  sessions: number;
  landing_page_views: number;
  clicks: number;
  registration_starts: number;
  registrations: number;
  leads: number;
  conversion_rate: number | null;
  spend: number | null;
  currency: string | null;
  cost_per_lead: number | null;
}

export interface CampaignTotal extends Omit<CampaignRow, 'source' | 'medium' | 'content'> {
  link_clicks: number | null;
  impressions: number | null;
  cost_per_registration: number | null;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number | null;
  rate_from_previous: number | null;
  rate_from_top: number | null;
}

export interface Dashboard {
  filters: { from: string; to: string; range: string; tz: string };
  overview: {
    totals: Totals;
    timeseries: { day: string; visitors: number; page_views: number; facebook_visitors: number; registrations: number }[];
    channels: { channel: string; sessions: number; visitors: number }[];
    table_totals: Record<string, number>;
  };
  campaigns: { ads: CampaignRow[]; campaigns: CampaignTotal[] };
  landing_pages: { landing_page: string; visitors: number; sessions: number; youtube_clicks: number; registration_starts: number; registrations: number; conversion_rate: number | null }[];
  publisher_registration: {
    submitted: number; approved: number; active: number; pending: number; rejected: number; suspended: number; without_feed: number;
    form_views: number; started: number; completed: number; completion_rate: number | null;
  };
  youtube: {
    video_id: number; slug: string; title: string; channel_name: string | null; status: string;
    views: number; visitors: number; thumbnail_clicks: number; plays: number; outbound_clicks: number; shares: number;
    clicks: number; registrations: number; conversion_rate: number | null;
  }[];
  funnel: { scope: 'facebook' | 'all'; stages: FunnelStage[]; sessions: number; completed_any_path: number };
}

export interface FilterOptions {
  countries: { iso_code: string; name: string }[];
  campaigns: string[];
  sources: string[];
  mediums: string[];
  landing_pages: string[];
  publishers: { id: number; name: string }[];
  youtube_channels: { id: number; name: string | null; channel_url: string }[];
  youtube_videos: { id: number; slug: string; title: string }[];
}
