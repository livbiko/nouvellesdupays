'use client';

import { track } from '@/lib/tracking';

// CR-2026-11-16-11: an outbound link to a channel that fires the existing YouTubeClick event (same props as
// VideoSequence, `from` tells the section). Server components render everything else of the card.
export default function TrackedChannelLink({ href, channel, countryIso, from, className, children }: {
  href: string; channel: string; countryIso: string | null; from: string; className?: string; children: React.ReactNode;
}) {
  const platform = /youtube\.com|youtu\.be/.test(href) ? 'youtube' : 'web';
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}
      onClick={() => track('YouTubeClick', { channel: channel.slice(0, 80), platform, from }, { country_iso: countryIso })}>
      {children}
    </a>
  );
}
