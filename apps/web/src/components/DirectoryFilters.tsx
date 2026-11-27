'use client';

import { track } from '@/lib/tracking';
import { categoryName, intlLocale, translator, type Locale } from '@/i18n';
import type { YoutubeDirectory } from '@/lib/types';

// CR-2026-11-16-11: /youtube search and filters. A plain GET form, so the filters live in the URL (shareable, kept by
// the tabs and pagination, work without JavaScript); selects submit on change. One existing Search event per submit
// (no new event name), sent as the page navigates - the tracker flushes on pagehide.
type Facets = YoutubeDirectory['facets'];
// CR-2026-11-18-03: only the fields read here, so a page can send this client component a trimmed copy (the full
// facets also fit).
export type FilterFacets = {
  continents: Pick<Facets['continents'][number], 'key' | 'label'>[];
  countries: Pick<Facets['countries'][number], 'iso' | 'name' | 'continent' | 'count'>[];
  categories: Pick<Facets['categories'][number], 'slug' | 'name_fr' | 'name_en' | 'names' | 'parent_slug' | 'count'>[];
  types: Facets['types'];
  languages: Facets['languages'];
};
export type DirectoryParams = { q: string; country: string; continent: string; category: string; type: string; lang: string; sort: string };

// CR-2026-11-17-03: on a nested page (/youtube/<place>[/<category>...]) the form submits to that page and the place
// and category selects are hidden (the URL fixes them).
// CR-2026-11-25-06: labels in the interface language (country names arrive translated from the page).
// CR-2026-11-27-01: textKeys lets /facebook use its own placeholder and language note.
export default function DirectoryFilters({ facets, params, total, action = '/youtube#chaines', fixedPlace = false, fixedCategory = false, locale = 'fr', textKeys = {} }: {
  facets: FilterFacets; params: DirectoryParams; total: number; action?: string; fixedPlace?: boolean; fixedCategory?: boolean; locale?: Locale;
  textKeys?: { placeholder?: string; languageNote?: string };
}) {
  const { t, tn } = translator(locale);
  const byContinent = facets.continents.map((c) => ({
    ...c,
    // Names arrive translated from the page (server side, so server and browser render the same text).
    countries: facets.countries.filter((x) => x.continent === c.key).sort((a, b) => a.name.localeCompare(b.name, intlLocale(locale))),
  }));
  // Main categories with their subcategories in use (CR-2026-11-17-02: a filter on any level; a main category matches
  // its subcategories).
  const topCategories = facets.categories.filter((c) => !c.parent_slug)
    .map((c) => ({ ...c, subs: facets.categories.filter((s) => s.parent_slug === c.slug) }));
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
    <form action={action} method="get" role="search" aria-label={t('filters.formLabel')} onSubmit={onSubmit}
      className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="yt-q">{t('filters.search')}</label>
        <input id="yt-q" name="q" type="search" defaultValue={params.q} placeholder={t(textKeys.placeholder ?? 'filters.placeholder')}
          className="w-full flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none" />
        <button type="submit" className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-500">
          {t('filters.search')}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {!fixedPlace && <label className="block">
          <span className="sr-only">{t('filters.country')}</span>
          <select name="country" defaultValue={params.country} onChange={resubmit} className={select}>
            <option value="">{t('filters.allCountries')}</option>
            {byContinent.map((c) => (
              <optgroup key={c.key} label={t(`continent.${c.key}`)}>
                {c.countries.map((x) => <option key={x.iso} value={x.iso}>{x.name} ({x.count})</option>)}
              </optgroup>
            ))}
          </select>
        </label>}
        {!fixedCategory && <label className="block">
          <span className="sr-only">{t('filters.category')}</span>
          <select name="category" defaultValue={params.category} onChange={resubmit} className={select}>
            <option value="">{t('filters.allCategories')}</option>
            {topCategories.map((c) => (c.subs.length ? (
              <optgroup key={c.slug} label={categoryName(locale, c)}>
                <option value={c.slug}>{t('filters.categoryAll', { name: categoryName(locale, c), n: c.count })}</option>
                {c.subs.map((s) => <option key={s.slug} value={s.slug}>{categoryName(locale, s)} ({s.count})</option>)}
              </optgroup>
            ) : <option key={c.slug} value={c.slug}>{categoryName(locale, c)} ({c.count})</option>))}
          </select>
        </label>}
        <label className="block">
          <span className="sr-only">{t('filters.type')}</span>
          <select name="type" defaultValue={params.type} onChange={resubmit} className={select}>
            <option value="">{t('filters.allTypes')}</option>
            {facets.types.map((x) => <option key={x.key} value={x.key}>{t(`type.${x.key}`)} ({x.count})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">{t('filters.language')}</span>
          <select name="lang" defaultValue={params.lang} onChange={resubmit} className={select}>
            <option value="">{t('filters.allLanguages')}</option>
            {facets.languages.map((l) => <option key={l.key} value={l.key}>{t(`language.${l.key}`)} ({l.count})</option>)}
          </select>
        </label>
      </div>
      {params.continent && !fixedPlace && <input type="hidden" name="continent" value={params.continent} />}
      {params.sort && params.sort !== 'populaires' && <input type="hidden" name="sort" value={params.sort} />}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{tn('filters.results', total)}</span>
        {active && <a href={action} className="text-orange-400 hover:underline">{t('filters.reset')}</a>}
        <span>{t(textKeys.languageNote ?? 'filters.languageNote')}</span>
      </p>
    </form>
  );
}
