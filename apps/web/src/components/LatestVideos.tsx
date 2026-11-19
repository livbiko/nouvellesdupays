import Link from 'next/link';
import TrackedChannelLink from './TrackedChannelLink';
import { frCountry } from '@/lib/countryNames';
import type { LatestVideo } from '@/lib/types';

// CR-2026-11-18-08: the newest uploads of the directory channels, read once a day from the official YouTube Data API.
// A thumbnail, the title, the channel and how long ago it was published; the link opens the video on YouTube (nothing
// is embedded or hosted here).
const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
const fullDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

function ago(iso: string, now: number): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export default function LatestVideos({ videos, now = Date.now() }: { videos: LatestVideo[]; now?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {videos.map((v) => (
        <li key={v.youtube_video_id} className="min-w-0">
          <TrackedChannelLink href={v.url} channel={v.channel_name} countryIso={v.country_iso} from="youtube_dernieres_videos"
            className="group block">
            {v.thumbnail_url
              ? <img src={v.thumbnail_url} alt="" width={320} height={180} loading="lazy"
                  className="aspect-video w-full rounded-lg bg-neutral-800 object-cover transition-opacity group-hover:opacity-90" />
              : <span aria-hidden="true" className="block aspect-video w-full rounded-lg bg-neutral-800" />}
            <span className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-neutral-100 group-hover:text-orange-400">{v.title}</span>
          </TrackedChannelLink>
          <span className="mt-1 block truncate text-xs text-neutral-400">
            {v.profile_path
              ? <Link href={v.profile_path} className="hover:text-neutral-200">{v.channel_name}</Link>
              : v.channel_name}
            {v.country_iso && <> · {frCountry(v.country_iso, v.country_name)}</>}
          </span>
          <time dateTime={v.published_at} title={`Publiée le ${fullDate.format(new Date(v.published_at))} (UTC)`}
            className="block text-xs text-neutral-500">
            {ago(v.published_at, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
