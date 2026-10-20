export interface Country {
  iso_code: string;
  name: string;
  region: string;
  capital: string | null;
  population: number | null;
  languages: string[];
  timezone: string | null;
  flag_url: string | null;
  lat: number;
  lng: number;
}

// /source/<slug> (GET /api/sources/:slug). Audience figures are only ever publicly measured
// values with their source; a platform without one shows nothing, never an estimate.
export interface SourceAudience {
  metric: 'subscribers' | 'followers' | 'total_views' | 'video_count' | 'avg_recent_views' | 'recent_uploads_30d';
  value: number;
  source: 'youtube_data_api' | 'reviewer';
  measured_at: string;
}

export interface PublisherScore {
  kind: 'activity' | 'reliability' | 'quality' | 'audience' | 'overall';
  total_score: number;
  score_band: 'low' | 'moderate' | 'good' | 'high' | 'priority';
  score_breakdown: Record<string, unknown>;
}

export interface SourceProfile {
  id: number;
  slug: string;
  name: string;
  homepage_url: string;
  logo_url: string | null;
  feed_status: 'active' | 'unavailable' | 'pending';
  language: string;
  source_type: string | null;
  creator_kind: 'organisation' | 'individual';
  description: string | null;
  city: string | null;
  country_name: string;
  country_iso: string;
  country_region: string | null;
  editorial_tags: string[] | null;
  editorial_confidence: 'high' | 'medium' | 'low' | 'unknown' | null;
  ownership_type: string | null;
  owner: string | null;
  editorial_review_required: boolean | null;
  feeds: { feed_type: string; feed_url: string; enabled: boolean; last_success_at: string | null; consecutive_failures: number }[];
  social_accounts: {
    platform: 'youtube' | 'facebook' | 'tiktok' | 'x' | 'instagram';
    url: string;
    handle: string | null;
    verification: 'unverified' | 'linked_from_site' | 'verified';
    status: string;
    audience: SourceAudience[];
  }[];
  articles: { id: number; headline: string; original_url: string; published_at: string | null; category: string | null }[];
  scores: PublisherScore[];
  rank_in_country: number | null;
  total_in_country: number | null;
}

export interface SourceIndexEntry {
  slug: string;
  name: string;
  country_iso: string;
  latest_at: string | null;
}

export interface Publisher {
  id: number;
  slug?: string | null;
  name: string;
  homepage_url: string;
  logo_url: string | null;
  feed_status: 'active' | 'unavailable' | 'pending' | 'suspended';
  language: string;
  source_type: string | null;
  feed_url: string | null;
  feed_type: 'rss' | 'atom' | 'sitemap-news' | null;
  youtube_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  editorial_tags: string[] | null;
  editorial_confidence: 'high' | 'medium' | 'low' | 'unknown' | null;
  top_subscribers: number | null;
  overall_score: number | null;
}

export interface Article {
  id: number;
  headline: string;
  summary: string | null;
  image_url: string | null;
  original_url: string;
  author: string | null;
  category: string;
  published_at: string | null;
  publisher_id: number;
  publisher_name: string;
  publisher_url: string;
  editorial_tags: string[] | null;
  editorial_confidence: 'high' | 'medium' | 'low' | 'unknown' | null;
}

export interface VideoChannel {
  id: number;
  name: string;
  description: string | null;
  topic: string | null;
  platform: 'youtube' | 'terrestrial' | 'satellite' | 'cable' | 'iptv' | 'streaming';
  youtube_channel_id: string | null;
  channel_url: string;
  page_url: string | null;
  logo_url: string | null;
  country_iso?: string;
  country_name?: string;
  is_selected_country?: boolean;
  latest_video: { title: string | null; url: string | null; published_at: string | null } | null;
}

export interface VideoChannels {
  live_now: VideoChannel[];
  local_voices: VideoChannel[];
  national_tv: VideoChannel[];
  // Pan-African channels, present (possibly empty) for African countries
  // only. Optional so an older API response still type-checks.
  africa_voices?: VideoChannel[];
}

export interface TitrologieArticle {
  headline: string;
  original_url: string;
  published_at: string | null;
  publisher_name: string;
  tag: string | null;
}

export interface TitrologieCluster {
  headline: string;
  articles: TitrologieArticle[];
}

export interface EvidenceSource {
  category: string;
  url: string;
  note?: string;
  accessed_at?: string;
}

export interface EditorialProfile {
  publisher_id: number;
  publisher_name: string;
  country_name: string;
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
}

export interface LandingVideo {
  id: number;
  youtube_video_id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  channel_name: string | null;
  channel_url: string | null;
  language: string | null;
  category: string | null;
  published_at: string | null;
  landing_headline: string | null;
  landing_cta_text: string | null;
  country_iso: string | null;
  country_name: string | null;
  country_flag_url: string | null;
}

export interface LandingPayload {
  video: LandingVideo;
  country: {
    iso_code: string;
    name: string;
    region: string;
    capital: string | null;
    population: number | null;
    languages: string[];
    flag_url: string | null;
  } | null;
  publisher: { id: number; name: string; homepage_url: string; logo_url: string | null } | null;
  related_videos: LandingVideo[];
  related_news: {
    id: number;
    headline: string;
    original_url: string;
    published_at: string | null;
    image_url: string | null;
    publisher_id: number;
    publisher_name: string;
  }[];
  cta_text: string;
}

// /africa/rankings (GET /api/rankings). Values only when audience_metrics has
// rows; never estimated — an entry without numbers simply won't appear in the list.
export interface RankingsEntry {
  id: number;
  slug: string | null;
  name: string;
  homepage_url: string;
  logo_url: string | null;
  country_name: string;
  country_iso: string;
  country_region: string | null;
  country_flag_url: string | null;
  platform: 'youtube' | 'facebook' | 'tiktok' | 'x' | 'instagram';
  account_url: string;
  handle: string | null;
  verification: string;
  metric_value: number;
  metric_name: string;
  measured_at: string;
}

export interface EditorialRankEntry {
  id: number;
  slug: string;
  name: string;
  homepage_url: string;
  logo_url: string | null;
  country_name: string;
  country_iso: string;
  country_region: string | null;
  country_flag_url: string | null;
  total_score: number;
  score_band: 'low' | 'moderate' | 'good' | 'high' | 'priority';
  computed_at: string;
}

export interface RankingsData {
  youtube_by_subscribers: RankingsEntry[];
  youtube_by_views: RankingsEntry[];
  all_by_followers: RankingsEntry[];
  editorial_by_overall: EditorialRankEntry[];
}

export interface AfricaCountry {
  iso_code: string;
  name: string;
  capital: string | null;
  population: number | null;
  flag_url: string | null;
  publishers: number;
  articles_24h: number;
  latest_at: string | null;
  national_tv: number;
  voices: number;
}

export interface AfricaSummary {
  regions: { region: string; countries: AfricaCountry[] }[];
}

export interface RegionArticle {
  id: number;
  headline: string;
  summary: string | null;
  image_url: string | null;
  original_url: string;
  category: string;
  published_at: string | null;
  publisher_id: number;
  publisher_name: string;
  publisher_url: string;
  country_iso: string;
  country_name: string;
  country_flag_url: string | null;
}
