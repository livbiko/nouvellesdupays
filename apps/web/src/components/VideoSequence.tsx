'use client';

import { useEffect, useRef, useState } from 'react';
import type { VideoChannel } from '@/lib/types';

const SLOT_MS = 30000;

// Matches /watch?v=ID, /shorts/ID, and /embed/ID -- the three URL shapes
// latest_video.url can come back as from the different channels seeded so far.
function extractYoutubeId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:[?&]v=|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// The YouTube IFrame Player API, loaded once and shared across every
// VideoSequence instance for the life of the page. Switching channels every
// 30s by tearing down and recreating a plain <iframe> (the first version of
// this component) meant a brand-new embedded player -- and its own GPU/
// video-decode context -- every slot, stacked on top of the globe's own
// always-on WebGL render loop (see Globe.tsx). Reusing one YT.Player per
// section via loadVideoById avoids that churn entirely.
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YTPlayer {
  loadVideoById: (id: string) => void;
  mute: () => void;
  destroy: () => void;
}

let apiLoadPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

// Actual video playback, not text cards, for all three video categories
// (Live Now / Africa Voices / National TV): one channel's latest upload
// plays (autoplay, muted -- required for browser autoplay policy) for a
// fixed 30s slot, then advances to the next channel in the list via the
// same persistent player. Calls onCycleComplete once every channel has had
// its slot, so the parent panel can move on to the next category.
export default function VideoSequence({
  channels,
  emptyText,
  onCycleComplete,
}: {
  channels: VideoChannel[];
  emptyText: string;
  onCycleComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [channels]);

  // One player for the whole lifetime of this VideoSequence instance (i.e.
  // one per active section -- switching Live Now -> Africa Voices legitimately
  // unmounts/remounts this component, which is fine; it's the per-channel
  // switch *within* a section that no longer tears anything down).
  useEffect(() => {
    let cancelled = false;
    loadYoutubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, mute: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => { if (!cancelled) setPlayerReady(true); } },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const channel = channels[index] as VideoChannel | undefined;
  const videoId = channel ? extractYoutubeId(channel.latest_video?.url ?? null) : null;

  useEffect(() => {
    if (playerReady && playerRef.current && videoId) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.mute();
    }
  }, [videoId, playerReady]);

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

  if (channels.length === 0 || !channel) {
    return <p className="text-neutral-500 text-sm">{emptyText}</p>;
  }

  return (
    <div>
      <div className="aspect-video rounded-md overflow-hidden bg-black mb-2 relative">
        <div ref={containerRef} className="w-full h-full" style={{ visibility: videoId ? 'visible' : 'hidden' }} />
        {!videoId && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm italic px-3 text-center">
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
