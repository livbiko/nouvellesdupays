import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import SourceCardGrid from '@/components/SourceCardGrid';
import Titrologie from '@/components/Titrologie';
import { ArticleList, Breadcrumbs, CountryCards, Section, Unavailable, type ListArticle } from '@/components/AfricaBits';
import { countrySlug, formatPopulation, regionByName, regionBySlug, type AfricaRegion } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { AfricaCountry, AfricaSummary, Article, Publisher, VideoChannel } from '@/lib/types';

// /africa/<region-slug> or /africa/<country-slug>. Rendered per request (the
// API isn't reachable during `next build`); API data is cached in serverApi.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

type Resolved =
  | { kind: 'region'; region: AfricaRegion; countries: AfricaCountry[] }
  | { kind: 'country'; region: AfricaRegion; country: AfricaCountry; neighbours: AfricaCountry[] }
  | { kind: 'unavailable' }
  | null;

async function resolve(slug: string): Promise<Resolved> {
  let summary: AfricaSummary | null;
  try {
    summary = await serverApi.africaSummary();
  } catch (err) {
    if (err instanceof ApiUnavailableError) return { kind: 'unavailable' };
    throw err;
  }
  if (!summary) return null;
  const region = regionBySlug(slug);
  if (region) {
    return { kind: 'region', region, countries: summary.regions.find((r) => r.region === region.name)?.countries ?? [] };
  }
  for (const r of summary.regions) {
    const country = r.countries.find((c) => countrySlug(c.name) === slug);
    const reg = regionByName(r.region);
    if (country && reg) return { kind: 'country', region: reg, country, neighbours: r.countries.filter((c) => c !== country) };
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r || r.kind === 'unavailable') return { title: 'Afrique — NouvellesDuPays' };
  if (r.kind === 'region') {
    return {
      title: `Actualités ${r.region.of} — NouvellesDuPays`,
      description: `Les dernières informations ${r.region.of} et les médias de ses ${r.countries.length} pays, sur NouvellesDuPays.`,
      alternates: { canonical: `/africa/${r.region.slug}` },
    };
  }
  const c = r.country;
  return {
    title: `${c.name} : actualités et médias — NouvellesDuPays`,
    description: `Actualités du pays ${c.name} : ${c.publishers} médias suivis (journaux, sites d’information, agences, télévisions, radios), mis à jour en continu.`,
    alternates: { canonical: `/africa/${slug}` },
    openGraph: { title: `${c.name} : actualités et médias`, url: `/africa/${slug}`, images: c.flag_url ? [c.flag_url] : undefined },
  };
}

export default async function AfricaSlugPage({ params }: Props) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  return (
    <>
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {r.kind === 'unavailable' && (
            <>
              <Breadcrumbs items={[{ href: '/', label: 'Globe' }, { href: '/africa', label: 'Afrique' }]} />
              <Unavailable />
            </>
          )}
          {r.kind === 'region' && <RegionView region={r.region} countries={r.countries} />}
          {r.kind === 'country' && <CountryView slug={slug} region={r.region} country={r.country} neighbours={r.neighbours} />}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

async function settle<T>(p: Promise<T | null>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof ApiUnavailableError) return null;
    throw err;
  }
}

async function RegionView({ region, countries }: { region: AfricaRegion; countries: AfricaCountry[] }) {
  const articles = (await settle(serverApi.regionArticles(region.name, 24))) ?? [];
  const now = Date.now();
  const active = countries.filter((c) => c.publishers > 0);
  return (
    <>
      <Breadcrumbs items={[{ href: '/', label: 'Globe' }, { href: '/africa', label: 'Afrique' }, { label: region.label }]} />
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">Actualités <span className="text-orange-500">{region.of}</span></h1>
      <p className="text-neutral-400 text-sm mt-2">
        {countries.length} pays · {active.reduce((n, c) => n + c.publishers, 0)} médias suivis · {countries.reduce((n, c) => n + c.articles_24h, 0)} articles ces dernières 24 heures
      </p>
      {articles.length > 0 && (
        <Section id="latest" title="Dernières actualités">
          <ArticleList articles={articles} showCountry now={now} />
        </Section>
      )}
      <Section id="countries" title="Pays">
        <CountryCards countries={countries} />
      </Section>
    </>
  );
}

// Article categories (packages/shared/src/categories.js) shown as their own
// sections when the country has recent articles in them.
const CATEGORY_SECTIONS: [string, string][] = [
  ['politics', 'Politique'],
  ['business', 'Économie'],
  ['sports', 'Sport'],
  ['technology', 'Technologie'],
  ['health', 'Santé'],
  ['entertainment', 'Culture et divertissement'],
];

// Publisher groups by source_type, in display order.
const MEDIA_GROUPS: [string, string[]][] = [
  ['Presse et sites d’information', ['NEWSPAPER', 'ONLINE_NEWS', 'MAGAZINE', 'INVESTIGATIVE', 'BLOG', 'JOURNALIST', 'SOCIAL_NEWS', 'YOUTUBE_NEWS', 'PODCAST', 'OTHER']],
  ['Agences de presse et médias publics', ['NEWS_AGENCY', 'GOVERNMENT']],
  ['Télévision', ['TV']],
  ['Radio', ['RADIO']],
  ['Économie, sport et technologie', ['FINANCIAL', 'SPORTS', 'TECHNOLOGY']],
];

const dedupe = (list: Article[], seen: Set<number>): Article[] => list.filter((a) => !seen.has(a.id) && (seen.add(a.id), true));

async function CountryView({ slug, region, country, neighbours }: { slug: string; region: AfricaRegion; country: AfricaCountry; neighbours: AfricaCountry[] }) {
  const iso = country.iso_code;
  const [details, featured, latest, publishers, channels, titrologie, ...byCategory] = await Promise.all([
    settle(serverApi.country(iso)),
    settle(serverApi.featured(iso)),
    settle(serverApi.countryArticles(iso, 'limit=15&distinct_publisher=1')),
    settle(serverApi.publishers(iso)),
    settle(serverApi.videoChannels(iso)),
    settle(serverApi.titrologie(iso)),
    ...CATEGORY_SECTIONS.map(([cat]) => settle(serverApi.countryArticles(iso, `category=${cat}&limit=6&distinct_publisher=1`))),
  ]);
  const now = Date.now();
  const seen = new Set<number>();
  const featuredList = dedupe(featured ?? [], seen);
  const latestList = dedupe(latest ?? [], seen);
  const categoryLists = CATEGORY_SECTIONS.map(([cat, label], i) => ({ cat, label, articles: dedupe(byCategory[i] ?? [], seen).slice(0, 5) }))
    .filter((s) => s.articles.length > 0);
  const livePublishers = (publishers ?? []).filter((p: Publisher) => p.feed_status === 'active');
  const groups = MEDIA_GROUPS.map(([label, types]) => ({
    label,
    publishers: livePublishers.filter((p) => types.includes(p.source_type ?? 'OTHER')),
  })).filter((g) => g.publishers.length > 0);
  const tv = channels?.national_tv ?? [];
  const voices = channels?.local_voices ?? [];
  const pop = formatPopulation(details?.population ?? country.population);
  const languages = details?.languages?.join(', ');

  return (
    <>
      <Breadcrumbs items={[{ href: '/', label: 'Globe' }, { href: '/africa', label: 'Afrique' }, { href: `/africa/${region.slug}`, label: region.label }, { label: country.name }]} />
      <header className="mt-4 flex items-center gap-4">
        {country.flag_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={country.flag_url} alt={`Drapeau : ${country.name}`} width={64} height={43} className="rounded shrink-0" />
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{country.name}</h1>
          <p className="text-neutral-400 text-sm mt-1">
            {[details?.capital ?? country.capital, pop && `${pop} habitants`, languages].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>
      <p className="text-sm text-neutral-400 mt-3">
        {country.publishers} médias suivis · {country.articles_24h} articles ces dernières 24 heures ·{' '}
        <Link href={`/?country=${iso}`} className="text-orange-400 hover:text-orange-300">Voir sur le globe</Link>
      </p>

      {featuredList.length > 0 && (
        <Section id="featured" title="À la une">
          <ArticleList articles={featuredList as ListArticle[]} now={now} />
        </Section>
      )}
      {latestList.length > 0 && (
        <Section id="latest" title="Dernières actualités">
          <ArticleList articles={latestList as ListArticle[]} now={now} />
        </Section>
      )}
      {featuredList.length === 0 && latestList.length === 0 && (
        <p className="mt-8 text-neutral-400 text-sm">Pas encore d’articles récents pour ce pays. Nos sources sont mises à jour en continu.</p>
      )}
      {categoryLists.map((s) => (
        <Section key={s.cat} id={`cat-${s.cat}`} title={s.label}>
          <ArticleList articles={s.articles as ListArticle[]} now={now} />
        </Section>
      ))}
      {titrologie && titrologie.length > 0 && (
        <Section id="titrologie" title="Titrologie : un même sujet, plusieurs regards">
          <Titrologie clusters={titrologie} loading={false} />
        </Section>
      )}
      {(tv.length > 0 || voices.length > 0) && (
        <Section id="video" title="Télévision et chaînes vidéo">
          {tv.length > 0 && <ChannelList title="Télévision nationale" channels={tv} />}
          {voices.length > 0 && <ChannelList title="Voix locales" channels={voices} />}
        </Section>
      )}
      {groups.length > 0 && (
        <Section id="media" title="Les médias du pays">
          {groups.map((g) => (
            <div key={g.label} className="mb-6">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">{g.label} ({g.publishers.length})</h3>
              <SourceCardGrid publishers={g.publishers} iso={iso} />
            </div>
          ))}
        </Section>
      )}
      {neighbours.length > 0 && (
        <Section id="neighbours" title={`Autres pays ${region.of}`}>
          <CountryCards countries={neighbours} />
        </Section>
      )}
      <p className="mt-10 text-xs text-neutral-500">
        Vous publiez de l’information sur ce pays ? <Link href="/register-publisher" className="underline">Inscrivez votre média</Link>.
      </p>
    </>
  );
}

function ChannelList({ title, channels }: { title: string; channels: VideoChannel[] }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-2">{title}</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {channels.map((ch) => (
          <li key={ch.id} className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2">
            <a href={ch.page_url || ch.channel_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400">{ch.name}</a>
            {ch.description && <p className="text-xs text-neutral-500">{ch.description}</p>}
            {ch.latest_video?.url && ch.latest_video.title && (
              <p className="text-xs mt-1">
                Dernière vidéo : <a href={ch.latest_video.url} target="_blank" rel="noopener noreferrer" className="text-neutral-300 hover:text-orange-400">{ch.latest_video.title}</a>
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
