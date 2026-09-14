'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { latestNewsHeading } from '@/lib/latestNewsTranslations';
import EditorialLensBadge from './EditorialLensBadge';
import SourceCardGrid from './SourceCardGrid';
import Titrologie from './Titrologie';
import type { Article, Country, Publisher, TitrologieCluster } from '@/lib/types';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'actualites' | 'medias' | 'titrologie'>('actualites');
  const [publishers, setPublishers] = useState<Publisher[] | null>(null);
  const [publishersLoading, setPublishersLoading] = useState(false);
  const [titrologie, setTitrologie] = useState<TitrologieCluster[] | null>(null);
  const [titrologieLoading, setTitrologieLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTab('actualites');
    setPublishers(null);
    setTitrologie(null);
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

            <div className="flex gap-2 mb-4">
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
            </div>

            {tab === 'actualites' && (
              <>
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
          </>
        )}
      </div>
    </aside>
  );
}
