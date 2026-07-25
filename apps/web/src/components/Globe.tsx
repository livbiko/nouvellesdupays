'use client';

import { useCallback, useEffect, useRef } from 'react';
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

  return (
    <GlobeGL
      ref={globeRef}
      globeImageUrl={EARTH_TEXTURE}
      backgroundColor="rgba(0,0,0,0)"
      pointsData={countries}
      pointLat={(d) => (d as Country).lat}
      pointLng={(d) => (d as Country).lng}
      pointColor={(d) => ((d as Country).iso_code === selectedIso ? '#F4A825' : '#F4600A')}
      pointAltitude={0.01}
      pointRadius={(d) => ((d as Country).iso_code === selectedIso ? 0.6 : 0.4)}
      pointLabel={(d) => (d as Country).name}
      onPointClick={handlePointClick}
      width={typeof window !== 'undefined' ? window.innerWidth : undefined}
      height={typeof window !== 'undefined' ? window.innerHeight : undefined}
    />
  );
}
