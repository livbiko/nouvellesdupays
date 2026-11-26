'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import TrackedChannelLink from './TrackedChannelLink';
import { categoryName, countryName, intlLocale, translator, type Locale } from '@/i18n';
import type { LatestVideo } from '@/lib/types';

// CR-2026-11-25-04: "Voix indépendantes africaines" - the newest stored uploads of African independent voices, local
// voices and online media (GET /api/youtube/latest-videos, filled once a day from the official YouTube API). Latest
// first, at most 2 per channel (API), never invented: when nothing was published in the last 30 days the banner says
// so. The page renders the first list on the server; while the page stays open it re-reads the API every refreshMs.
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const AUTO_ADVANCE_MS = 8000;

export default function IndependentVoicesBanner({ initial, updatedAt, query, refreshMs = 15 * 60 * 1000, locale = 'fr' }: {
  initial: LatestVideo[]; updatedAt: string | null; query: string; refreshMs?: number; locale?: Locale;
}) {
  const { t } = translator(locale); // CR-2026-11-25-06
  const day = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const stamp = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const [items, setItems] = useState(initial);
  const [updated, setUpdated] = useState(updatedAt);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false); // pointer or keyboard focus inside: no auto-advance
  const [reduced, setReduced] = useState(true); // until the browser says otherwise, no motion
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  // Re-read the API while the page is open; a failed read keeps what is shown.
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`${API_URL}/api/youtube/latest-videos${query}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body: { items: LatestVideo[]; updated_at?: string | null } = await res.json();
        const seen = new Set<string>();
        setItems(body.items.filter((v) => !seen.has(v.youtube_video_id) && seen.add(v.youtube_video_id)));
        setUpdated(body.updated_at ?? null);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [query, refreshMs]);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    // Right-to-left (Arabic): "next" moves left and scrollLeft counts down from 0, so work with the distance from
    // the start and flip the direction.
    const rtl = getComputedStyle(el).direction === 'rtl';
    const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 8;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: reduced ? 'auto' : 'smooth' });
    else el.scrollBy({ left: (rtl ? -dir : dir) * el.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  }, [reduced]);

  useEffect(() => {
    if (reduced || paused || hold || items.length < 2) return;
    const id = window.setInterval(() => scroll(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [reduced, paused, hold, items.length, scroll]);

  const control = 'rounded-full border border-neutral-700 px-2.5 py-1 text-sm text-neutral-300 hover:border-orange-500 hover:text-white disabled:opacity-40';
  return (
    <section aria-labelledby="voix-titre" aria-roledescription={t('banner.carousel')}
      className="mt-6 rounded-2xl border border-orange-900/60 bg-gradient-to-br from-orange-950/40 to-neutral-900 p-4 sm:p-5"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false); }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="voix-titre" className="text-sm font-bold uppercase tracking-wider text-orange-400">{t('banner.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-300">
            {t('banner.subtitle')}
          </p>
        </div>
        {items.length > 1 && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" className={control} onClick={() => scroll(-1)} aria-label={t('banner.previous')}><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span></button>
            {!reduced && (
              <button type="button" className={control} onClick={() => setPaused((p) => !p)} aria-pressed={paused}
                aria-label={paused ? t('banner.resume') : t('banner.pause')}>
                {paused ? '▶' : '❚❚'}
              </button>
            )}
            <button type="button" className={control} onClick={() => scroll(1)} aria-label={t('banner.next')}><span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></button>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <ul ref={list} aria-live={paused || reduced ? 'polite' : 'off'}
          className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {items.map((v) => (
            <li key={v.youtube_video_id} className="w-[260px] flex-shrink-0 snap-start sm:w-[280px]">
              <TrackedChannelLink href={v.url} channel={v.channel_name} countryIso={v.country_iso} from="youtube_voix_independantes"
                className="group block">
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="" width={320} height={180} loading="lazy"
                      className="aspect-video w-full rounded-lg bg-neutral-800 object-cover transition-opacity group-hover:opacity-90" />
                  : <span aria-hidden="true" className="block aspect-video w-full rounded-lg bg-neutral-800" />}
                <span className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-neutral-100 group-hover:text-orange-400">{v.title}</span>
              </TrackedChannelLink>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
                {v.flag_url && <img src={v.flag_url} alt="" width={16} height={12} className="h-3 w-4 flex-shrink-0 rounded-[2px] object-cover" />}
                <span className="truncate">
                  {v.profile_path ? <Link href={v.profile_path} className="hover:text-neutral-200">{v.channel_name}</Link> : v.channel_name}
                  {v.country_iso && <> · {countryName(locale, v.country_iso, v.country_name)}</>}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">
                <time dateTime={v.published_at}>{day.format(new Date(v.published_at))}</time>
                {v.category_name && <> · {categoryName(locale, { name_fr: v.category_name, name_en: v.category_name_en, names: v.category_names })}</>}
              </span>
              <span className="mt-2 flex gap-3 text-xs">
                <TrackedChannelLink href={v.url} channel={v.channel_name} countryIso={v.country_iso} from="youtube_voix_independantes"
                  className="font-semibold text-orange-400 hover:underline">
                  {t('banner.watch')}
                </TrackedChannelLink>
                {v.channel_url && (
                  <TrackedChannelLink href={v.channel_url} channel={v.channel_name} countryIso={v.country_iso} from="youtube_voix_independantes_chaine"
                    className="text-neutral-400 hover:text-neutral-200 hover:underline">
                    {t('banner.channel')}
                  </TrackedChannelLink>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-700 p-4 text-sm text-neutral-400">
          {t('banner.empty')}{' '}
          <a href="#independants" className="text-orange-400 hover:underline">{t('banner.seeIndependents')}</a>
        </p>
      )}

      <p className="mt-2 text-[11px] text-neutral-500">
        {updated ? <>{t('banner.updated', { date: stamp.format(new Date(updated)) })} · </> : null}
        {t('banner.source')}
        {failed && <span className="text-amber-400"> · {t('banner.refreshFailed')}</span>}
      </p>
    </section>
  );
}
