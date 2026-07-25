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
  publisher_name: string;
  publisher_url: string;
}
