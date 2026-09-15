'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import VideoCarousel from './VideoCarousel';
import type { VideoChannels } from '@/lib/types';

const TOPIC_LABELS: Record<string, string> = {
  news: 'Actualités', politics: 'Politique', business: 'Business', investigative: 'Investigation',
  sports: 'Sport', culture: 'Culture', conflict: 'Conflit', weather: 'Météo', technology: 'Technologie',
};

type Tab = 'live_now' | 'africa_voices' | 'national_tv';

// Mirrors CountryPanel's structure and styling but on the left side of the
// globe, kept as its own panel/component rather than folded back into
// CountryPanel -- video content (channels) is a different kind of thing
// from news content (articles/publishers), so it gets its own space instead
// of competing for room in an already six-tab-wide bar.
export default function VideoPanel({ iso }: { iso: string }) {
  const [tab, setTab] = useState<Tab>('live_now');
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
    <aside className="fixed top-0 left-0 h-full w-full sm:w-[380px] bg-neutral-900/95 backdrop-blur border-r border-neutral-800 overflow-y-auto z-10">
      <div className="p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setTab('live_now')}
            className={`text-xs px-3 py-1.5 rounded ${tab === 'live_now' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
          >
            🔴 Live Now
          </button>
          <button
            onClick={() => setTab('africa_voices')}
            className={`text-xs px-3 py-1.5 rounded ${tab === 'africa_voices' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
          >
            ▶️ Africa Voices
          </button>
          <button
            onClick={() => setTab('national_tv')}
            className={`text-xs px-3 py-1.5 rounded ${tab === 'national_tv' ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
          >
            📺 National TV
          </button>
        </div>

        {tab === 'live_now' && (
          <>
            <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
              🔴 Live Now
            </h2>
            {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
            {data && (
              <VideoCarousel
                channels={data.live_now}
                emptyText="Aucune chaîne en direct répertoriée pour ce pays."
              />
            )}
          </>
        )}

        {tab === 'africa_voices' && (
          <>
            <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
              ▶️ Africa Voices
            </h2>
            {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
            {data && (
              <>
                {africaTopics.length > 0 && (
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
                <VideoCarousel channels={filteredAfricaVoices} emptyText="Aucune chaîne répertoriée pour ce pays." />
              </>
            )}
          </>
        )}

        {tab === 'national_tv' && (
          <>
            <h2 className="text-lg font-semibold mb-3 border-b border-neutral-800 pb-2">
              📺 National TV
            </h2>
            {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
            {data && (
              <VideoCarousel
                channels={data.national_tv}
                emptyText="Aucune chaîne nationale répertoriée pour ce pays."
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
