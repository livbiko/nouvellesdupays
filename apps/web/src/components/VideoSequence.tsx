'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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

// YT.Player takes over this div and replaces it with an iframe *outside*
// React's knowledge. If this markup were inlined in VideoSequence's own
// render, every re-render (a channel switch updates the title/dots in the
// very same render pass) would make React reconcile this node too -- and
// since React still believes a plain <div> lives here, it stomps the real
// iframe back out. Isolating the mount point in its own memoized component
// with permanently-stable props means React never re-renders it after the
// initial mount, so the iframe YT.Player inserted is never touched again.
const PlayerMount = memo(function PlayerMount({
  containerRef,
  onReady,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onReady: (event: { target: YTPlayer }) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    loadYoutubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      player = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, mute: 1, rel: 0, modestbranding: 1 },
        events: { onReady },
      });
    });
    return () => {
      cancelled = true;
      player?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
});

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // The player instance is only reachable via the onReady event's target --
  // PlayerMount's own effect holds the authoritative instance but never
  // re-renders to hand it up (that's the whole point), so this event-target
  // grab is the one safe way to get a stable reference up to the parent.
  const handlePlayerReady = useCallback((event: { target: YTPlayer }) => {
    playerRef.current = event.target;
    setPlayerReady(true);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [channels]);

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
        setIndex(0);
        onCycleComplete();
      } else {
        setIndex(next);
      }
    }, SLOT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, channels]);

  // PlayerMount must stay mounted in the exact same tree position across
  // every state below (empty list, channel with no video, channel with
  // video) -- unmounting it (e.g. via an early return with a different
  // element tree) tears down the live YT.Player mid-flight, and YouTube's
  // own widget-api script then throws trying to read .src off the now-
  // detached iframe on its next postMessage tick, which crashes the tab.
  // A single always-rendered tree with an overlay is the safe pattern.
  return (
    <div>
      <div className="aspect-video rounded-md overflow-hidden bg-black mb-2 relative">
        <PlayerMount containerRef={containerRef} onReady={handlePlayerReady} />
        {(!channel || !videoId) && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm italic px-3 text-center bg-black">
            {channel ? `Aucune vidéo disponible pour ${channel.name}` : emptyText}
          </div>
        )}
      </div>
      {channel && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{channel.name}</p>
          <div className="flex gap-1 shrink-0">
            {channels.map((c, i) => (
              <span key={c.id} className={`h-1 w-4 rounded-full ${i === index ? 'bg-orange-500' : 'bg-neutral-700'}`} />
            ))}
          </div>
        </div>
      )}
      {channel?.latest_video?.title && (
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{channel.latest_video.title}</p>
      )}
    </div>
  );
}
