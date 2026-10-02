'use client';

import { useEffect, useRef, useState } from 'react';

// <img> that disappears (or shows `fallback`) when it fails to load --
// including failures that happen before hydration, when React's onError
// handler wasn't attached yet (checked once on mount via naturalWidth).
export default function SafeImg({
  fallback = null,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed || !props.src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img ref={ref} {...props} onError={() => setFailed(true)} />;
}
