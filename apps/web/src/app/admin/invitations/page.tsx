'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, UnauthorizedError, INVITATION_STATUSES, type Invitation } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

const STATUS_STYLES: Record<Invitation['status'], string> = {
  drafted: 'bg-neutral-800 text-neutral-400',
  awaiting_approval: 'bg-neutral-800 text-neutral-400',
  approved: 'bg-neutral-800 text-neutral-400',
  sent: 'bg-blue-900 text-blue-300',
  opened: 'bg-yellow-900 text-yellow-300',
  replied: 'bg-green-900 text-green-300',
  bounced: 'bg-red-900 text-red-300',
  opted_out: 'bg-red-900 text-red-300',
  rejected_by_reviewer: 'bg-red-900 text-red-300',
};

export default function AdminInvitations() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [filter, setFilter] = useState<string>('sent');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setInvitations(await adminApi.invitations(filter));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.push('/admin/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filter]);

  async function handleStatusChange(id: number, status: Invitation['status']) {
    setSavingId(id);
    setInvitations((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await adminApi.updateInvitationStatus(id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la mise à jour');
      await load(); // revert optimistic update on failure
    } finally {
      setSavingId(null);
    }
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            NouvellesDuPays <span className="text-orange-500">Admin</span>
          </h1>
          <nav className="mt-2 flex gap-4 text-sm">
            <Link href="/admin" className="text-neutral-500 hover:text-neutral-300">
              Soumissions
            </Link>
            <Link href="/admin/publishers" className="text-neutral-500 hover:text-neutral-300">
              Éditeurs
            </Link>
            <span className="text-neutral-300 font-medium">Invitations</span>
          </nav>
        </div>

        <div className="flex gap-2 mb-4">
          {(['sent', 'opened', 'replied', 'bounced', 'opted_out', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1 rounded ${
                filter === s ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {!loading && invitations.length === 0 && (
          <p className="text-neutral-500 text-sm">Aucune invitation {filter !== 'all' ? `"${filter}"` : ''}.</p>
        )}

        <div className="space-y-3">
          {invitations.map((inv) => (
            <div key={inv.id} className="rounded border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {inv.source_name}{' '}
                    <span className="text-neutral-500 text-sm">
                      ({inv.country_name || '—'}, {inv.channel})
                    </span>
                  </p>
                  <a href={inv.homepage_url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline">
                    {inv.homepage_url}
                  </a>
                  {inv.subject && <p className="text-xs text-neutral-400 mt-1">{inv.subject}</p>}
                  {inv.sent_at && (
                    <p className="text-xs text-neutral-600 mt-1">
                      Envoyé le {new Date(inv.sent_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    className="text-xs text-neutral-500 hover:text-neutral-300 mt-1 underline"
                  >
                    {expandedId === inv.id ? 'Masquer le message' : 'Voir le message'}
                  </button>
                  {expandedId === inv.id && inv.body && (
                    <pre className="text-xs text-neutral-400 mt-2 whitespace-pre-wrap bg-neutral-950 border border-neutral-800 rounded p-3">
                      {inv.body}
                    </pre>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                  <select
                    value={inv.status}
                    disabled={savingId === inv.id}
                    onChange={(e) => handleStatusChange(inv.id, e.target.value as Invitation['status'])}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
                  >
                    {INVITATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
