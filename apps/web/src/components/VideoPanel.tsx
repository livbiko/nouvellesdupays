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
  { key: 'live_now', emptyText: 'Aucune chaîne en direct répertoriée pour ce pays.' },
  { key: 'local_voices', emptyText: 'Aucune chaîne répertoriée pour ce pays.' },
  { key: 'national_tv', emptyText: 'Aucune chaîne nationale répertoriée pour ce pays.' },
] as const;

// "Voices" is a per-country label everywhere except Africa, which keeps
// the continent-wide "Africa Voices" title regardless of which African
// country is selected -- "Germany Voices", "France Voices", etc. for
// everyone else. The DB/API field behind it is `local_voices` (renamed
// from `africa_voices` in migration 009) precisely because it's no longer
// Africa-only data, even though Africa's own display label stays as-is.
function sectionTitle(
  key: (typeof SECTIONS)[number]['key'],
  countryName: string | undefined,
  isAfrica: boolean
): string {
  if (key === 'live_now') return '🔴 Live Now';
  if (key === 'national_tv') return '📺 National TV';
  if (isAfrica) return '▶️ Africa Voices';
  return countryName ? `▶️ ${countryName} Voices` : '▶️ Voices';
}

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
export default function VideoPanel({
  iso,
  countryName,
  isAfrica = false,
}: {
  iso: string;
  countryName?: string;
  isAfrica?: boolean;
}) {
  const [data, setData] = useState<VideoChannels | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setTopicFilter(null);
    api.videoChannels(iso)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ live_now: [], local_voices: [], national_tv: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [iso]);

  const voiceTopics = data ? (Array.from(new Set(data.local_voices.map((c) => c.topic).filter(Boolean))) as string[]) : [];
  const filteredVoices = data
    ? data.local_voices.filter((c) => !topicFilter || c.topic === topicFilter)
    : [];

  const channelsFor = (key: (typeof SECTIONS)[number]['key']) =>
    key === 'live_now' ? data?.live_now ?? []
    : key === 'local_voices' ? filteredVoices
    : data?.national_tv ?? [];

  return (
    <aside className="fixed top-0 left-0 h-full w-full md:w-[350px] bg-neutral-950/95 backdrop-blur border-r border-neutral-800 overflow-hidden z-10">
      {/* flex-col + h-full makes the 3 sections below split the panel's
          actual height exactly into thirds (flex-1 each), on any screen
          size -- rather than stacking at their natural content height and
          relying on overflow-y-auto to scroll past whatever doesn't fit.
          min-h-0 on every level of this chain is required: a flex child's
          default min-height is `auto` (its content size), which silently
          overrides flex-1's shrinking and reintroduces the overflow this
          is meant to prevent. */}
      <div className="h-full flex flex-col gap-1.5 p-2 pb-16 md:pb-2">
        {SECTIONS.map((section) => (
          <section
            key={section.key}
            className="flex-1 min-h-0 flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/80 shrink-0">
              <h2 className="font-semibold text-xs truncate">{sectionTitle(section.key, countryName, isAfrica)}</h2>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-2 gap-1">
              {loading && <p className="text-neutral-500 text-xs">Chargement…</p>}
              {!loading && section.key === 'local_voices' && voiceTopics.length > 0 && (
                <div className="flex flex-wrap gap-1 shrink-0">
                  {voiceTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopicFilter(topicFilter === t ? null : t)}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        topicFilter === t ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
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
