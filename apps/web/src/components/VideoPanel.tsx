'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LiveVideoSequence from './LiveVideoSequence';
import VideoCarousel from './VideoCarousel';
import type { VideoChannel, VideoChannels } from '@/lib/types';

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

const SECTIONS = [
  { key: 'live_now', title: '🔴 Live Now' },
  { key: 'africa_voices', title: '▶️ Africa Voices' },
  { key: 'national_tv', title: '📺 National TV' },
] as const;

const ADVANCE_MS = 8000;

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

// Auto-advancing slideshow through the three video categories -- one window
// shown at a time (Live Now -> Africa Voices -> National TV -> loops back),
// rather than all three stacked simultaneously. Dots below let a reader jump
// straight to a section without waiting for the rotation.
export default function VideoPanel({ iso }: { iso: string }) {
  const [data, setData] = useState<VideoChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [africaTopicFilter, setAfricaTopicFilter] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setAfricaTopicFilter(null);
    setActiveIndex(0);
    api.videoChannels(iso)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ live_now: [], africa_voices: [], national_tv: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [iso]);

  const activeKeyForTimer = SECTIONS[activeIndex].key;

  // Live Now advances on its own schedule (each channel gets a 30s video
  // slot via LiveVideoSequence, which calls advanceSection once every
  // channel has played) -- this flat interval only drives Africa Voices and
  // National TV, which still show static cards rather than playing video.
  useEffect(() => {
    if (activeKeyForTimer === 'live_now') return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % SECTIONS.length);
    }, ADVANCE_MS);
    return () => clearInterval(timer);
  }, [iso, activeKeyForTimer]);

  function advanceSection() {
    setActiveIndex((i) => (i + 1) % SECTIONS.length);
  }

  const africaTopics = data ? (Array.from(new Set(data.africa_voices.map((c) => c.topic).filter(Boolean))) as string[]) : [];
  const filteredAfricaVoices = data
    ? data.africa_voices.filter((c) => !africaTopicFilter || c.topic === africaTopicFilter)
    : [];

  const activeKey = SECTIONS[activeIndex].key;
  const activeTitle = SECTIONS[activeIndex].title;
  const activeChannels =
    activeKey === 'live_now' ? data?.live_now ?? []
    : activeKey === 'africa_voices' ? filteredAfricaVoices
    : data?.national_tv ?? [];
  const activeEmptyText =
    activeKey === 'live_now' ? 'Aucune chaîne en direct répertoriée pour ce pays.'
    : activeKey === 'africa_voices' ? 'Aucune chaîne répertoriée pour ce pays.'
    : 'Aucune chaîne nationale répertoriée pour ce pays.';

  return (
    <aside className="fixed top-0 left-0 h-full w-full sm:w-[380px] bg-neutral-950/95 backdrop-blur border-r border-neutral-800 overflow-y-auto z-10">
      <div className="p-5">
        {activeKey === 'live_now' ? (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
              <h2 className="font-semibold text-sm">{activeTitle}</h2>
            </div>
            <div className="p-4">
              {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
              {!loading && <LiveVideoSequence channels={data?.live_now ?? []} onCycleComplete={advanceSection} />}
            </div>
          </section>
        ) : (
          <VideoWindow
            title={activeTitle}
            channels={activeChannels}
            emptyText={activeEmptyText}
            loading={loading}
            topicFilter={
              activeKey === 'africa_voices'
                ? { active: africaTopicFilter, options: africaTopics, onSelect: setAfricaTopicFilter }
                : undefined
            }
          />
        )}
        <div className="flex justify-center gap-2 mt-4">
          {SECTIONS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveIndex(i)}
              aria-label={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? 'w-6 bg-orange-500' : 'w-1.5 bg-neutral-700 hover:bg-neutral-600'
              }`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
