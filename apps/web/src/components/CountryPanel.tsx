'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Article, Country } from '@/lib/types';

function formatPopulation(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function CountryPanel({
  iso,
  onClose,
}: {
  iso: string;
  onClose: () => void;
}) {
  const [country, setCountry] = useState<Country | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.country(iso), api.articles(iso, { limit: 20 })])
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

            <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
              Dernières actualités
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
                    <p className="text-xs text-neutral-500 mt-1">
                      {a.publisher_name}
                      {a.published_at && ` · ${new Date(a.published_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}
