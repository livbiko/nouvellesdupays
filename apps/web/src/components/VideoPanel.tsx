'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { track } from '@/lib/tracking';
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

// "Voices" is per country ("Côte d'Ivoire Voices", "Germany Voices", ...),
// backed by `local_voices`. African countries additionally get "Africa
// Voices" (`africa_voices`, migration 014): pan-African channels stored once
// instead of being copied into every country. The two share the Voices box
// as tabs -- one player, not a fourth concurrent one (see the GPU note on
// VideoPanel below).
type VoicesScope = 'country' | 'africa';

function sectionTitle(key: (typeof SECTIONS)[number]['key'], countryName: string | undefined): string {
  if (key === 'live_now') return '🔴 Live Now';
  if (key === 'national_tv') return '📺 National TV';
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
  const [voicesScope, setVoicesScope] = useState<VoicesScope>('country');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setTopicFilter(null);
    api.videoChannels(iso)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Open on the country's own channels when it has any, else on
        // Africa Voices (most African countries have few of their own yet).
        setVoicesScope(d.local_voices.length === 0 && (d.africa_voices?.length ?? 0) > 0 ? 'africa' : 'country');
      })
      .catch(() => { if (!cancelled) setData({ live_now: [], local_voices: [], national_tv: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [iso]);

  const africaVoices = data?.africa_voices ?? [];
  const showVoicesTabs = isAfrica && africaVoices.length > 0;
  const voices = showVoicesTabs && voicesScope === 'africa' ? africaVoices : data?.local_voices ?? [];
  const voiceTopics = Array.from(new Set(voices.map((c) => c.topic).filter(Boolean))) as string[];
  const filteredVoices = voices.filter((c) => !topicFilter || c.topic === topicFilter);

  const switchVoices = (scope: VoicesScope) => {
    if (scope === voicesScope) return;
    track('CategorySelected', { category: scope === 'africa' ? 'africa_voices' : 'country_voices', section: 'voices_scope' }, { country_iso: iso });
    setVoicesScope(scope);
    setTopicFilter(null);
  };

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
              {section.key === 'local_voices' && showVoicesTabs ? (
                <div role="tablist" aria-label="Voices" className="flex gap-1 text-xs font-semibold">
                  {([
                    ['country', countryName ? `${countryName} Voices` : 'Voices', (data?.local_voices.length ?? 0) === 0],
                    ['africa', 'Africa Voices', false],
                  ] as const).map(([scope, label, empty]) => (
                    <button
                      key={scope}
                      role="tab"
                      aria-selected={voicesScope === scope}
                      disabled={empty}
                      title={empty ? 'Aucune chaîne répertoriée pour ce pays pour le moment.' : undefined}
                      onClick={() => switchVoices(scope)}
                      className={`truncate rounded px-1.5 py-0.5 ${
                        voicesScope === scope ? 'bg-neutral-700 text-white' : empty ? 'text-neutral-600 cursor-not-allowed' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {scope === 'country' ? '▶️ ' : '🌍 '}{label}
                    </button>
                  ))}
                </div>
              ) : (
                <h2 className="font-semibold text-xs truncate">{sectionTitle(section.key, countryName)}</h2>
              )}
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-2 gap-1">
              {loading && <p className="text-neutral-500 text-xs">Chargement…</p>}
              {!loading && section.key === 'local_voices' && voiceTopics.length > 0 && (
                <div className="flex flex-wrap gap-1 shrink-0">
                  {voiceTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        if (topicFilter !== t) track('CategorySelected', { category: t, section: 'local_voices' }, { country_iso: iso });
                        setTopicFilter(topicFilter === t ? null : t);
                      }}
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
