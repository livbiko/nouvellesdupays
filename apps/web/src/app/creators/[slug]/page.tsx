import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import { Breadcrumbs, Section, Unavailable } from '@/components/AfricaBits';
import { regionByName } from '@/lib/africa';
import { ApiUnavailableError, serverApi } from '@/lib/serverApi';
import type { CreatorKind, CreatorProfile, CreatorRanking, RankingDimension } from '@/lib/types';

// /creators/<slug>: one approved creator (Build #231) - who they are, where, their channels with the latest publicly
// measured numbers and when they were measured, and what kind of public evidence links the channels to them. The
// API answers 404 for anyone not approved (candidates, rejected, possible minors). Not cached (see serverApi.creator).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

const KIND_LABEL: Record<CreatorKind, string> = { individual: 'Créateur', group: 'Collectif', media_brand: 'Marque média' };
const PLATFORM: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', x: 'X', instagram: 'Instagram' };
const METRIC: Record<string, string> = {
  subscribers: 'abonnés', followers: 'abonnés', total_views: 'vues au total', video_count: 'vidéos',
  avg_recent_views: 'vues moyennes récentes', recent_uploads_30d: 'vidéos en 30 jours', page_likes: 'mentions J’aime',
  total_likes: 'J’aime au total', recent_views: 'vues récentes', recent_posts: 'publications récentes',
};
const SOURCE: Record<string, string> = {
  youtube_data_api: 'API YouTube', meta_graph_api: 'API Meta', tiktok_api: 'API TikTok', creator_connected: 'compte relié par le créateur',
  reviewer: 'relevé par notre équipe',
};
const VERIFICATION: Record<string, string> = { verified: 'Vérifié', linked_from_site: 'Lié depuis le site officiel', unverified: 'Non vérifié' };
const EVIDENCE: Record<string, string> = {
  platform_badge: 'badge de vérification de la plateforme', cross_link: 'liens croisés entre comptes officiels',
  official_website: 'lien depuis le site officiel', creator_confirmed: 'confirmé par le créateur', reviewer: 'vérifié par notre équipe',
};
const DIMENSION: Record<RankingDimension, string> = {
  overall: 'Score global', popularity: 'Popularité', engagement: 'Engagement', content: 'Vues récentes',
  growth: 'Croissance', activity: 'Régularité',
};
const DIMENSION_HELP: Record<RankingDimension, string> = {
  overall: 'moyenne pondérée des dimensions disponibles', popularity: 'abonnés', engagement: 'J’aime et commentaires par vue (vidéos récentes)',
  content: 'vues moyennes des vidéos des 90 derniers jours', growth: 'évolution des abonnés sur 30 jours', activity: 'vidéos publiées en 30 jours',
};
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);
const CONFIDENCE: Record<string, string> = { VERIFIED: 'Profil vérifié', HIGH_CONFIDENCE: 'Profil vérifié (confiance élevée)', PROVISIONAL: 'Profil provisoire' };

async function load(slug: string): Promise<CreatorProfile | 'unavailable' | null> {
  try {
    return await serverApi.creator(slug);
  } catch (err) {
    if (err instanceof ApiUnavailableError) return 'unavailable';
    throw err;
  }
}

function scopeLabel(r: CreatorRanking, c: CreatorProfile): string {
  if (r.scope === 'country') return c.country_name ? `en ${c.country_name}` : 'dans le pays';
  if (r.scope === 'region') return `en ${regionByName(r.scope_key)?.label ?? r.scope_key}`;
  if (r.scope === 'africa') return 'en Afrique';
  if (r.scope === 'category') return `en ${c.categories.find((k) => k.slug === r.scope_key)?.name_fr ?? r.scope_key}`;
  return 'au classement mondial';
}

function place(c: CreatorProfile): string {
  if (c.country_name) return c.country_name;
  const r = c.region ? regionByName(c.region) : null;
  return r ? r.label : c.region || '';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  if (!c || c === 'unavailable') return { title: 'Créateur — NouvellesDuPays' };
  const where = place(c);
  return {
    title: `${c.display_name}${where ? ` (${where})` : ''} : chaînes et audience — NouvellesDuPays`,
    description: c.bio || `${c.display_name}, ${KIND_LABEL[c.creator_kind].toLowerCase()}${where ? ` · ${where}` : ''} : chaînes officielles et audience publique, sur NouvellesDuPays.`,
    alternates: { canonical: `/creators/${c.slug}` },
  };
}

const nf = new Intl.NumberFormat('fr-FR');

export default async function CreatorPage({ params }: Props) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  if (c === 'unavailable') {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Unavailable />
        <SiteFooter />
      </main>
    );
  }
  const where = place(c);
  const avatar = c.accounts.find((a) => a.profile_image_url)?.profile_image_url;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[{ href: '/africa', label: 'Afrique' }, { href: '/creators', label: 'Créateurs' }, { label: c.display_name }]} />

      <header className="mt-4 flex items-start gap-4">
        {avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover bg-neutral-800 shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{c.display_name}</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {[KIND_LABEL[c.creator_kind], where, c.categories.map((k) => k.name_fr).join(', ')].filter(Boolean).join(' · ')}
          </p>
          {CONFIDENCE[c.confidence] && <p className="text-xs text-emerald-400 mt-1">{CONFIDENCE[c.confidence]}</p>}
          {c.bio && <p className="text-neutral-300 mt-3 max-w-2xl">{c.bio}</p>}
        </div>
      </header>

      <Section id="channels" title="Chaînes officielles">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {c.official_website && (
            <li className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs text-neutral-500">Site web</p>
              <a href={c.official_website} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400 break-all">
                {c.official_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </li>
          )}
          {c.accounts.map((a) => (
            <li key={a.url} className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs text-neutral-500">
                {PLATFORM[a.platform] ?? a.platform} · {VERIFICATION[a.verification] ?? a.verification}
                {a.platform_verified ? ' · badge officiel' : ''}
              </p>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400 break-all">
                {a.handle ? `@${a.handle}` : a.display_name || a.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
              {a.audience.length > 0 ? (
                <p className="text-xs text-neutral-400 mt-1">
                  {a.audience.map((m) => `${nf.format(m.value)} ${METRIC[m.metric] ?? m.metric}`).join(' · ')}
                  {' '}<span className="text-neutral-600">
                    ({SOURCE[a.audience[0].source] ?? a.audience[0].source}, relevé le {new Date(a.audience[0].measured_at).toLocaleDateString('fr-FR')})
                  </span>
                </p>
              ) : (
                <p className="text-xs text-neutral-600 mt-1">Audience non disponible</p>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {c.rankings.length > 0 && (() => {
        const global = c.rankings.filter((r) => r.scope === 'global');
        const overall = c.rankings.filter((r) => r.dimension === 'overall');
        const dims: RankingDimension[] = ['popularity', 'content', 'engagement', 'growth', 'activity'];
        return (
          <Section id="ranking" title="Classement YouTube">
            {overall.length > 0 && (
              <ul className="text-sm text-neutral-300 space-y-0.5 mb-4">
                {overall.map((r) => (
                  <li key={`${r.scope}-${r.scope_key}`}>
                    <span className="text-neutral-100 font-medium">{ordinal(r.rank)}</span> sur {r.total} {scopeLabel(r, c)}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(['overall', ...dims] as RankingDimension[]).map((d) => {
                const r = global.find((x) => x.dimension === d);
                return (
                  <div key={d} className="rounded border border-neutral-800 bg-neutral-900/60 p-3" title={DIMENSION_HELP[d]}>
                    <p className="text-[11px] text-neutral-500 mb-1">{DIMENSION[d]}</p>
                    {r ? (
                      <>
                        <p className="text-2xl font-bold tabular-nums">{Math.round(r.score)}</p>
                        <div className="mt-2 h-1 rounded-full bg-neutral-800">
                          <div className="h-1 rounded-full bg-orange-400" style={{ width: `${r.score}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-600">non disponible</p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Scores de 0 à 100 calculés le {new Date(c.rankings[0].computed_at).toLocaleDateString('fr-FR')} à partir des chiffres publics de
              YouTube. Une donnée non disponible n’est pas comptée comme zéro. Ces scores mesurent l’audience et la performance, pas la
              fiabilité de l’information.
            </p>
          </Section>
        );
      })()}

      {c.evidence.length > 0 && (
        <Section id="evidence" title="Comment nous avons vérifié ce profil">
          <p className="text-sm text-neutral-300">
            {c.evidence.map((e) => EVIDENCE[e] ?? e).join(' ; ')}.
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Une erreur ? <Link href="/contact" className="text-orange-400 hover:underline">Contactez-nous</Link>.
          </p>
        </Section>
      )}

      <p className="mt-10 text-sm">
        <Link href={c.country_iso ? `/creators?pays=${c.country_iso}` : '/creators'} className="text-orange-400 hover:underline">
          ← Tous les créateurs{c.country_name ? ` (${c.country_name})` : ''}
        </Link>
      </p>
      <SiteFooter />
    </main>
  );
}
