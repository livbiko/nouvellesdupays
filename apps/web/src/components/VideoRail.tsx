'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { VideoChannel, VideoChannels } from '@/lib/types';

const TABS = [
  { key: 'live_now', icon: '🔴', label: 'Live Now' },
  { key: 'africa_voices', icon: '▶️', label: 'Africa Voices' },
  { key: 'national_tv', icon: '📺', label: 'National TV' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

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

function ChannelRow({ channel, showCountry }: { channel: VideoChannel; showCountry?: boolean }) {
  return (
    <a
      href={channel.channel_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2.5 hover:bg-neutral-800/60 border-b border-neutral-800/80 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm truncate">
          {showCountry && channel.country_iso ? `${flagEmoji(channel.country_iso)} ` : ''}
          {channel.name}
        </p>
        {channel.platform !== 'youtube' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0">
            {PLATFORM_LABELS[channel.platform] || channel.platform}
          </span>
        )}
      </div>
      {channel.description && <p className="text-xs text-neutral-500 mt-0.5">{channel.description}</p>}
      {channel.latest_video?.title && (
        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
          {channel.latest_video.title}
          {channel.latest_video.published_at && (
            <span className="text-neutral-600"> · {timeAgo(channel.latest_video.published_at)}</span>
          )}
        </p>
      )}
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="p-4 text-neutral-500 text-sm">{text}</p>;
}

// Left-side rail, independent of CountryPanel (which lives on the right):
// a narrow always-visible strip of 3 tabs, each opening a sliding panel of
// video/TV channels for the globe's currently selected country. Context-
// aware by design -- `iso` comes from the same selection state the globe
// and CountryPanel already share, so switching countries on the globe
// refreshes all three tabs without any extra interaction.
export default function VideoRail({ iso }: { iso: string }) {
  const [open, setOpen] = useState<TabKey | null>(null);
  const [data, setData] = useState<VideoChannels | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api.videoChannels(iso)
      .then(setData)
      .catch(() => setData({ live_now: [], africa_voices: [], national_tv: [] }));
  }, [iso]);

  useEffect(() => {
    setTopicFilter(null);
  }, [open]);

  const activeTab = TABS.find((t) => t.key === open);
  const africaTopics = data ? Array.from(new Set(data.africa_voices.map((c) => c.topic).filter(Boolean))) as string[] : [];
  const filteredAfricaVoices = data
    ? data.africa_voices.filter((c) => !topicFilter || c.topic === topicFilter)
    : [];

  return (
    <div className="absolute top-0 left-0 h-full z-20 flex pointer-events-none">
      <div className="h-full w-16 bg-neutral-900/95 border-r border-neutral-800 flex flex-col items-center pt-24 gap-1.5 pointer-events-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setOpen(open === t.key ? null : t.key)}
            className={`w-14 py-2.5 rounded-lg flex flex-col items-center gap-1 text-[9px] font-medium leading-tight transition-colors ${
              open === t.key ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label.split(' ').map((word) => (
              <span key={word}>{word}</span>
            ))}
          </button>
        ))}
      </div>

      {open && (
        <div className="h-full w-72 bg-neutral-900/95 border-r border-neutral-800 overflow-y-auto pointer-events-auto">
          <div className="p-4 border-b border-neutral-800 sticky top-0 bg-neutral-900/95 backdrop-blur">
            <h2 className="font-semibold text-sm">
              {activeTab?.icon} {activeTab?.label}
            </h2>
          </div>

          {!data && <EmptyState text="Chargement…" />}

          {data && open === 'live_now' && (
            data.live_now.length === 0
              ? <EmptyState text="Aucune chaîne en direct répertoriée pour ce pays." />
              : data.live_now.map((c) => <ChannelRow key={c.id} channel={c} showCountry={!c.is_selected_country} />)
          )}

          {data && open === 'africa_voices' && (
            <>
              {africaTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 border-b border-neutral-800">
                  {africaTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopicFilter(topicFilter === t ? null : t)}
                      className={`text-[10px] px-2 py-1 rounded ${
                        topicFilter === t ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                      }`}
                    >
                      {TOPIC_LABELS[t] || t}
                    </button>
                  ))}
                </div>
              )}
              {filteredAfricaVoices.length === 0
                ? <EmptyState text="Aucune chaîne répertoriée pour ce pays." />
                : filteredAfricaVoices.map((c) => <ChannelRow key={c.id} channel={c} />)}
            </>
          )}

          {data && open === 'national_tv' && (
            data.national_tv.length === 0
              ? <EmptyState text="Aucune chaîne nationale répertoriée pour ce pays." />
              : data.national_tv.map((c) => <ChannelRow key={c.id} channel={c} />)
          )}
        </div>
      )}
    </div>
  );
}
