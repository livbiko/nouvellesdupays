import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs, CountryCards, Section, Unavailable } from '@/components/AfricaBits';
import { AFRICA_REGIONS, regionByName } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { AfricaSummary } from '@/lib/types';

// Rendered per request (the API isn't reachable during `next build`); the
// data itself is cached for a few minutes in serverApi.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Actualités d’Afrique, pays par pays — NouvellesDuPays',
  description: 'Les médias et l’actualité de chaque pays africain : journaux, sites d’information, agences, télévisions et radios, région par région.',
  alternates: { canonical: '/africa' },
};

export default async function AfricaIndex() {
  let summary: AfricaSummary | null = null;
  try {
    summary = await serverApi.africaSummary();
  } catch (err) {
    if (!(err instanceof ApiUnavailableError)) throw err;
  }
  const totals = summary?.regions.flatMap((r) => r.countries).reduce(
    (t, c) => ({ countries: t.countries + 1, publishers: t.publishers + c.publishers, articles: t.articles + c.articles_24h }),
    { countries: 0, publishers: 0, articles: 0 }
  );

  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs items={[{ href: '/', label: 'Globe' }, { label: 'Afrique' }]} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
            L’actualité de l’<span className="text-orange-500">Afrique</span>, pays par pays
          </h1>
          {totals && (
            <p className="text-neutral-400 text-sm mt-2">
              {totals.countries} pays · {totals.publishers} médias suivis · {totals.articles} articles ces dernières 24 heures
            </p>
          )}
          <nav aria-label="Régions" className="mt-4 flex flex-wrap gap-2 text-sm">
            {AFRICA_REGIONS.map((r) => (
              <Link key={r.slug} href={`/africa/${r.slug}`} className="rounded-full border border-neutral-800 px-3 py-1 hover:border-orange-500/60">
                {r.label}
              </Link>
            ))}
          </nav>
          {!summary && <Unavailable />}
          {summary?.regions.map(({ region, countries }) => {
            const r = regionByName(region);
            if (!r || countries.length === 0) return null;
            return (
              <Section key={r.slug} id={`region-${r.slug}`} title={r.label}>
                <CountryCards countries={countries} />
                <p className="mt-2 text-sm">
                  <Link href={`/africa/${r.slug}`} className="text-orange-400 hover:text-orange-300">Toute l’actualité {r.of} →</Link>
                </p>
              </Section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
