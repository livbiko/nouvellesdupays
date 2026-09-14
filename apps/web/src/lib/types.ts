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
