'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/tracking';

type Ctx = { video_id: number; country_iso?: string | null };

// Primary landing-page CTAs: join (scrolls to the registration form) and
// watch on YouTube (outbound).
export function LandingCtas({ youtubeId, ctx }: { youtubeId: string; ctx: Ctx }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <a
        href="#inscription"
        onClick={() => track('RegisterStarted', { cta: 'hero' }, ctx)}
        className="flex-1 text-center rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3 text-sm"
      >
        Rejoindre NouvellesDuPays — gratuit
      </a>
      <a
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('WatchOnYouTube', { youtube_id: youtubeId }, ctx)}
        className="flex-1 text-center rounded-lg border border-neutral-600 hover:border-neutral-400 text-neutral-100 font-medium px-5 py-3 text-sm"
      >
        ▶ Regarder sur YouTube
      </a>
    </div>
  );
}

// Share links carry utm_medium=social_share so the visits they bring back
// are attributed to sharing, not to the original ad.
export function ShareButtons({ url, title, ctx }: { url: string; title: string; ctx: Ctx }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === 'function'), []);
  const withUtm = (source: string) => {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', 'social_share');
    return u.toString();
  };
  const share = (method: string) => track('Share', { method }, ctx);
  const enc = encodeURIComponent;

  async function nativeShare() {
    share('native');
    try {
      await navigator.share({ title, url: withUtm('native_share') });
    } catch {
      // user cancelled
    }
  }

  async function copy() {
    share('copy_link');
    try {
      await navigator.clipboard.writeText(withUtm('copy_link'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }

  const btn = 'text-xs px-3 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200';
  return (
    <div className="flex flex-wrap gap-2" aria-label="Partager">
      {canShare && (
        <button type="button" onClick={nativeShare} className={btn}>Partager…</button>
      )}
      <a className={btn} target="_blank" rel="noopener noreferrer" onClick={() => share('whatsapp')}
        href={`https://wa.me/?text=${enc(`${title} ${withUtm('whatsapp')}`)}`}>WhatsApp</a>
      <a className={btn} target="_blank" rel="noopener noreferrer" onClick={() => share('facebook')}
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(withUtm('facebook'))}`}>Facebook</a>
      <a className={btn} target="_blank" rel="noopener noreferrer" onClick={() => share('x')}
        href={`https://x.com/intent/post?text=${enc(title)}&url=${enc(withUtm('x'))}`}>X</a>
      <button type="button" onClick={copy} className={btn}>{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
    </div>
  );
}
