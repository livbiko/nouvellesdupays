'use client';

import { track } from '@/lib/tracking';
import type { YoutubeDirectory } from '@/lib/types';

// CR-2026-11-16-11: /youtube search and filters. A plain GET form, so the filters live in the URL (shareable, kept by
// the tabs and pagination, work without JavaScript); selects submit on change. One existing Search event per submit
// (no new event name), sent as the page navigates - the tracker flushes on pagehide.
type Facets = YoutubeDirectory['facets'];
export type DirectoryParams = { q: string; country: string; continent: string; category: string; type: string; lang: string; sort: string };

export default function DirectoryFilters({ facets, params, total }: { facets: Facets; params: DirectoryParams; total: number }) {
  const byContinent = facets.continents.map((c) => ({
    ...c,
    // Names arrive in French from the page (server side, so server and browser render the same text).
    countries: facets.countries.filter((x) => x.continent === c.key).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  }));
  const topCategories = facets.categories.filter((c) => !c.parent_slug);
  const active = Object.entries(params).some(([k, v]) => k !== 'sort' && v);
  const select = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 focus:border-orange-500 focus:outline-none';

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget);
    const v = (k: string) => String(data.get(k) || '');
    track('Search', {
      search_term: v('q').slice(0, 100), scope: 'youtube_directory',
      country: v('country'), category: v('category'), type: v('type'), lang: v('lang'),
    }, { country_iso: v('country') || null });
  };
  const resubmit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <form action="/youtube#chaines" method="get" role="search" aria-label="Rechercher des chaînes" onSubmit={onSubmit}
      className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="yt-q">Rechercher</label>
        <input id="yt-q" name="q" type="search" defaultValue={params.q} placeholder="Chaîne, créateur, pays…"
          className="w-full flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none" />
        <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500">
          Rechercher
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="sr-only">Pays</span>
          <select name="country" defaultValue={params.country} onChange={resubmit} className={select}>
            <option value="">Tous les pays</option>
            {byContinent.map((c) => (
              <optgroup key={c.key} label={c.label}>
                {c.countries.map((x) => <option key={x.iso} value={x.iso}>{x.name} ({x.count})</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Catégorie</span>
          <select name="category" defaultValue={params.category} onChange={resubmit} className={select}>
            <option value="">Toutes les catégories</option>
            {topCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name_fr} ({c.count})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Type de chaîne</span>
          <select name="type" defaultValue={params.type} onChange={resubmit} className={select}>
            <option value="">Tous les types</option>
            {facets.types.map((t) => <option key={t.key} value={t.key}>{t.label} ({t.count})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Langue</span>
          <select name="lang" defaultValue={params.lang} onChange={resubmit} className={select}>
            <option value="">Toutes les langues</option>
            {facets.languages.map((l) => <option key={l.key} value={l.key}>{l.label} ({l.count})</option>)}
          </select>
        </label>
      </div>
      {params.continent && <input type="hidden" name="continent" value={params.continent} />}
      {params.sort && params.sort !== 'populaires' && <input type="hidden" name="sort" value={params.sort} />}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{total} résultat{total > 1 ? 's' : ''}</span>
        {active && <a href="/youtube#chaines" className="text-orange-400 hover:underline">Réinitialiser les filtres</a>}
        <span>Langue : celle du créateur, ou à défaut les langues officielles du pays de la chaîne.</span>
      </p>
    </form>
  );
}
