import type { VideoChannel } from '@/lib/types';

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube', terrestrial: 'Hertzien', satellite: 'Satellite', cable: 'Câble', iptv: 'IPTV', streaming: 'Streaming',
};

function flagEmoji(iso?: string): string {
  if (!iso || iso.length !== 2) return '';
  const codePoints = [...iso.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return '';
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// Same horizontal-scroll card pattern as FeaturedStrip -- the video tabs
// (Live Now / Africa Voices / National TV) are static tabs alongside
// Actualités/Médias/Titrologie rather than a separate rail, so their
// content follows the same carousel language already established for
// "À la une" instead of introducing a second visual pattern for cards.
export default function VideoCarousel({ channels, emptyText }: { channels: VideoChannel[]; emptyText: string }) {
  if (channels.length === 0) {
    return <p className="text-neutral-500 text-sm">{emptyText}</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory">
      {channels.map((c) => (
        <a
          key={c.id}
          href={c.channel_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group shrink-0 w-44 snap-start rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 hover:border-orange-500/50 hover:bg-neutral-900 transition-colors"
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 truncate">
              {c.country_iso && !c.is_selected_country ? `${flagEmoji(c.country_iso)} ` : ''}
              {c.name}
            </p>
            {c.platform !== 'youtube' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0">
                {PLATFORM_LABELS[c.platform] || c.platform}
              </span>
            )}
          </div>
          {c.description && <p className="text-[11px] text-neutral-500 mb-1">{c.description}</p>}
          {c.latest_video?.title ? (
            <p className="text-[13px] leading-snug font-medium text-neutral-100 group-hover:text-orange-400 transition-colors line-clamp-4">
              {c.latest_video.title}
            </p>
          ) : (
            <p className="text-[12px] text-neutral-600 italic">Aucune vidéo récente</p>
          )}
          {c.latest_video?.published_at && (
            <p className="text-[10px] text-neutral-600 mt-1.5">{timeAgo(c.latest_video.published_at)}</p>
          )}
        </a>
      ))}
    </div>
  );
}
