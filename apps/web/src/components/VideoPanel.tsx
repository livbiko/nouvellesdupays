'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import VideoSequence from './VideoSequence';
import type { VideoChannels } from '@/lib/types';

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

const SECTIONS = [
  { key: 'live_now', title: '🔴 Live Now', emptyText: 'Aucune chaîne en direct répertoriée pour ce pays.' },
  { key: 'africa_voices', title: '▶️ Africa Voices', emptyText: 'Aucune chaîne répertoriée pour ce pays.' },
  { key: 'national_tv', title: '📺 National TV', emptyText: 'Aucune chaîne nationale répertoriée pour ce pays.' },
] as const;

// Auto-advancing slideshow through the three video categories, each playing
// actual video (not text cards): one channel's latest upload autoplays for
// a 30s slot (see VideoSequence), then the next channel, and once every
// channel in a category has had its turn, the panel moves on to the next
// category -- Live Now -> Africa Voices -> National TV -> loops back.
// Dots below let a reader jump straight to a category.
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

  function advanceSection() {
    setActiveIndex((i) => (i + 1) % SECTIONS.length);
  }

  const africaTopics = data ? (Array.from(new Set(data.africa_voices.map((c) => c.topic).filter(Boolean))) as string[]) : [];
  const filteredAfricaVoices = data
    ? data.africa_voices.filter((c) => !africaTopicFilter || c.topic === africaTopicFilter)
    : [];

  const active = SECTIONS[activeIndex];
  const activeChannels =
    active.key === 'live_now' ? data?.live_now ?? []
    : active.key === 'africa_voices' ? filteredAfricaVoices
    : data?.national_tv ?? [];

  return (
    <aside className="fixed top-0 left-0 h-full w-full md:w-[350px] bg-neutral-950/95 backdrop-blur border-r border-neutral-800 overflow-y-auto z-10">
      <div className="p-5">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
            <h2 className="font-semibold text-sm">{active.title}</h2>
          </div>
          <div className="p-4">
            {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
            {!loading && active.key === 'africa_voices' && africaTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {africaTopics.map((t) => (
                  <button
                    key={t}
                    onClick={() => setAfricaTopicFilter(africaTopicFilter === t ? null : t)}
                    className={`text-[10px] px-2 py-1 rounded ${
                      africaTopicFilter === t ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {TOPIC_LABELS[t] || t}
                  </button>
                ))}
              </div>
            )}
            {!loading && (
              <VideoSequence channels={activeChannels} emptyText={active.emptyText} onCycleComplete={advanceSection} />
            )}
          </div>
        </section>

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
