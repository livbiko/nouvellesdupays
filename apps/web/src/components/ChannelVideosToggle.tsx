'use client';

import { useState } from 'react';
import ChannelUploads from '@/components/ChannelUploads';
import { translator, type Locale } from '@/i18n';

// Build #261: "Dernières vidéos" on a country page card. The player (ChannelUploads, uploads-playlist embed from
// youtube-nocookie.com) only appears after this click, so a country page loads nothing from YouTube by itself.
export default function ChannelVideosToggle({ channelId, name, locale = 'fr' }: { channelId: string; name: string; locale?: Locale }) {
  const { t } = translator(locale);
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="text-xs text-orange-400 hover:text-orange-300">
        {open ? t('uploads.hide') : t('uploads.show')}
      </button>
      {open && <div className="mt-2"><ChannelUploads channelId={channelId} name={name} autoOpen locale={locale} /></div>}
    </div>
  );
}
