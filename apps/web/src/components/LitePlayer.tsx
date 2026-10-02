'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/tracking';

// Click-to-load YouTube player for the paid-traffic landing pages.
//
// Until the visitor clicks, only a static thumbnail is rendered: no YouTube
// iframe, no YouTube JS, no YouTube cookies -- the page's LCP is a single
// image, which matters a lot on mid-range phones arriving from a Facebook
// ad. On click it loads the IFrame API against youtube-nocookie.com and
// reports VideoThumbnailClick, then YouTubePlay (first real playback) and
// YouTubeWatch at 25/50/75/100 % of the video.

interface Player {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}
type PlayerCtor = new (el: HTMLElement, opts: Record<string, unknown>) => Player;

let apiPromise: Promise<PlayerCtor | null> | null = null;
function loadIframeApi(): Promise<PlayerCtor | null> {
  const w = window as unknown as { YT?: { Player?: PlayerCtor }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT.Player);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000); // blocked/slow: fall back to a plain iframe
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timeout);
      resolve(w.YT?.Player ?? null);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const MILESTONES = [25, 50, 75, 100];

export default function LitePlayer({
  youtubeId,
  videoId,
  title,
  thumbnail,
  countryIso,
}: {
  youtubeId: string;
  videoId: number;
  title: string;
  thumbnail: string;
  countryIso?: string | null;
}) {
  const [mode, setMode] = useState<'thumb' | 'loading' | 'api' | 'iframe'>('thumb');
  const [thumbSrc, setThumbSrc] = useState(thumbnail);
  const [thumbFailed, setThumbFailed] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLImageElement>(null);
  const playerRef = useRef<Player | null>(null);
  const ctx = { video_id: videoId, country_iso: countryIso ?? null };

  const fallbackThumb = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  function onThumbError() {
    if (thumbSrc !== fallbackThumb) setThumbSrc(fallbackThumb);
    else setThumbFailed(true);
  }

  // An image that failed before hydration never reaches onError.
  useEffect(() => {
    const img = thumbRef.current;
    if (img && img.complete && img.naturalWidth === 0) onThumbError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbSrc]);

  useEffect(() => () => playerRef.current?.destroy(), []);

  async function start() {
    track('VideoThumbnailClick', { youtube_id: youtubeId }, ctx);
    setMode('loading');
    const Player = await loadIframeApi();
    if (!Player || !mountRef.current) {
      setMode('iframe');
      return;
    }
    setMode('api');
    let played = false;
    const reached = new Set<number>();
    let poll: ReturnType<typeof setInterval> | null = null;
    playerRef.current = new Player(mountRef.current, {
      host: 'https://www.youtube-nocookie.com',
      videoId: youtubeId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onStateChange: (e: { data: number }) => {
          // 1 = playing, 0 = ended
          if (e.data === 1) {
            if (!played) {
              played = true;
              track('YouTubePlay', { youtube_id: youtubeId }, ctx);
            }
            if (!poll) {
              poll = setInterval(() => {
                const p = playerRef.current;
                if (!p) return;
                const d = p.getDuration();
                if (!d) return;
                const pct = (p.getCurrentTime() / d) * 100;
                for (const m of MILESTONES) {
                  if (pct >= m - 0.5 && !reached.has(m)) {
                    reached.add(m);
                    track('YouTubeWatch', { percent: m, youtube_id: youtubeId }, ctx);
                  }
                }
              }, 2000);
            }
          } else if (poll) {
            clearInterval(poll);
            poll = null;
            if (e.data === 0 && !reached.has(100)) {
              reached.add(100);
              track('YouTubeWatch', { percent: 100, youtube_id: youtubeId }, ctx);
            }
          }
        },
      },
    });
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-neutral-900 shadow-xl shadow-black/40">
      {mode === 'iframe' && (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
      <div className={`absolute inset-0 ${mode === 'api' ? '' : 'hidden'}`}>
        <div ref={mountRef} className="w-full h-full" />
      </div>
      {(mode === 'thumb' || mode === 'loading') && (
        <button
          type="button"
          onClick={start}
          disabled={mode === 'loading'}
          className="group absolute inset-0 w-full h-full"
          aria-label={`Lire la vidéo : ${title}`}
        >
          {!thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={thumbRef}
              src={thumbSrc}
              alt=""
              width={1280}
              height={720}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
              onError={onThumbError}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-neutral-900 to-neutral-950" />
          )}
          <span className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-20 h-14 rounded-2xl bg-red-600 group-hover:bg-red-500 shadow-lg">
            {mode === 'loading' ? (
              <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </span>
        </button>
      )}
    </div>
  );
}
