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

export interface Publisher {
  id: number;
  name: string;
  homepage_url: string;
  logo_url: string | null;
  feed_status: 'active' | 'unavailable' | 'pending';
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
