'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import CountryPanel from '@/components/CountryPanel';
import { api } from '@/lib/api';
import { detectVisitorCountry, getSavedCountry, saveCountry } from '@/lib/geo';
import type { Country } from '@/lib/types';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

export default function Home() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const geoRanFor = useRef<string | null>(null);

  useEffect(() => {
    api.countries().then(setCountries).catch((err) => setError(err.message));
  }, []);

  // Geo-aware landing: a previously saved preference always wins (the user
  // already made their choice once). Otherwise, detect once per page load
  // and land there automatically if it's one of our supported countries --
  // never blocks or breaks the globe if detection fails or isn't supported.
  useEffect(() => {
    if (countries.length === 0) return;
    const key = countries.map((c) => c.iso_code).join(',');
    if (geoRanFor.current === key) return;
    geoRanFor.current = key;

    const saved = getSavedCountry();
    if (saved && countries.some((c) => c.iso_code === saved)) {
      setSelectedIso(saved);
      return;
    }

    detectVisitorCountry().then((detected) => {
      if (detected && countries.some((c) => c.iso_code === detected)) {
        setSelectedIso(detected);
        setAutoDetected(true);
        saveCountry(detected);
      }
    });
  }, [countries]);

  function selectCountry(iso: string) {
    setSelectedIso(iso);
    setAutoDetected(false);
    saveCountry(iso);
  }

  return (
    <main className="relative flex-1 overflow-hidden">
      <header className="absolute top-0 left-0 z-10 p-6 pointer-events-none">
        <h1 className="text-xl font-bold tracking-tight">
          Nouvelles<span className="text-orange-500">Du</span>Pays
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Cliquez sur un pays pour voir ses actualités
        </p>
      </header>

      {error && (
        <p className="absolute top-6 right-6 z-10 text-red-400 text-sm max-w-xs">
          Impossible de contacter l&apos;API : {error}
        </p>
      )}

      <div className="absolute inset-0">
        <Globe countries={countries} onSelect={selectCountry} selectedIso={selectedIso} />
      </div>

      {selectedIso && (
        <CountryPanel
          iso={selectedIso}
          autoDetected={autoDetected}
          onClose={() => {
            setSelectedIso(null);
            setAutoDetected(false);
          }}
        />
      )}
    </main>
  );
}
