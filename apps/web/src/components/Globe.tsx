'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import type { Country } from '@/lib/types';

interface Props {
  countries: Country[];
  onSelect: (iso: string) => void;
  selectedIso: string | null;
}

const EARTH_TEXTURE = '//unpkg.com/three-globe/example/img/earth-night.jpg';

export default function Globe({ countries, onSelect, selectedIso }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 5, lng: 10, altitude: 2.2 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  }, []);

  const handlePointClick = useCallback(
    (point: object) => {
      const c = point as Country;
      onSelect(c.iso_code);
      const globe = globeRef.current;
      if (globe) {
        globe.controls().autoRotate = false;
        globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.5 }, 800);
      }
    },
    [onSelect]
  );

  // Hover feedback -- bigger radius + brighter color on hover, and a
  // pointer cursor, so a country reads as clickable before you commit to
  // the click. globe.gl doesn't set the cursor for point layers on its own
  // (only for polygon/path layers), so it's set explicitly here.
  const handlePointHover = useCallback((point: object | null) => {
    const c = point as Country | null;
    setHoveredIso(c?.iso_code ?? null);
    const globe = globeRef.current;
    const container = globe?.renderer?.().domElement;
    if (container) container.style.cursor = c ? 'pointer' : 'default';
  }, []);

  return (
    <GlobeGL
      ref={globeRef}
      globeImageUrl={EARTH_TEXTURE}
      backgroundColor="rgba(0,0,0,0)"
      pointsData={countries}
      pointLat={(d) => (d as Country).lat}
      pointLng={(d) => (d as Country).lng}
      pointColor={(d) => {
        const iso = (d as Country).iso_code;
        if (iso === selectedIso) return '#F4A825';
        if (iso === hoveredIso) return '#FFB84D';
        return '#F4600A';
      }}
      pointAltitude={0.01}
      // Bumped up from 0.4/0.6 -- those were genuinely hard to hit,
      // especially for small/closely-spaced countries (Caribbean, Balkans,
      // West Africa's own coastline). Hover state gets an extra bump so
      // the enlarged target itself signals "you're about to click this."
      pointRadius={(d) => {
        const iso = (d as Country).iso_code;
        if (iso === selectedIso) return 1.0;
        if (iso === hoveredIso) return 0.85;
        return 0.65;
      }}
      pointLabel={(d) => (d as Country).name}
      pointsMerge={false}
      onPointClick={handlePointClick}
      onPointHover={handlePointHover}
      width={typeof window !== 'undefined' ? window.innerWidth : undefined}
      height={typeof window !== 'undefined' ? window.innerHeight : undefined}
    />
  );
}
