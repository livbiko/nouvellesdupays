'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type ContactMessage, type Lead } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Personal data (emails) -- admin only, never exported with analytics.
export default function LeadsPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [l, m] = await Promise.all([adminApi.leads(), adminApi.contactMessages()]);
      setLeads(l);
      setMessages(m);
    } catch (err) {
      if (err instanceof UnauthorizedError) router.push('/admin/login');
      else setError(err instanceof Error ? err.message : 'Erreur');
    }
  }
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        <h2 className="text-lg font-semibold mb-3">Inscriptions ({leads?.length ?? '…'})</h2>
        {!leads && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {leads && leads.length === 0 && <p className="text-neutral-500 text-sm">Aucune inscription.</p>}
        {leads && leads.length > 0 && (
          <div className="overflow-x-auto mb-10">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-1.5 pr-3">Date</th><th className="pr-3">Email</th><th className="pr-3">Prénom</th><th className="pr-3">Pays</th>
                <th className="pr-3">Intérêts</th><th className="pr-3">Newsletter</th><th className="pr-3">Page</th><th className="pr-3">Campagne</th><th className="pr-3">Annonce</th>
              </tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-neutral-900">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                    <td className="pr-3">{l.email}</td><td className="pr-3">{l.name ?? '—'}</td><td className="pr-3">{l.country_name ?? '—'}</td>
                    <td className="pr-3">{l.interests.join(', ') || '—'}</td><td className="pr-3">{l.marketing_consent ? 'oui' : 'non'}</td>
                    <td className="pr-3">{l.source_page ?? '—'}</td>
                    <td className="pr-3">{l.utm_campaign ?? (l.utm_source ? `(${l.utm_source})` : '—')}</td><td className="pr-3">{l.utm_content ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3">Messages de contact</h2>
        {messages && messages.length === 0 && <p className="text-neutral-500 text-sm">Aucun message.</p>}
        <div className="space-y-2">
          {messages?.map((m) => (
            <div key={m.id} className={`rounded border p-3 text-sm ${m.status === 'new' ? 'border-orange-500/40 bg-neutral-900' : 'border-neutral-800 bg-neutral-900/50'}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{m.subject || '(sans sujet)'} <span className="text-xs text-neutral-500">— {m.name} &lt;{m.email}&gt; · {new Date(m.created_at).toLocaleString('fr-FR')}</span></p>
                <select aria-label="Statut" value={m.status} onChange={async (e) => { await adminApi.updateContactMessage(m.id, e.target.value as ContactMessage['status']); load(); }}
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-xs">
                  <option value="new">nouveau</option><option value="read">lu</option><option value="archived">archivé</option>
                </select>
              </div>
              <p className="text-neutral-300 mt-1 whitespace-pre-line">{m.message}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
