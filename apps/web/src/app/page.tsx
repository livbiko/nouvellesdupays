'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import CountryPanel from '@/components/CountryPanel';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

export default function Home() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.countries().then(setCountries).catch((err) => setError(err.message));
  }, []);

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
        <Globe countries={countries} onSelect={setSelectedIso} selectedIso={selectedIso} />
      </div>

      {selectedIso && (
        <CountryPanel iso={selectedIso} onClose={() => setSelectedIso(null)} />
      )}
    </main>
  );
}
