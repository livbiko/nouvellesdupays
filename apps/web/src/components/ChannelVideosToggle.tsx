'use client';

import { useState } from 'react';
import ChannelUploads from '@/components/ChannelUploads';

// Build #261: "Dernières vidéos" on a country page card. The player (ChannelUploads, uploads-playlist embed from
// youtube-nocookie.com) only appears after this click, so a country page loads nothing from YouTube by itself.
export default function ChannelVideosToggle({ channelId, name }: { channelId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="text-xs text-orange-400 hover:text-orange-300">
        {open ? '▾ Masquer les vidéos' : '▸ Dernières vidéos'}
      </button>
      {open && <div className="mt-2"><ChannelUploads channelId={channelId} name={name} autoOpen /></div>}
    </div>
  );
}
