import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs, CountryCards, Section, Unavailable } from '@/components/AfricaBits';
import { AFRICA_REGIONS, regionByName } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { AfricaSummary, EditorialRankEntry, RankingsData } from '@/lib/types';

// Rendered per request (the API isn't reachable during `next build`); the
// data itself is cached for a few minutes in serverApi.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Actualités d’Afrique, pays par pays — NouvellesDuPays',
  description: 'Les médias et l’actualité de chaque pays africain : journaux, sites d’information, agences, télévisions et radios, région par région.',
  alternates: { canonical: '/africa' },
};

const BAND_DOT: Record<EditorialRankEntry['score_band'], string> = {
  priority: 'bg-emerald-500', high: 'bg-green-500', good: 'bg-yellow-500',
  moderate: 'bg-orange-400', low: 'bg-neutral-600',
};

function FeaturedGrid({ entries }: { entries: EditorialRankEntry[] }) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
      {entries.map((pub) => (
        <li key={pub.id}>
          <Link
            href={`/source/${encodeURIComponent(pub.slug)}`}
            className="flex flex-col gap-1.5 rounded border border-neutral-800 bg-neutral-900/60 hover:border-orange-500/50 px-3 py-2.5 h-full transition-colors group"
          >
            <span className="text-sm font-medium leading-snug group-hover:text-orange-300 line-clamp-2">
              {pub.name}
            </span>
            <span className="text-xs text-neutral-500 flex items-center gap-1 mt-auto">
              {pub.country_flag_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pub.country_flag_url} alt="" width={16} height={11} className="rounded-sm shrink-0" loading="lazy" />
              )}
              <span className="truncate">{pub.country_name}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${BAND_DOT[pub.score_band]}`} />
              <span className="text-xs text-neutral-400">{pub.total_score}<span className="text-neutral-600">/100</span></span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AfricaIndex() {
  const [summary, rankings] = await Promise.all([
    serverApi.africaSummary().catch((e: unknown) => { if (e instanceof ApiUnavailableError) return null; throw e; }),
    serverApi.rankings().catch((e: unknown) => { if (e instanceof ApiUnavailableError) return null; throw e; }),
  ]) as [AfricaSummary | null, RankingsData | null];

  const totals = summary?.regions.flatMap((r) => r.countries).reduce(
    (t, c) => ({ countries: t.countries + 1, publishers: t.publishers + c.publishers, articles: t.articles + c.articles_24h }),
    { countries: 0, publishers: 0, articles: 0 }
  );
  const featured = rankings?.editorial_by_overall?.slice(0, 8) ?? [];

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
          <nav aria-label="Régions et outils" className="mt-4 flex flex-wrap gap-2 text-sm">
            {AFRICA_REGIONS.map((r) => (
              <Link key={r.slug} href={`/africa/${r.slug}`} className="rounded-full border border-neutral-800 px-3 py-1 hover:border-orange-500/60">
                {r.label}
              </Link>
            ))}
            <Link href="/africa/rankings" className="rounded-full border border-orange-900/60 bg-orange-950/30 px-3 py-1 hover:border-orange-500/60 text-orange-400">
              🏆 Classements
            </Link>
          </nav>
          {featured.length > 0 && (
            <section aria-labelledby="featured-title" className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h2 id="featured-title" className="text-base font-semibold">Médias recommandés</h2>
                <Link href="/africa/rankings" className="text-xs text-orange-400 hover:text-orange-300">
                  Classement complet →
                </Link>
              </div>
              <p className="text-xs text-neutral-500 mb-3">Sources éditorialement les mieux notées à travers le continent</p>
              <FeaturedGrid entries={featured} />
            </section>
          )}
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
