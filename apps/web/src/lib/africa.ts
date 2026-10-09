// Regions and URL slugs for the /africa pages. Region names match
// countries.region in the database; slugs are the public URLs
// (/africa/west-africa, /africa/cote-divoire).
export interface AfricaRegion {
  slug: string;
  name: string; // countries.region
  label: string; // displayed (French UI)
  of: string; // "l’actualité …"
}

export const AFRICA_REGIONS: AfricaRegion[] = [
  { slug: 'west-africa', name: 'West Africa', label: 'Afrique de l’Ouest', of: 'de l’Afrique de l’Ouest' },
  { slug: 'east-africa', name: 'East Africa', label: 'Afrique de l’Est', of: 'de l’Afrique de l’Est' },
  { slug: 'central-africa', name: 'Central Africa', label: 'Afrique centrale', of: 'd’Afrique centrale' },
  { slug: 'north-africa', name: 'North Africa', label: 'Afrique du Nord', of: 'd’Afrique du Nord' },
  { slug: 'southern-africa', name: 'Southern Africa', label: 'Afrique australe', of: 'd’Afrique australe' },
];

export const regionBySlug = (slug: string) => AFRICA_REGIONS.find((r) => r.slug === slug) ?? null;
export const regionByName = (name: string) => AFRICA_REGIONS.find((r) => r.name === name) ?? null;

// "Côte d'Ivoire" -> "cote-divoire", "São Tomé and Príncipe" -> "sao-tome-and-principe".
export function countrySlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatPopulation(n: number | null): string | null {
  return n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : null;
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
