'use client';

import { useState } from 'react';
import { countryName, intlLocale, translator, type Locale } from '@/i18n';
import type { FacebookVideo } from '@/lib/types';

// CR-2026-11-27-01: one /facebook video. Until the visitor clicks "Lire", only our own thumbnail (uploaded by the admin,
// served by our API) or a neutral tile is shown: the visitor's browser contacts no Facebook address. The click loads
// Facebook's official player (facebook.com/plugins/video.php) in place. "Voir sur Facebook" is always there.

// The thumbnail is a path on our API (same host in production, another port locally).
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const thumb = (src: string) => (src.startsWith('/api/') ? `${API_URL}${src}` : src);

function ago(rtf: Intl.RelativeTimeFormat, iso: string, now: number): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 60) return rtf.format(Math.round(s / 86400), 'day');
  return rtf.format(Math.round(s / (86400 * 30)), 'month');
}

export default function FacebookVideoCard({ v, locale = 'fr', now, typeLabel = null, categoryLabel = null, className = '' }: {
  v: FacebookVideo; locale?: Locale; now: number; typeLabel?: string | null; categoryLabel?: string | null; className?: string;
}) {
  const { t } = translator(locale);
  const [playing, setPlaying] = useState(false);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const fullDate = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <li className={`min-w-0 ${className}`}>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-800">
        {playing ? (
          <iframe src={`${v.player_url}&autoplay=true`} title={v.title} className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 block h-full w-full"
            aria-label={t('facebook.playTitle', { title: v.title })}>
            {v.thumbnail_url
              ? <img src={thumb(v.thumbnail_url)} alt="" width={320} height={180} loading="lazy" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
              : <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 px-4 text-center text-xs text-neutral-500">{v.page_name}</span>}
            <span className="absolute bottom-2 start-2 rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white group-hover:bg-orange-600">
              ▶ {t('facebook.play')}
            </span>
          </button>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-neutral-100">{v.title}</p>
      <p className="mt-1 truncate text-xs text-neutral-400">
        {v.page_url ? <a href={v.page_url} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-200">{v.page_name}</a> : v.page_name}
        {v.country_iso && <> · {countryName(locale, v.country_iso, v.country_name)}</>}
      </p>
      {(typeLabel || categoryLabel) && (
        <p className="truncate text-xs text-neutral-500">{[typeLabel, categoryLabel].filter(Boolean).join(' · ')}</p>
      )}
      <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <time dateTime={v.published_at} title={t('videos.publishedOn', { date: fullDate.format(new Date(v.published_at)) })}>
          {ago(rtf, v.published_at, now)}
        </time>
        <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-orange-400 hover:underline">{t('facebook.open')}</a>
      </p>
    </li>
  );
}
