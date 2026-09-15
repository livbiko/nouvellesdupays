'use client';

import { useEffect, useState } from 'react';
import type { VideoChannel } from '@/lib/types';

const SLOT_MS = 30000;

// Matches /watch?v=ID, /shorts/ID, and /embed/ID -- the three URL shapes
// latest_video.url can come back as from the different channels seeded so far.
function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:[?&]v=|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Actual video playback, not text cards: one channel's latest upload plays
// (autoplay, muted -- required for browser autoplay policy) for a fixed
// 30s slot, then advances to the next channel in the Live Now list. Calls
// onCycleComplete once every channel has had its slot, so the parent can
// move on to the next window (Africa Voices) instead of this section
// racing ahead on its own generic timer.
export default function LiveVideoSequence({
  channels,
  onCycleComplete,
}: {
  channels: VideoChannel[];
  onCycleComplete: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [channels]);

  useEffect(() => {
    if (channels.length === 0) {
      const t = setTimeout(onCycleComplete, 3000);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => {
      const next = index + 1;
      if (next >= channels.length) {
        onCycleComplete();
      } else {
        setIndex(next);
      }
    }, SLOT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, channels]);

  if (channels.length === 0) {
    return <p className="text-neutral-500 text-sm">Aucune chaîne en direct répertoriée pour ce pays.</p>;
  }

  const channel = channels[index];
  const videoId = extractYoutubeId(channel.latest_video?.url ?? null);

  return (
    <div>
      <div className="aspect-video rounded-md overflow-hidden bg-black mb-2">
        {videoId ? (
          <iframe
            key={videoId}
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
            title={channel.name}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm italic px-3 text-center">
            Aucune vidéo disponible pour {channel.name}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{channel.name}</p>
        <div className="flex gap-1 shrink-0">
          {channels.map((c, i) => (
            <span key={c.id} className={`h-1 w-4 rounded-full ${i === index ? 'bg-orange-500' : 'bg-neutral-700'}`} />
          ))}
        </div>
      </div>
      {channel.latest_video?.title && (
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{channel.latest_video.title}</p>
      )}
    </div>
  );
}
