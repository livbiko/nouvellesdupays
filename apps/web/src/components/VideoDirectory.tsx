'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/tracking';
import SafeImg from './SafeImg';
import type { LandingVideo } from '@/lib/types';

// Client-side filter over the server-rendered list; each settled query is
// reported as a Search event (debounced, so typing isn't one event per key).
export default function VideoDirectory({ videos }: { videos: LandingVideo[] }) {
  const [q, setQ] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return videos;
    return videos.filter((v) =>
      [v.title, v.landing_headline, v.channel_name, v.country_name, v.category].some((s) => s?.toLowerCase().includes(needle))
    );
  }, [q, videos]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) return;
    timer.current = setTimeout(() => track('Search', { search_term: term.slice(0, 100), results: filtered.length, scope: 'videos' }), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, filtered.length]);

  if (videos.length === 0) {
    return <p className="mt-8 text-neutral-500 text-sm">Aucune vidéo publiée pour le moment.</p>;
  }

  return (
    <>
      <label htmlFor="video-search" className="sr-only">Rechercher une vidéo</label>
      <input
        id="video-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher par titre, chaîne, pays…"
        className="mt-6 w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm"
      />
      {filtered.length === 0 && <p className="mt-6 text-neutral-500 text-sm">Aucun résultat pour « {q} ».</p>}
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <li key={v.id}>
            <Link href={`/youtube/${v.slug}`} className="group block">
              <SafeImg src={v.thumbnail_url} alt="" width={480} height={270} loading="lazy" className="w-full aspect-video object-cover rounded-lg bg-neutral-800"
                fallback={<span className="block w-full aspect-video rounded-lg bg-gradient-to-br from-orange-900 to-neutral-900" aria-hidden="true" />} />
              <span className="block mt-2 text-sm font-medium leading-snug line-clamp-2 group-hover:text-orange-400">{v.landing_headline || v.title}</span>
              <span className="block text-xs text-neutral-500 mt-0.5 truncate">{[v.channel_name, v.country_name].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
