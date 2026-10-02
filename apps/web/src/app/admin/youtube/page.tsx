'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type AdminChannel, type AdminVideo } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-950 text-sky-300', pending: 'bg-amber-950 text-amber-300', approved: 'bg-green-900 text-green-200',
  rejected: 'bg-red-950 text-red-300', suspended: 'bg-neutral-800 text-neutral-300',
};
const FILTERS = ['all', 'submitted', 'pending', 'approved', 'suspended', 'rejected'];

export default function AdminYoutube() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [tab, setTab] = useState<'videos' | 'channels'>('videos');
  const [status, setStatus] = useState('all');
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [channels, setChannels] = useState<AdminChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'videos') setVideos(await adminApi.videos(status));
      else setChannels(await adminApi.channels(status));
    } catch (err) {
      if (err instanceof UnauthorizedError) router.push('/admin/login');
      else setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab, status]);

  async function run(id: number, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setBusy(null);
    }
  }
  const askNote = (q: string) => {
    const n = window.prompt(q);
    return n === null ? null : n || undefined;
  };

  if (!ready) return null;
  const btn = 'text-xs px-2.5 py-1 rounded disabled:opacity-50';

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        <div className="flex flex-wrap gap-2 mb-3">
          {(['videos', 'channels'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-sm px-4 py-1.5 rounded ${tab === t ? 'bg-orange-500 text-white' : 'bg-neutral-900 border border-neutral-800 text-neutral-400'}`}>
              {t === 'videos' ? 'Vidéos' : 'Chaînes'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`text-xs px-3 py-1 rounded ${status === s ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}>{s}</button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}

        {!loading && tab === 'videos' && (
          <div className="space-y-3">
            {videos.length === 0 && <p className="text-neutral-500 text-sm">Aucune vidéo.</p>}
            {videos.map((v) => (
              <div key={v.id} className="rounded border border-neutral-800 bg-neutral-900 p-3 flex flex-col md:flex-row gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`} alt="" className="w-full md:w-48 aspect-video object-cover rounded bg-neutral-800" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex flex-wrap gap-2 items-center">
                    {v.title}
                    <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_STYLE[v.status]}`}>{v.status.toUpperCase()}</span>
                    {v.availability !== 'available' && <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300">YouTube : {v.availability}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">métadonnées : {v.metadata_source}</span>
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">{[v.channel_name, v.country_name, v.category, v.language].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    <a className="underline" href={`https://www.youtube.com/watch?v=${v.youtube_video_id}`} target="_blank" rel="noreferrer">YouTube</a>
                    {' · '}Page : {v.status === 'approved'
                      ? <a className="underline text-orange-400" href={`/youtube/${v.slug}`} target="_blank" rel="noreferrer">/youtube/{v.slug}</a>
                      : <span>/youtube/{v.slug} (publiée après approbation)</span>}
                  </p>
                  <p className="text-xs text-neutral-500">Contact : {v.contact_email ?? '—'} · Soumise le {new Date(v.submitted_at).toLocaleDateString('fr-FR')}</p>
                  {v.reviewer_note && <p className="text-xs text-red-400">Note : {v.reviewer_note}</p>}
                  <LandingEditor v={v} onSave={(f) => run(v.id, () => adminApi.updateVideo(v.id, f))} />
                </div>
                <div className="flex md:flex-col gap-2 shrink-0">
                  {v.status === 'submitted' && <button disabled={busy === v.id} onClick={() => run(v.id, () => adminApi.videoAction(v.id, 'review'))} className={`${btn} bg-neutral-700`}>Mettre en revue</button>}
                  {['submitted', 'pending', 'suspended'].includes(v.status) && <button disabled={busy === v.id} onClick={() => run(v.id, () => adminApi.videoAction(v.id, 'approve'))} className={`${btn} bg-green-600`}>Approuver</button>}
                  {['submitted', 'pending'].includes(v.status) && <button disabled={busy === v.id} onClick={() => { const n = askNote('Raison du rejet ?'); if (n !== null) run(v.id, () => adminApi.videoAction(v.id, 'reject', n)); }} className={`${btn} bg-red-600`}>Rejeter</button>}
                  {v.status === 'approved' && <button disabled={busy === v.id} onClick={() => { const n = askNote('Raison de la suspension ?'); if (n !== null) run(v.id, () => adminApi.videoAction(v.id, 'suspend', n)); }} className={`${btn} bg-neutral-700`}>Suspendre</button>}
                  <button disabled={busy === v.id} onClick={() => run(v.id, () => adminApi.videoAction(v.id, 'refresh'))} className={`${btn} bg-neutral-800`}>Revérifier sur YouTube</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && tab === 'channels' && (
          <div className="overflow-x-auto">
            {channels.length === 0 && <p className="text-neutral-500 text-sm">Aucune chaîne.</p>}
            {channels.length > 0 && (
              <table className="w-full text-sm border-collapse">
                <thead><tr className="text-left text-neutral-500 border-b border-neutral-800 text-xs">
                  <th className="py-2 pr-3">Chaîne</th><th className="py-2 pr-3">Pays</th><th className="py-2 pr-3">Vérification</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3">Vidéos</th><th className="py-2 pr-3">Contact</th><th />
                </tr></thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.id} className="border-b border-neutral-900">
                      <td className="py-2 pr-3"><a href={c.channel_url} target="_blank" rel="noreferrer" className="hover:underline">{c.name || c.handle || c.channel_url}</a></td>
                      <td className="py-2 pr-3 text-neutral-400">{c.country_name ?? '—'}</td>
                      <td className={`py-2 pr-3 text-xs ${c.verification === 'verified' ? 'text-green-400' : c.verification === 'invalid' ? 'text-red-400' : 'text-amber-300'}`}>{c.verification}</td>
                      <td className="py-2 pr-3"><span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_STYLE[c.status]}`}>{c.status.toUpperCase()}</span></td>
                      <td className="py-2 pr-3 tabular-nums">{c.video_count}</td>
                      <td className="py-2 pr-3 text-xs text-neutral-400">{c.contact_email ?? '—'}</td>
                      <td className="py-2 flex gap-2">
                        {['submitted', 'pending', 'suspended'].includes(c.status) && <button disabled={busy === c.id} onClick={() => run(c.id, () => adminApi.channelAction(c.id, 'approve'))} className={`${btn} bg-green-600`}>Approuver</button>}
                        {['submitted', 'pending'].includes(c.status) && <button disabled={busy === c.id} onClick={() => run(c.id, () => adminApi.channelAction(c.id, 'reject'))} className={`${btn} bg-red-600`}>Rejeter</button>}
                        {c.status === 'approved' && <button disabled={busy === c.id} onClick={() => run(c.id, () => adminApi.channelAction(c.id, 'suspend'))} className={`${btn} bg-neutral-700`}>Suspendre</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Landing-page settings: slug (e.g. video-01 for an ad test), headline/CTA
// overrides, featured flag.
function LandingEditor({ v, onSave }: { v: AdminVideo; onSave: (f: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(v.slug);
  const [headline, setHeadline] = useState(v.landing_headline ?? '');
  const [cta, setCta] = useState(v.landing_cta_text ?? '');
  const [featured, setFeatured] = useState(v.is_featured);
  const input = 'block w-full mt-0.5 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs';
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-orange-400 hover:underline mt-1">Configurer la page de destination</button>;
  return (
    <form className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-500"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ slug, landing_headline: headline, landing_cta_text: cta, is_featured: featured });
        setOpen(false);
      }}>
      <label>Adresse (slug) — /youtube/…<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{0,79}" className={input} /></label>
      <label>Titre de la page (sinon titre YouTube)<input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} className={input} /></label>
      <label className="sm:col-span-2">Texte d’appel à l’inscription (sinon valeur des paramètres)<input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={200} className={input} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Mettre en avant</label>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-orange-500 text-white">Enregistrer</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 rounded bg-neutral-800">Annuler</button>
      </div>
    </form>
  );
}
