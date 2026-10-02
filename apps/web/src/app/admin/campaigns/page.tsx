'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type Campaign } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Campaign registry + daily spend. Meta spend is entered by hand (or copied
// from Ads Manager) -- it is never estimated. With spend present the
// dashboard computes cost per lead; with Meta-reported link clicks it fills
// the first stage of the Facebook funnel.
const input = 'bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs';

export default function CampaignsPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [unregistered, setUnregistered] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ utm_campaign: '', label: '', objective: '', platform: 'meta' });

  async function load() {
    setLoading(true);
    try {
      const r = await adminApi.campaigns();
      setCampaigns(r.campaigns);
      setUnregistered(r.unregistered_campaigns);
      setError(null);
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
  }, [ready]);

  async function guard(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (!ready) return null;
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <AdminNav />
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}

        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-6">
          <h2 className="text-sm font-semibold mb-2">Déclarer une campagne</h2>
          {unregistered.length > 0 && (
            <p className="text-xs text-neutral-400 mb-2">
              Campagnes vues dans le trafic mais non déclarées :{' '}
              {unregistered.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, utm_campaign: c })} className="underline mr-2 text-orange-400">{c}</button>
              ))}
            </p>
          )}
          <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); guard(() => adminApi.saveCampaign(form)); setForm({ utm_campaign: '', label: '', objective: '', platform: 'meta' }); }}>
            <label className="text-xs text-neutral-500">utm_campaign<input required value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} className={`block ${input}`} placeholder="africa_news_test" /></label>
            <label className="text-xs text-neutral-500">Libellé<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={`block ${input}`} /></label>
            <label className="text-xs text-neutral-500">Objectif<input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className={`block ${input}`} placeholder="leads" /></label>
            <label className="text-xs text-neutral-500">Plateforme
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className={`block ${input}`}>
                {['meta', 'google', 'tiktok', 'other'].map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <button className="text-xs px-3 py-1.5 rounded bg-orange-500 text-white">Enregistrer</button>
          </form>
        </section>

        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {!loading && campaigns.length === 0 && <p className="text-neutral-500 text-sm">Aucune campagne déclarée.</p>}
        <div className="space-y-4">
          {campaigns.map((c) => <CampaignCard key={c.id} c={c} onAdd={(f) => guard(() => adminApi.addSpend(c.id, f))} onDelete={(id) => guard(() => adminApi.deleteSpend(id))} />)}
        </div>
      </div>
    </main>
  );
}

function CampaignCard({ c, onAdd, onDelete }: { c: Campaign; onAdd: (f: Record<string, unknown>) => void; onDelete: (id: number) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ spend_date: today, utm_content: '', amount: '', currency: 'EUR', impressions: '', link_clicks: '' });
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="font-medium">{c.label || c.utm_campaign} <span className="text-xs text-neutral-500">utm_campaign={c.utm_campaign} · {c.platform} · {c.status}</span></h3>
      <p className="text-xs text-neutral-400 mt-1">Dépense totale : {Number(c.total_spend).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {c.currency ?? ''}</p>
      <form className="mt-3 flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); onAdd({ ...f, amount: Number(f.amount) }); }}>
        <label className="text-xs text-neutral-500">Date<input type="date" required value={f.spend_date} onChange={(e) => setF({ ...f, spend_date: e.target.value })} className={`block ${input}`} /></label>
        <label className="text-xs text-neutral-500">utm_content (annonce, vide = campagne)<input value={f.utm_content} onChange={(e) => setF({ ...f, utm_content: e.target.value })} className={`block ${input}`} placeholder="video_01" /></label>
        <label className="text-xs text-neutral-500">Montant<input required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={`block w-24 ${input}`} /></label>
        <label className="text-xs text-neutral-500">Devise<input value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} className={`block w-16 ${input}`} /></label>
        <label className="text-xs text-neutral-500">Impressions<input inputMode="numeric" value={f.impressions} onChange={(e) => setF({ ...f, impressions: e.target.value })} className={`block w-24 ${input}`} /></label>
        <label className="text-xs text-neutral-500">Clics sur le lien (Meta)<input inputMode="numeric" value={f.link_clicks} onChange={(e) => setF({ ...f, link_clicks: e.target.value })} className={`block w-24 ${input}`} /></label>
        <button className="text-xs px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600">Ajouter / remplacer</button>
      </form>
      {c.spend.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead><tr className="text-left text-neutral-500"><th>Date</th><th>Annonce</th><th className="text-right">Montant</th><th className="text-right">Impressions</th><th className="text-right">Clics</th><th /></tr></thead>
          <tbody>
            {c.spend.map((s) => (
              <tr key={s.id} className="border-t border-neutral-800">
                <td className="py-1">{s.spend_date.slice(0, 10)}</td><td>{s.utm_content || '(campagne)'}</td>
                <td className="text-right tabular-nums">{Number(s.amount).toFixed(2)} {s.currency}</td>
                <td className="text-right tabular-nums">{s.impressions ?? '—'}</td><td className="text-right tabular-nums">{s.link_clicks ?? '—'}</td>
                <td className="text-right"><button onClick={() => onDelete(s.id)} className="text-red-400 hover:underline">Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
