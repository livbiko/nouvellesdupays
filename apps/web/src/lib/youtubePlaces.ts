import { countrySlug } from '@/lib/africa';
import { frCountry } from '@/lib/countryNames';
import type { DirectoryCountryFacet } from '@/lib/types';

// CR-2026-11-17-03: the places of the nested /youtube pages - /youtube/<region>, /youtube/<country>, and "categorie"
// (every country) - and the directory query each stands for. Region slugs and "categorie" are reserved: no video
// landing page takes them (API youtube.js reservedSlug).
export type YoutubePlace = {
  kind: 'region' | 'country' | 'all';
  slug: string;
  label: string;
  query: Record<string, string>;
  parent?: YoutubePlace;
  iso?: string;
  flagUrl?: string | null;
};

const AFRICA: YoutubePlace = { kind: 'region', slug: 'afrique', label: 'Afrique', query: { continent: 'afrique' } };

export const YOUTUBE_REGIONS: YoutubePlace[] = [
  AFRICA,
  { kind: 'region', slug: 'afrique-de-l-ouest', label: "Afrique de l'Ouest", query: { region: 'afrique-de-l-ouest' }, parent: AFRICA },
  { kind: 'region', slug: 'afrique-centrale', label: 'Afrique centrale', query: { region: 'afrique-centrale' }, parent: AFRICA },
  { kind: 'region', slug: 'afrique-de-l-est', label: "Afrique de l'Est", query: { region: 'afrique-de-l-est' }, parent: AFRICA },
  { kind: 'region', slug: 'afrique-du-nord', label: 'Afrique du Nord', query: { region: 'afrique-du-nord' }, parent: AFRICA },
  { kind: 'region', slug: 'afrique-australe', label: 'Afrique australe', query: { region: 'afrique-australe' }, parent: AFRICA },
  { kind: 'region', slug: 'europe', label: 'Europe', query: { continent: 'europe' } },
  { kind: 'region', slug: 'asie', label: 'Asie', query: { continent: 'asie' } },
  { kind: 'region', slug: 'moyen-orient', label: 'Moyen-Orient', query: { continent: 'moyen-orient' } },
  { kind: 'region', slug: 'amerique-du-nord', label: 'Amérique du Nord et centrale', query: { continent: 'amerique-nord' } },
  { kind: 'region', slug: 'amerique-du-sud', label: 'Amérique du Sud', query: { continent: 'amerique-sud' } },
  { kind: 'region', slug: 'oceanie', label: 'Océanie', query: { continent: 'oceanie' } },
];

export const ALL_COUNTRIES: YoutubePlace = { kind: 'all', slug: 'categorie', label: 'Tous les pays', query: {} };

// countries.region (English) -> the region page a country belongs to.
const REGION_OF: Record<string, string> = {
  'West Africa': 'afrique-de-l-ouest', 'Central Africa': 'afrique-centrale', 'East Africa': 'afrique-de-l-est',
  'North Africa': 'afrique-du-nord', 'Southern Africa': 'afrique-australe',
};
const CONTINENT_SLUG: Record<string, string> = {
  afrique: 'afrique', europe: 'europe', asie: 'asie', 'moyen-orient': 'moyen-orient', 'amerique-nord': 'amerique-du-nord',
  'amerique-sud': 'amerique-du-sud', oceanie: 'oceanie',
};

export const regionBySlug = (slug: string) => YOUTUBE_REGIONS.find((r) => r.slug === slug) || null;

export function countryPlace(c: DirectoryCountryFacet): YoutubePlace {
  const parentSlug = (c.region && REGION_OF[c.region]) || (c.continent && CONTINENT_SLUG[c.continent]) || null;
  return {
    kind: 'country', slug: countrySlug(c.name), label: frCountry(c.iso, c.name), query: { country: c.iso },
    parent: parentSlug ? regionBySlug(parentSlug) || undefined : undefined, iso: c.iso, flagUrl: c.flag_url,
  };
}

// Does a country (facet) belong to a region place?
export function inPlace(c: DirectoryCountryFacet, place: YoutubePlace): boolean {
  if (place.query.region) return REGION_OF[c.region || ''] === place.query.region;
  if (place.query.continent) return c.continent === place.query.continent;
  if (place.query.country) return c.iso === place.query.country;
  return true;
}

export function placePath(place: YoutubePlace): string {
  return place.kind === 'all' ? '/youtube' : `/youtube/${place.slug}`;
}

// /youtube/<place>/<category>[/<sub>]; "all countries" lives under /youtube/categorie/.
export function categoryPath(place: YoutubePlace, cat: string, sub?: string | null): string {
  return `/youtube/${place.slug}/${cat}${sub ? `/${sub}` : ''}`;
}

export function placeChain(place: YoutubePlace): YoutubePlace[] {
  const chain: YoutubePlace[] = [];
  for (let p: YoutubePlace | undefined = place; p; p = p.parent) chain.unshift(p);
  return chain;
}
