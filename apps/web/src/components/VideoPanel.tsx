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

// Three permanently-visible sections, each independently and continuously
// playing actual video (not text cards): one channel's latest upload
// autoplays for a 30s slot (see VideoSequence), then the next channel in
// that same section's own list, looping forever within the section --
// there is no cross-section "advance," each box runs on its own clock.
//
// Three concurrent embedded YT.Players is a real GPU/video-decode cost on
// top of the 3D globe's own always-on WebGL render loop (Globe.tsx) --
// this project tried exactly this once before and saw a live
// `WebGLRenderer: Context Lost` event under that combined load. Kept the
// same mitigations that made the single-player version safe (one
// persistent YT.Player per section via loadVideoById, never destroyed and
// recreated on channel switch -- see PlayerMount in VideoSequence.tsx) so
// each of the three players only churns its own iframe once, not three
// times over.
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

  const channelsFor = (key: (typeof SECTIONS)[number]['key']) =>
    key === 'live_now' ? data?.live_now ?? []
    : key === 'africa_voices' ? filteredAfricaVoices
    : data?.national_tv ?? [];

  return (
    <aside className="fixed top-0 left-0 h-full w-full md:w-[350px] bg-neutral-950/95 backdrop-blur border-r border-neutral-800 overflow-y-auto z-10">
      <div className="p-5 flex flex-col gap-4">
        {SECTIONS.map((section) => (
          <section key={section.key} className="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
              <h2 className="font-semibold text-sm">{section.title}</h2>
            </div>
            <div className="p-4">
              {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
              {!loading && section.key === 'africa_voices' && africaTopics.length > 0 && (
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
                <VideoSequence channels={channelsFor(section.key)} emptyText={section.emptyText} onCycleComplete={() => {}} />
              )}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
