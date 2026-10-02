'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type LiveEvent } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Event test console. Open a landing page in another tab (add ?ndp_debug=1
// to flag that traffic as test so it stays out of the dashboard), accept
// the consent banner, and watch events arrive here every 2 seconds.
const CHECKLIST = [
  'PageView', 'LandingPageView', 'YouTubeLandingPageView', 'VideoThumbnailClick', 'YouTubePlay',
  'WatchOnYouTube', 'RegisterStarted', 'RegistrationStarted', 'RegistrationCompleted',
];

const META_STYLE: Record<string, string> = {
  sent: 'text-green-400', queued: 'text-amber-300', failed: 'text-red-400',
  no_consent: 'text-neutral-500', disabled: 'text-neutral-500', not_applicable: 'text-neutral-600',
};

export default function LiveConsole() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const lastId = useRef(0);

  // This browser's own visitor id (only exists if consent was given here).
  const myVisitor = typeof window !== 'undefined' ? (() => {
    try {
      return JSON.parse(window.localStorage.getItem('ndp_vid') || 'null') as string | null;
    } catch {
      return null;
    }
  })() : null;

  useEffect(() => {
    lastId.current = 0;
    setEvents([]);
  }, [mine]);

  useEffect(() => {
    if (!ready || paused) return;
    let stop = false;
    async function tick() {
      try {
        const res = await adminApi.live(lastId.current, mine && myVisitor ? myVisitor : undefined);
        if (stop) return;
        if (res.events.length > 0) {
          lastId.current = Math.max(lastId.current, ...res.events.map((e) => e.id));
          setEvents((prev) => [...res.events, ...prev].slice(0, 300));
        }
        setError(null);
      } catch (err) {
        if (err instanceof UnauthorizedError) router.push('/admin/login');
        else setError(err instanceof Error ? err.message : 'Erreur');
      }
    }
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [ready, paused, mine, myVisitor, router]);

  if (!ready) return null;
  const seen = new Set(events.map((e) => e.event_name));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <AdminNav />
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Console de test des événements</h2>
          <span className={`text-xs flex items-center gap-1 ${paused ? 'text-neutral-500' : 'text-green-400'}`}>
            <span className={`w-2 h-2 rounded-full ${paused ? 'bg-neutral-600' : 'bg-green-500 animate-pulse'}`} />{paused ? 'En pause' : 'En direct'}
          </span>
          <button onClick={() => setPaused(!paused)} className="text-xs px-3 py-1 rounded bg-neutral-800">{paused ? 'Reprendre' : 'Pause'}</button>
          <button onClick={() => setEvents([])} className="text-xs px-3 py-1 rounded bg-neutral-800">Vider</button>
          <label className="text-xs text-neutral-400 flex items-center gap-1" title={myVisitor ? myVisitor : 'Acceptez la mesure d’audience sur le site public dans ce navigateur'}>
            <input type="checkbox" checked={mine} disabled={!myVisitor} onChange={(e) => setMine(e.target.checked)} /> uniquement ce navigateur
          </label>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Ouvrez une page publique dans un autre onglet avec <code>?ndp_debug=1</code> (trafic marqué « test », exclu du tableau de bord),
          acceptez le bandeau cookies, puis interagissez. Aucune donnée personnelle n’est affichée : identifiants tronqués, sans email ni IP.
        </p>
        {error && <p className="text-red-400 text-sm mb-3" role="alert">{error}</p>}

        <ul className="flex flex-wrap gap-2 mb-5" aria-label="Événements attendus">
          {CHECKLIST.map((name) => (
            <li key={name} className={`text-xs px-2 py-1 rounded border ${seen.has(name) ? 'border-green-700 bg-green-950 text-green-300' : 'border-neutral-800 text-neutral-500'}`}>
              {name} {seen.has(name) ? '✓' : '…'}
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-800">
                  <th className="py-1.5 pr-3">Heure</th><th className="py-1.5 pr-3">Événement</th><th className="py-1.5 pr-3">Page</th>
                  <th className="py-1.5 pr-3">Campagne</th><th className="py-1.5 pr-3">Source</th><th className="py-1.5 pr-3">Visiteur / session</th><th className="py-1.5 pr-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-neutral-500">En attente d’événements…</td></tr>}
                {events.map((e) => (
                  <tr key={e.id} onClick={() => setSelected(e)} className={`border-b border-neutral-900 cursor-pointer hover:bg-neutral-900 ${selected?.id === e.id ? 'bg-neutral-900' : ''}`}>
                    <td className="py-1.5 pr-3 tabular-nums text-neutral-400 whitespace-nowrap">{new Date(e.occurred_at).toLocaleTimeString('fr-FR')}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <span className="text-green-400">✓</span> {e.event_name}
                      {e.is_debug && <span className="ml-1 text-[10px] px-1 rounded bg-amber-900 text-amber-200">test</span>}
                      {e.source === 'server' && <span className="ml-1 text-[10px] px-1 rounded bg-sky-900 text-sky-200">serveur</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-400 max-w-48 truncate">{e.page_path}</td>
                    <td className="py-1.5 pr-3 text-neutral-400">{e.utm_campaign ?? '—'}{e.utm_content ? ` / ${e.utm_content}` : ''}</td>
                    <td className="py-1.5 pr-3 text-neutral-400">{e.utm_source ?? e.channel ?? '—'}</td>
                    <td className="py-1.5 pr-3 font-mono text-neutral-500">{e.visitor} / {e.session}</td>
                    <td className={`py-1.5 pr-3 ${META_STYLE[e.meta_status] || ''}`}>{e.meta_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="rounded border border-neutral-800 bg-neutral-900 p-3 text-xs h-fit lg:sticky lg:top-4" aria-label="Détail de l’événement">
            {selected ? (
              <>
                <p className="font-semibold mb-2">{selected.event_name}</p>
                <pre className="whitespace-pre-wrap break-all text-neutral-300">{JSON.stringify({
                  event_id: selected.event_id, occurred_at: selected.occurred_at, page: selected.page_path,
                  campaign: selected.utm_campaign, source: selected.utm_source, medium: selected.utm_medium, content: selected.utm_content,
                  channel: selected.channel, country: selected.country_iso, video_id: selected.video_id, publisher_id: selected.publisher_id,
                  params: selected.properties, meta: selected.meta_status, recorded_by: selected.source,
                }, null, 2)}</pre>
              </>
            ) : <p className="text-neutral-500">Cliquez sur un événement pour voir ses paramètres.</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
