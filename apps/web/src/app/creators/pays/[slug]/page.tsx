import { permanentRedirect } from 'next/navigation';

// Build #261: a country's creator page moved to /youtube/<country-slug> (brief section 8). This old address (Build
// #255) redirects permanently, filters included, so links and search results keep working.
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OldCountryCreatorsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ['type', 'categorie', 'tri']) {
    const v = sp[k];
    if (typeof v === 'string' && v) q.set(k, v);
  }
  const s = q.toString();
  permanentRedirect(`/youtube/${encodeURIComponent(slug)}${s ? `?${s}` : ''}`);
}
