import Link from 'next/link';
import SafeImg from './SafeImg';
import TrackedChannelLink from './TrackedChannelLink';
import { countryName, intlLocale, translator, type Locale } from '@/i18n';
import type { DirectoryEntry } from '@/lib/types';

// CR-2026-11-16-11: one card for a video channel or an approved creator on /youtube. Only known numbers are shown;
// the score is a YouTube performance score, labelled as such (not an accuracy rating).
// CR-2026-11-25-06: text, numbers and dates in the interface language.
export default function DirectoryCard({ e, typeLabel, categoryLabel, from = 'youtube_directory', locale = 'fr' }: {
  e: DirectoryEntry; typeLabel: string | null; categoryLabel: string | null; from?: string; locale?: Locale;
}) {
  const { t } = translator(locale);
  const compact = new Intl.NumberFormat(intlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 });
  const shortDate = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const longDate = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const initial = (
    <span aria-hidden="true" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg font-bold text-neutral-300">
      {e.name.charAt(0).toUpperCase()}
    </span>
  );
  const stats = [
    e.subscribers != null ? t('card.subscribers', { n: compact.format(e.subscribers) }) : null,
    e.total_views != null ? t('card.views', { n: compact.format(e.total_views) }) : null,
  ].filter(Boolean);
  // CR-2026-11-18-02: the numbers come from a daily measurement; show when it was taken.
  const at = stats.length && e.stats_measured_at ? new Date(e.stats_measured_at) : null;
  const measured = at && !Number.isNaN(at.getTime()) ? at : null;
  if (measured) stats.push(t('card.asOf', { date: shortDate.format(measured) }));
  const statsTitle = measured ? t('card.statsAsOf', { date: longDate.format(measured) }) : undefined;
  const youtube = e.url && /youtube\.com|youtu\.be/.test(e.url);

  return (
    <li className="flex h-full flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600">
      <div className="flex items-start gap-3">
        {e.avatar_url
          ? <SafeImg src={e.avatar_url} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 flex-shrink-0 rounded-full bg-neutral-800 object-cover" fallback={initial} />
          : initial}
        <div className="min-w-0 flex-1">
          {e.profile_path
            ? <Link href={e.profile_path} className="block truncate text-sm font-semibold leading-tight hover:text-orange-400">{e.name}</Link>
            : <span className="block truncate text-sm font-semibold leading-tight">{e.name}</span>}
          <span className="mt-0.5 block truncate text-xs text-neutral-400">
            {e.flag_url && <img src={e.flag_url} alt="" width={14} height={10} loading="lazy" className="me-1 inline align-baseline" />}
            {e.country_iso ? countryName(locale, e.country_iso, e.country_name)
              : e.country_list && e.country_list.length > 1 ? t('card.countries', { n: e.country_list.length }) : e.country_name || t('card.panAfrican')}
          </span>
        </div>
        {e.score != null && (
          <span className="flex-shrink-0 rounded-md bg-neutral-800 px-1.5 py-0.5 text-xs font-bold tabular-nums text-orange-400"
            title={t('card.scoreTitle')}>
            {Math.round(e.score)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {typeLabel && <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300">{typeLabel}</span>}
        {categoryLabel && <span className="rounded-full bg-orange-950/60 px-2 py-0.5 text-[11px] text-orange-300">{categoryLabel}</span>}
      </div>
      {e.description && <p className="line-clamp-2 text-xs leading-relaxed text-neutral-400">{e.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-800 pt-2 text-xs">
        <span className="truncate tabular-nums text-neutral-500" title={statsTitle}>{stats.join(' · ') || ' '}</span>
        <span className="flex flex-shrink-0 gap-3">
          {e.profile_path && <Link href={e.profile_path} className="text-neutral-300 hover:text-white">{t('card.profile')}</Link>}
          {e.url && (
            <TrackedChannelLink href={e.url} channel={e.name} countryIso={e.country_iso} from={from}
              className="font-medium text-orange-400 hover:text-orange-300">
              {youtube ? 'YouTube ↗' : t('card.watch')}
            </TrackedChannelLink>
          )}
        </span>
      </div>
    </li>
  );
}
