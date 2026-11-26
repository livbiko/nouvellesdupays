'use client';

import { useState } from 'react';
import { translator, type Locale } from '@/i18n';

// Build #260: a creator's latest public videos, through YouTube's own embed of the channel's uploads playlist
// (videoseries?list=UU…). Nothing loads from YouTube until the reader clicks - no iframe, no YouTube cookies - and the
// player comes from youtube-nocookie.com. Videos are never downloaded or re-hosted (brief section 9).
// CR-2026-11-25-06: French unless the page passes its language.
export default function ChannelUploads({ channelId, name, autoOpen = false, locale = 'fr' }: { channelId: string; name: string; autoOpen?: boolean; locale?: Locale }) {
  const { t } = translator(locale);
  const [open, setOpen] = useState(autoOpen);
  const list = `UU${channelId.slice(2)}`;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full aspect-video rounded border border-neutral-800 bg-neutral-900/60 hover:border-neutral-600 flex flex-col items-center justify-center gap-2 text-sm text-neutral-300">
        <span className="h-12 w-12 rounded-full bg-orange-500/90 flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white"><path d="M8 5v14l11-7z" /></svg>
        </span>
        {t('uploads.showOf', { name })}
        <span className="text-xs text-neutral-500">{t('uploads.playerNote')}</span>
      </button>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded border border-neutral-800 bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&autoplay=1`}
        title={t('uploads.title', { name })}
        className="h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
