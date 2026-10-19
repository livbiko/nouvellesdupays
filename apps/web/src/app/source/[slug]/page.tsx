import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import EditorialLensBadge from '@/components/EditorialLensBadge';
import { ArticleList, Breadcrumbs, Section, Unavailable } from '@/components/AfricaBits';
import { countrySlug, regionByName } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { SourceAudience, SourceProfile } from '@/lib/types';

// /source/<slug>: one media organisation (migration 016) - website, feeds, official social accounts with
// their verification state, publicly measured audience figures only (never estimates), editorial profile
// and recent articles, each linking out to the original. Rendered per request like /africa.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const PLATFORM: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', x: 'X', instagram: 'Instagram' };
const FEED: Record<string, string> = { rss: 'Flux RSS', atom: 'Flux Atom', 'sitemap-news': 'Sitemap actualités', html: 'Pages du site' };
const METRIC: Record<SourceAudience['metric'], string> = {
  subscribers: 'abonnés', followers: 'abonnés', total_views: 'vues au total', video_count: 'vidéos',
  avg_recent_views: 'vues moyennes récentes', recent_uploads_30d: 'vidéos en 30 jours',
};
const VERIFICATION: Record<string, string> = { verified: 'Vérifié', linked_from_site: 'Lié depuis le site', unverified: 'Non vérifié' };
const STATUS: Record<string, string> = { active: 'En ligne', pending: 'En attente de flux', unavailable: 'Indisponible' };

async function load(slug: string): Promise<SourceProfile | 'unavailable' | null> {
  try {
    return await serverApi.source(slug);
  } catch (err) {
    if (err instanceof ApiUnavailableError) return 'unavailable';
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await load(slug);
  if (!s || s === 'unavailable') return { title: 'Source — NouvellesDuPays' };
  return {
    title: `${s.name} (${s.country_name}) : actualités et chaînes — NouvellesDuPays`,
    description: s.description || `${s.name}, média ${s.country_name} : dernières actualités, site web, flux et chaînes officielles, sur NouvellesDuPays.`,
    alternates: { canonical: `/source/${s.slug}` },
  };
}

const nf = new Intl.NumberFormat('fr-FR');

export default async function SourcePage({ params }: Props) {
  const { slug } = await params;
  const s = await load(slug);
  if (!s) notFound();
  if (s === 'unavailable') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Unavailable />
        <SiteFooter />
      </main>
    );
  }
  const region = s.country_region ? regionByName(s.country_region) : null;
  const crumbs = [
    ...(region ? [{ href: '/africa', label: 'Afrique' }, { href: `/africa/${region.slug}`, label: region.name }] : []),
    ...(region ? [{ href: `/africa/${countrySlug(s.country_name)}`, label: s.country_name }] : [{ label: s.country_name }]),
    { label: s.name },
  ];
  const hasBadge = !!(s.editorial_tags && s.editorial_tags.length > 0 && s.editorial_confidence && s.editorial_confidence !== 'unknown');
  const liveFeeds = s.feeds.filter((f) => f.enabled);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{s.name}</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {s.creator_kind === 'individual' ? 'Créateur indépendant' : (s.source_type && s.source_type !== 'OTHER' ? s.source_type : 'Média')}
            {' · '}{s.country_name}{s.city ? ` (${s.city})` : ''}
            {' · '}{STATUS[s.feed_status] ?? s.feed_status}
          </p>
          {s.description && <p className="text-neutral-300 mt-3 max-w-2xl">{s.description}</p>}
        </div>
        {hasBadge && <EditorialLensBadge publisherId={s.id} />}
      </header>

      <Section id="channels" title="Site et chaînes officielles">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <li className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
            <p className="text-xs text-neutral-500">Site web</p>
            <a href={s.homepage_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400 break-all">
              {s.homepage_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
            {liveFeeds.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {liveFeeds.map((f) => FEED[f.feed_type] ?? f.feed_type).join(', ')}
                {liveFeeds[0].last_success_at && <> · relevé le {new Date(liveFeeds[0].last_success_at).toLocaleDateString('fr-FR')}</>}
              </p>
            )}
          </li>
          {s.social_accounts.map((a) => (
            <li key={a.url} className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs text-neutral-500">
                {PLATFORM[a.platform] ?? a.platform} · {VERIFICATION[a.verification] ?? a.verification}
              </p>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400 break-all">
                {a.handle || a.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
              {a.audience.length > 0 && (
                <p className="text-xs text-neutral-400 mt-1">
                  {a.audience.map((m) => `${nf.format(m.value)} ${METRIC[m.metric]}`).join(' · ')}
                  {' '}<span className="text-neutral-600">(relevé le {new Date(a.audience[0].measured_at).toLocaleDateString('fr-FR')})</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {(s.ownership_type || s.owner) && (
        <Section id="ownership" title="Propriété">
          <p className="text-neutral-300">{[s.ownership_type, s.owner].filter(Boolean).join(' — ')}</p>
          {s.editorial_review_required && <p className="text-xs text-neutral-500 mt-1">Profil éditorial en cours de vérification.</p>}
        </Section>
      )}

      <Section id="latest" title="Dernières actualités">
        {s.articles.length > 0 ? (
          <ArticleList articles={s.articles.map((a) => ({ ...a, publisher_name: s.name }))} />
        ) : (
          <p className="text-neutral-500 text-sm">Aucun article récent.</p>
        )}
      </Section>

      <p className="mt-10 text-sm">
        <Link href={region ? `/africa/${countrySlug(s.country_name)}` : '/'} className="text-orange-400 hover:underline">
          ← Tous les médias {region ? `du pays ${s.country_name}` : ''}
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
