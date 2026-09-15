'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { latestNewsHeading } from '@/lib/latestNewsTranslations';
import EditorialLensBadge from './EditorialLensBadge';
import FeaturedStrip from './FeaturedStrip';
import SourceCardGrid from './SourceCardGrid';
import Titrologie from './Titrologie';
import VideoCarousel from './VideoCarousel';
import type { Article, Country, Publisher, TitrologieCluster, VideoChannels } from '@/lib/types';

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

type Tab = 'actualites' | 'medias' | 'titrologie' | 'live_now' | 'africa_voices' | 'national_tv';

function formatPopulation(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function CountryPanel({
  iso,
  autoDetected = false,
  onClose,
}: {
  iso: string;
  autoDetected?: boolean;
  onClose: () => void;
}) {
  const [country, setCountry] = useState<Country | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [featured, setFeatured] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('actualites');
  const [publishers, setPublishers] = useState<Publisher[] | null>(null);
  const [publishersLoading, setPublishersLoading] = useState(false);
  const [titrologie, setTitrologie] = useState<TitrologieCluster[] | null>(null);
  const [titrologieLoading, setTitrologieLoading] = useState(false);
  const [videoChannels, setVideoChannels] = useState<VideoChannels | null>(null);
  const [videoChannelsLoading, setVideoChannelsLoading] = useState(false);
  const [africaTopicFilter, setAfricaTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('actualites');
    setPublishers(null);
    setTitrologie(null);
    setFeatured([]);
    setVideoChannels(null);
    setAfricaTopicFilter(null);
    Promise.all([api.country(iso), api.articles(iso, { limit: 20, distinctPublisher: true })])
      .then(([c, a]) => {
        if (cancelled) return;
        setCountry(c);
        setArticles(a);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Separate, non-blocking: the featured strip is decorative, so it never
    // holds up the main panel or turns into a page-level error state.
    api.featured(iso)
      .then((f) => { if (!cancelled) setFeatured(f); })
      .catch(() => { if (!cancelled) setFeatured([]); });
    return () => {
      cancelled = true;
    };
  }, [iso]);

  // Fetched lazily, only once the reader actually opens the Médias tab --
  // most panel opens never need the full source roster.
  function openMediasTab() {
    setTab('medias');
    if (publishers !== null) return;
    setPublishersLoading(true);
    api.publishers(iso)
      .then(setPublishers)
      .catch(() => setPublishers([]))
      .finally(() => setPublishersLoading(false));
  }

  function openTitrologieTab() {
    setTab('titrologie');
    if (titrologie !== null) return;
    setTitrologieLoading(true);
    api.titrologie(iso)
      .then(setTitrologie)
      .catch(() => setTitrologie([]))
      .finally(() => setTitrologieLoading(false));
  }

  // One shared fetch backs all three video tabs (Live Now / Africa Voices /
  // National TV come from a single endpoint) -- opening any of them loads
  // once, the other two reuse the same response.
  function openVideoTab(target: 'live_now' | 'africa_voices' | 'national_tv') {
    setTab(target);
    if (videoChannels !== null) return;
    setVideoChannelsLoading(true);
    api.videoChannels(iso)
      .then(setVideoChannels)
      .catch(() => setVideoChannels({ live_now: [], africa_voices: [], national_tv: [] }))
      .finally(() => setVideoChannelsLoading(false));
  }

  return (
    <aside className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-neutral-900/95 backdrop-blur border-l border-neutral-800 overflow-y-auto z-10">
      <div className="p-5">
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-100 mb-4 text-sm"
        >
          ← Retour au globe
        </button>

        {loading && <p className="text-neutral-400">Chargement…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {country && (
          <>
            {autoDetected && (
              <p className="text-xs text-orange-400/80 mb-3">
                Basé sur votre position · <button onClick={onClose} className="underline hover:text-orange-300">voir le globe</button>
              </p>
            )}
            <div className="flex items-center gap-3 mb-4">
              {country.flag_url && (
                <img src={country.flag_url} alt={country.name} className="w-10 h-auto rounded shadow" />
              )}
              <h1 className="text-2xl font-bold">{country.name}</h1>
            </div>

            <dl className="grid grid-cols-2 gap-y-1 text-sm text-neutral-300 mb-6">
              <dt className="text-neutral-500">Capitale</dt>
              <dd>{country.capital ?? '—'}</dd>
              <dt className="text-neutral-500">Population</dt>
              <dd>{country.population ? formatPopulation(country.population) : '—'}</dd>
              <dt className="text-neutral-500">Langues</dt>
              <dd>{country.languages.join(', ')}</dd>
              <dt className="text-neutral-500">Région</dt>
              <dd>{country.region}</dd>
            </dl>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setTab('actualites')}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'actualites' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                Actualités
              </button>
              <button
                onClick={openMediasTab}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'medias' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                Médias
              </button>
              <button
                onClick={openTitrologieTab}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'titrologie' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                Titrologie
              </button>
              <button
                onClick={() => openVideoTab('live_now')}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'live_now' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                🔴 Live Now
              </button>
              <button
                onClick={() => openVideoTab('africa_voices')}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'africa_voices' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                ▶️ Africa Voices
              </button>
              <button
                onClick={() => openVideoTab('national_tv')}
                className={`text-xs px-3 py-1.5 rounded ${tab === 'national_tv' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                📺 National TV
              </button>
            </div>

            {tab === 'actualites' && (
              <>
                <FeaturedStrip articles={featured} />

                <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
                  {latestNewsHeading(country.languages)}
                </h2>

                {articles.length === 0 && !loading && (
                  <p className="text-neutral-500 text-sm">Aucun article pour le moment.</p>
                )}

                <ul className="space-y-4">
                  {articles.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <p className="font-medium group-hover:text-orange-400 transition-colors">
                          {a.headline}
                        </p>
                      </a>
                      <p className="text-xs text-neutral-500 mt-1">
                        {a.publisher_name}
                        {a.published_at && ` · ${new Date(a.published_at).toLocaleDateString('fr-FR')}`}
                        {a.editorial_tags && a.editorial_tags.length > 0 && a.editorial_confidence && a.editorial_confidence !== 'unknown' && (
                          <EditorialLensBadge publisherId={a.publisher_id} />
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {tab === 'medias' && (
              <>
                <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
                  Médias répertoriés
                </h2>
                {publishersLoading && <p className="text-neutral-500 text-sm">Chargement…</p>}
                {!publishersLoading && publishers && <SourceCardGrid publishers={publishers} />}
              </>
            )}

            {tab === 'titrologie' && (
              <>
                <h2 className="text-lg font-semibold mb-1 border-b border-neutral-800 pb-2">
                  Titrologie
                </h2>
                <p className="text-xs text-neutral-500 mb-3">
                  Comparaison des perspectives éditoriales sur une même actualité, quand elles existent.
                </p>
                <Titrologie clusters={titrologie} loading={titrologieLoading} />
              </>
            )}

            {tab === 'live_now' && (
              <>
                <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
                  🔴 Live Now
                </h2>
                {videoChannelsLoading && <p className="text-neutral-500 text-sm">Chargement…</p>}
                {videoChannels && (
                  <VideoCarousel
                    channels={videoChannels.live_now}
                    emptyText="Aucune chaîne en direct répertoriée pour ce pays."
                  />
                )}
              </>
            )}

            {tab === 'africa_voices' && (
              <>
                <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
                  ▶️ Africa Voices
                </h2>
                {videoChannelsLoading && <p className="text-neutral-500 text-sm">Chargement…</p>}
                {videoChannels && (
                  <>
                    {(() => {
                      const topics = Array.from(new Set(videoChannels.africa_voices.map((c) => c.topic).filter(Boolean))) as string[];
                      return topics.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {topics.map((t) => (
                            <button
                              key={t}
                              onClick={() => setAfricaTopicFilter(africaTopicFilter === t ? null : t)}
                              className={`text-[10px] px-2 py-1 rounded ${
                                africaTopicFilter === t ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                              }`}
                            >
                              {TOPIC_LABELS[t] || t}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <VideoCarousel
                      channels={videoChannels.africa_voices.filter((c) => !africaTopicFilter || c.topic === africaTopicFilter)}
                      emptyText="Aucune chaîne répertoriée pour ce pays."
                    />
                  </>
                )}
              </>
            )}

            {tab === 'national_tv' && (
              <>
                <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
                  📺 National TV
                </h2>
                {videoChannelsLoading && <p className="text-neutral-500 text-sm">Chargement…</p>}
                {videoChannels && (
                  <VideoCarousel
                    channels={videoChannels.national_tv}
                    emptyText="Aucune chaîne nationale répertoriée pour ce pays."
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
