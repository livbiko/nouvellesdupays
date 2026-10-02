'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { getConsent, loadTrackingConfig, track, type EventContext } from '@/lib/tracking';
import type { EventName } from '@/lib/trackingEvents';

type Props = Record<string, string | number | boolean | null | undefined>;

// Fires `name` once for this mount -- immediately if the visitor already
// consented, otherwise as soon as they do (so a landing page view isn't
// lost just because the consent banner was answered a few seconds later).
export function useTrackOnce(name: EventName, props?: Props, ctx?: EventContext) {
  const fired = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const fire = () => {
      if (fired.current || cancelled || getConsent()?.analytics !== true) return;
      fired.current = true;
      track(name, props, ctx);
    };
    loadTrackingConfig().then(fire);
    window.addEventListener('ndp-consent-change', fire);
    return () => {
      cancelled = true;
      window.removeEventListener('ndp-consent-change', fire);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
}

export function TrackView({ name, props, ctx }: { name: EventName; props?: Props; ctx?: EventContext }) {
  useTrackOnce(name, props, ctx);
  return null;
}

// A link that records a click event. External links open in a new tab
// with rel="noopener noreferrer" (no window.opener, no referrer leak).
export function TrackedLink({
  href,
  event,
  props,
  ctx,
  external = false,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  event: EventName;
  props?: Props;
  ctx?: EventContext;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const onClick = () => track(event, props, ctx);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
