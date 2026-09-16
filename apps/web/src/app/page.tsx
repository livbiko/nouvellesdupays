'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import CountryPanel from '@/components/CountryPanel';
import VideoPanel from '@/components/VideoPanel';
import { api } from '@/lib/api';
import { detectVisitorCountry, getSavedCountry, saveCountry } from '@/lib/geo';
import type { Country } from '@/lib/types';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

export default function Home() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  // Both side panels are full-width below the `md` breakpoint (see
  // VideoPanel/CountryPanel) -- below that they'd otherwise fully overlap,
  // with CountryPanel (mounted later) silently hiding the video panel
  // entirely. Their fixed pixel widths (350px + 390px = 740px) only fit
  // side by side once the viewport reaches `md:` (768px); a plain `sm:`
  // (640px) cutover left a real gap where classic/regular-iPad-width
  // tablets (768px in portrait) rendered both panels overlapping in the
  // middle, so this toggle must cover everything below `md`, not just
  // phone-sized screens.
  const [mobileView, setMobileView] = useState<'news' | 'videos'>('news');
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
    setMobileView('news');
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
        <div className={mobileView === 'videos' ? 'block' : 'hidden md:block'}>
          <VideoPanel
            iso={selectedIso}
            countryName={countries.find((c) => c.iso_code === selectedIso)?.name}
            isAfrica={countries.find((c) => c.iso_code === selectedIso)?.region.includes('Africa') ?? false}
          />
        </div>
      )}

      {selectedIso && (
        <div className={mobileView === 'news' ? 'block' : 'hidden md:block'}>
          <CountryPanel
            iso={selectedIso}
            autoDetected={autoDetected}
            onClose={() => {
              setSelectedIso(null);
              setAutoDetected(false);
            }}
          />
        </div>
      )}

      {selectedIso && (
        <button
          onClick={() => setMobileView((v) => (v === 'news' ? 'videos' : 'news'))}
          className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-medium shadow-lg shadow-black/40"
        >
          {mobileView === 'news' ? (
            <>▶️ Vidéos &amp; Live</>
          ) : (
            <>📰 Actualités</>
          )}
        </button>
      )}
    </main>
  );
}
