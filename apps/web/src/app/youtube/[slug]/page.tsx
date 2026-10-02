import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeadForm from '@/components/LeadForm';
import LitePlayer from '@/components/LitePlayer';
import SafeImg from '@/components/SafeImg';
import SiteFooter from '@/components/SiteFooter';
import { LandingCtas, ShareButtons } from '@/components/LandingActions';
import { TrackView, TrackedLink } from '@/components/Tracked';
import { ApiUnavailableError, SITE_URL, serverApi } from '@/lib/serverApi';
import type { LandingPayload } from '@/lib/types';

// Auto-generated landing page for every APPROVED YouTube video submission
// (/youtube/<slug>, slug editable by admins so campaigns can use clean URLs
// such as /youtube/video-01). Built for paid Facebook/Meta traffic:
// server-rendered, a single hero image as LCP (the YouTube player only
// loads on click), mobile-first, one clear headline, two CTAs, minimal
// navigation, and content that matches the video the ad shows.

type Props = { params: Promise<{ slug: string }> };

const CATEGORY_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Économie', technology: 'Technologie', sports: 'Sport',
  health: 'Santé', entertainment: 'Divertissement', culture: 'Culture', education: 'Éducation',
  documentary: 'Documentaire', interview: 'Interview', other: 'Vidéo',
};

async function load(slug: string): Promise<LandingPayload | null | 'unavailable'> {
  try {
    return await serverApi.landing(slug);
  } catch (err) {
    if (err instanceof ApiUnavailableError) return 'unavailable';
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data || data === 'unavailable') return { title: 'Vidéo — NouvellesDuPays', robots: { index: false } };
  const v = data.video;
  const title = v.landing_headline || v.title;
  const description = (v.description || data.cta_text).replace(/\s+/g, ' ').slice(0, 160);
  const url = `${SITE_URL}/youtube/${v.slug}`;
  return {
    title: `${title} — NouvellesDuPays`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'video.other',
      siteName: 'NouvellesDuPays',
      images: [{ url: v.thumbnail_url, width: 1280, height: 720, alt: v.title }],
      videos: [{ url: `https://www.youtube.com/watch?v=${v.youtube_video_id}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [v.thumbnail_url] },
  };
}

function formatPopulation(n: number | null) {
  return n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '—';
}

export default async function YoutubeLandingPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);

  if (data === 'unavailable') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold">Cette page est momentanément indisponible.</p>
          <p className="text-neutral-400 text-sm mt-2">Merci de réessayer dans quelques instants.</p>
          <Link href="/" className="inline-block mt-4 text-orange-400 underline">Retour à l’accueil</Link>
        </div>
      </main>
    );
  }
  if (!data) notFound();

  const { video: v, country, publisher, related_videos: relatedVideos, related_news: news, cta_text: ctaText } = data;
  const ctx = { video_id: v.id, country_iso: v.country_iso };
  const headline = v.landing_headline || v.title;
  const pageUrl = `${SITE_URL}/youtube/${v.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: (v.description || ctaText).slice(0, 500),
    thumbnailUrl: [v.thumbnail_url],
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtube_video_id}`,
    contentUrl: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
    ...(v.published_at ? { uploadDate: v.published_at } : {}),
    ...(v.channel_name ? { author: { '@type': 'Organization', name: v.channel_name, url: v.channel_url || undefined } } : {}),
  };

  return (
    <>
      <TrackView name="YouTubeLandingPageView" props={{ slug: v.slug, category: v.category }} ctx={ctx} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className="px-4 py-3 border-b border-neutral-900">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold tracking-tight">
            Nouvelles<span className="text-orange-500">Du</span>Pays
          </Link>
          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" /> Vidéo vérifiée
          </span>
        </div>
      </header>

      <main className="px-4 pb-6">
        <article className="max-w-3xl mx-auto pt-5">
          <p className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            {v.country_flag_url && <SafeImg src={v.country_flag_url} alt="" width={20} height={14} className="rounded-sm" />}
            {v.country_name && <span>{v.country_name}</span>}
            {v.category && <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">{CATEGORY_LABELS[v.category] || v.category}</span>}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">{headline}</h1>
          {v.channel_name && (
            <p className="text-sm text-neutral-400 mt-2">
              Par{' '}
              {v.channel_url ? (
                <TrackedLink href={v.channel_url} external event="YouTubeClick" props={{ target: 'channel' }} ctx={ctx} className="text-neutral-200 hover:underline">
                  {v.channel_name}
                </TrackedLink>
              ) : (
                <span className="text-neutral-200">{v.channel_name}</span>
              )}{' '}
              sur YouTube
              {v.published_at && ` · ${new Date(v.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          )}

          <div className="mt-4">
            <LitePlayer youtubeId={v.youtube_video_id} videoId={v.id} title={v.title} thumbnail={v.thumbnail_url} countryIso={v.country_iso} />
          </div>

          <div className="mt-4">
            <LandingCtas youtubeId={v.youtube_video_id} ctx={ctx} />
          </div>

          {v.description && (
            <details className="mt-5 group">
              <summary className="cursor-pointer list-none text-sm text-neutral-300 leading-relaxed">
                <span className="line-clamp-3 group-open:line-clamp-none whitespace-pre-line">{v.description}</span>
                <span className="text-orange-400 text-xs group-open:hidden">Lire la suite</span>
              </summary>
            </details>
          )}

          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-neutral-300">
            <li className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">✓ Vidéo originale publiée sur YouTube{v.channel_name ? ` par ${v.channel_name}` : ''}</li>
            <li className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">✓ Examinée et approuvée par l’équipe NouvellesDuPays</li>
            <li className="rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2">✓ Inscription gratuite, désinscription en un clic</li>
          </ul>

          <section id="inscription" className="mt-8 scroll-mt-4 rounded-xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-transparent p-5">
            <h2 className="text-lg font-semibold">{ctaText}</h2>
            <p className="text-sm text-neutral-400 mt-1 mb-4">
              Les actualités de 190 pays, des médias locaux et des voix indépendantes — sur un seul globe.
            </p>
            <LeadForm defaultCountry={v.country_iso} videoSlug={v.slug} formId="youtube-landing" compact />
          </section>

          {relatedVideos.length > 0 && (
            <section className="mt-10" aria-labelledby="related-videos">
              <h2 id="related-videos" className="text-lg font-semibold mb-3">Autres vidéos</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedVideos.map((r) => (
                  <li key={r.id}>
                    <TrackedLink href={`/youtube/${r.slug}`} event="RelatedVideoClick" props={{ to_slug: r.slug }} ctx={ctx} className="group flex gap-3 rounded-lg hover:bg-neutral-900 p-1.5">
                      <SafeImg src={r.thumbnail_url} alt="" width={160} height={90} loading="lazy" className="w-32 aspect-video object-cover rounded-md shrink-0 bg-neutral-800"
                        fallback={<span className="w-32 aspect-video rounded-md shrink-0 bg-gradient-to-br from-orange-900 to-neutral-900" aria-hidden="true" />} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-snug line-clamp-2 group-hover:text-orange-400">{r.landing_headline || r.title}</span>
                        <span className="block text-xs text-neutral-500 mt-1 truncate">{[r.channel_name, r.country_name].filter(Boolean).join(' · ')}</span>
                      </span>
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {news.length > 0 && (
            <section className="mt-10" aria-labelledby="related-news">
              <h2 id="related-news" className="text-lg font-semibold mb-3">Dernières actualités{country ? ` — ${country.name}` : ''}</h2>
              <ul className="space-y-3">
                {news.map((a) => (
                  <li key={a.id}>
                    <TrackedLink href={a.original_url} external event="NewsArticleClick" props={{ from: 'youtube_landing' }} ctx={{ ...ctx, publisher_id: a.publisher_id, article_id: a.id }} className="group block">
                      <span className="block text-sm font-medium group-hover:text-orange-400">{a.headline}</span>
                      <span className="block text-xs text-neutral-500 mt-0.5">
                        {a.publisher_name}
                        {a.published_at && ` · ${new Date(a.published_at).toLocaleDateString('fr-FR')}`}
                      </span>
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {country && (
              <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4" aria-labelledby="country-info">
                <h2 id="country-info" className="font-semibold flex items-center gap-2">
                  {country.flag_url && <SafeImg src={country.flag_url} alt="" width={24} height={16} className="rounded-sm" />}
                  {country.name}
                </h2>
                <dl className="grid grid-cols-2 gap-y-1 text-sm text-neutral-300 mt-2">
                  <dt className="text-neutral-500">Capitale</dt><dd>{country.capital ?? '—'}</dd>
                  <dt className="text-neutral-500">Population</dt><dd>{formatPopulation(country.population)}</dd>
                  <dt className="text-neutral-500">Langues</dt><dd>{country.languages.join(', ') || '—'}</dd>
                  <dt className="text-neutral-500">Région</dt><dd>{country.region}</dd>
                </dl>
                <TrackedLink href={`/?country=${country.iso_code}`} event="CountrySelected" props={{ from: 'youtube_landing' }} ctx={{ ...ctx, country_iso: country.iso_code }} className="inline-block mt-3 text-sm text-orange-400 hover:underline">
                  Explorer {country.name} sur le globe →
                </TrackedLink>
              </section>
            )}
            {publisher && (
              <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4" aria-labelledby="publisher-info">
                <h2 id="publisher-info" className="font-semibold">Le média</h2>
                <p className="text-sm text-neutral-300 mt-2">{publisher.name}</p>
                <TrackedLink href={publisher.homepage_url} external event="ExternalPublisherClick" props={{ from: 'youtube_landing' }} ctx={{ ...ctx, publisher_id: publisher.id }} className="inline-block mt-3 text-sm text-orange-400 hover:underline">
                  Visiter le site →
                </TrackedLink>
              </section>
            )}
          </div>

          <section className="mt-8" aria-labelledby="share">
            <h2 id="share" className="text-sm font-semibold mb-2 text-neutral-300">Partager cette vidéo</h2>
            <ShareButtons url={pageUrl} title={headline} ctx={ctx} />
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
