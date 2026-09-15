'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import VideoCarousel from './VideoCarousel';
import type { VideoChannel, VideoChannels } from '@/lib/types';

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

function VideoWindow({
  title,
  channels,
  emptyText,
  loading,
  topicFilter,
}: {
  title: string;
  channels: VideoChannel[];
  emptyText: string;
  loading: boolean;
  topicFilter?: { active: string | null; options: string[]; onSelect: (t: string | null) => void };
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-4">
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {!loading && topicFilter && topicFilter.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {topicFilter.options.map((t) => (
              <button
                key={t}
                onClick={() => topicFilter.onSelect(topicFilter.active === t ? null : t)}
                className={`text-[10px] px-2 py-1 rounded ${
                  topicFilter.active === t ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                {TOPIC_LABELS[t] || t}
              </button>
            ))}
          </div>
        )}
        {!loading && <VideoCarousel channels={channels} emptyText={emptyText} />}
      </div>
    </section>
  );
}

// Three always-visible windows stacked in the left column, instead of a
// single panel readers have to tab between -- Live Now / Africa Voices /
// National TV all show at once, each independently scrollable, backed by
// one shared fetch since they all come from the same /video-channels
// response.
export default function VideoPanel({ iso }: { iso: string }) {
  const [data, setData] = useState<VideoChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [africaTopicFilter, setAfricaTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setAfricaTopicFilter(null);
    api.videoChannels(iso)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ live_now: [], africa_voices: [], national_tv: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [iso]);

  const africaTopics = data ? (Array.from(new Set(data.africa_voices.map((c) => c.topic).filter(Boolean))) as string[]) : [];
  const filteredAfricaVoices = data
    ? data.africa_voices.filter((c) => !africaTopicFilter || c.topic === africaTopicFilter)
    : [];

  return (
    <aside className="fixed top-0 left-0 h-full w-full sm:w-[380px] bg-neutral-950/95 backdrop-blur border-r border-neutral-800 overflow-y-auto z-10">
      <div className="p-5 flex flex-col gap-4">
        <VideoWindow
          title="🔴 Live Now"
          channels={data?.live_now ?? []}
          emptyText="Aucune chaîne en direct répertoriée pour ce pays."
          loading={loading}
        />
        <VideoWindow
          title="▶️ Africa Voices"
          channels={filteredAfricaVoices}
          emptyText="Aucune chaîne répertoriée pour ce pays."
          loading={loading}
          topicFilter={{ active: africaTopicFilter, options: africaTopics, onSelect: setAfricaTopicFilter }}
        />
        <VideoWindow
          title="📺 National TV"
          channels={data?.national_tv ?? []}
          emptyText="Aucune chaîne nationale répertoriée pour ce pays."
          loading={loading}
        />
      </div>
    </aside>
  );
}
