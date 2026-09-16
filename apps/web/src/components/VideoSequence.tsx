'use client';

import Hls from 'hls.js';
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

// Same never-unmount rule as PlayerMount, for the non-YouTube "streaming"
// platform (direct HLS feeds, e.g. RT International's own CDN -- it has no
// working YouTube channel to embed instead). One Hls.js instance is created
// once and reused across channel switches via loadSource, exactly like
// YT.Player's loadVideoById -- attach/destroy cycles here would carry the
// same mid-flight-teardown risk PlayerMount was built to avoid.
const HlsPlayerMount = memo(function HlsPlayerMount({
  videoRef,
  hlsRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: React.RefObject<Hls | null>;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !Hls.isSupported()) return;
    const hls = new Hls();
    hls.attachMedia(video);
    hlsRef.current = hls;
    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <video ref={videoRef} className="w-full h-full object-cover" muted autoPlay playsInline />;
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
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

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
  const streamUrl = channel?.platform === 'streaming' ? channel.channel_url : null;
  const mode: 'youtube' | 'hls' | 'none' = streamUrl ? 'hls' : videoId ? 'youtube' : 'none';

  useEffect(() => {
    if (playerReady && playerRef.current && videoId) {
      playerRef.current.loadVideoById(videoId);
      playerRef.current.mute();
    }
  }, [videoId, playerReady]);

  useEffect(() => {
    const video = videoElRef.current;
    if (mode !== 'hls' || !streamUrl || !video) {
      video?.pause();
      return;
    }
    const tryPlay = () => {
      video.play().catch(() => {});
    };
    // loadSource (and setting .src directly for Safari) is asynchronous --
    // calling play() right away, before Hls.js has actually buffered
    // anything, gets silently rejected and never retried, leaving the video
    // stuck at a loaded-but-paused readyState. MANIFEST_PARSED / canplay is
    // the actual signal that there's something to play.
    if (hlsRef.current) {
      hlsRef.current.loadSource(streamUrl);
      hlsRef.current.once(Hls.Events.MANIFEST_PARSED, tryPlay);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari has native HLS support and Hls.isSupported() is false there --
      // HlsPlayerMount never creates an Hls.js instance in that case, so this
      // is the only path that plays the stream on Safari.
      video.src = streamUrl;
      video.addEventListener('canplay', tryPlay, { once: true });
    }
    tryPlay();
  }, [mode, streamUrl]);

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

  // PlayerMount and HlsPlayerMount must both stay mounted in the exact same
  // tree position across every state below (empty list, channel with no
  // video, YouTube channel, HLS channel) -- unmounting either one (e.g. via
  // an early return with a different element tree) tears down its live
  // player mid-flight; for PlayerMount specifically, YouTube's own
  // widget-api script then throws trying to read .src off the now-detached
  // iframe on its next postMessage tick, which crashes the tab. Switching
  // which one is *visible* is done with a CSS class, never by adding or
  // removing either from the tree.
  //
  // The video box is flex-1 (fills whatever height its parent section has
  // left), not aspect-video -- a fixed 16:9 box sizes itself off the
  // panel's *width* regardless of how tall the screen actually is, which
  // is exactly what forced scrolling on shorter screens. Letting it fill
  // the remaining flex space means the three video boxes always finish
  // exactly at the bottom of the panel, at whatever aspect ratio that
  // implies for the current screen -- never taller than what's available.
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1">
      <div className="flex-1 min-h-0 rounded-md overflow-hidden bg-black relative">
        <div className={`absolute inset-0 ${mode === 'youtube' ? '' : 'hidden'}`}>
          <PlayerMount containerRef={containerRef} onReady={handlePlayerReady} />
        </div>
        <div className={`absolute inset-0 ${mode === 'hls' ? '' : 'hidden'}`}>
          <HlsPlayerMount videoRef={videoElRef} hlsRef={hlsRef} />
        </div>
        {mode === 'none' && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs italic px-3 text-center bg-black">
            {channel ? `Aucune vidéo disponible pour ${channel.name}` : emptyText}
          </div>
        )}
      </div>
      {channel && (
        <div className="flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs font-medium truncate">{channel.name}</p>
          <div className="flex gap-1 shrink-0">
            {channels.map((c, i) => (
              <span key={c.id} className={`h-1 w-4 rounded-full ${i === index ? 'bg-orange-500' : 'bg-neutral-700'}`} />
            ))}
          </div>
        </div>
      )}
      {channel?.latest_video?.title && (
        <p className="text-[10px] text-neutral-500 line-clamp-1 shrink-0">{channel.latest_video.title}</p>
      )}
    </div>
  );
}
