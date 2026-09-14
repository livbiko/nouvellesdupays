'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, clearToken, UnauthorizedError, type Submission } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

export default function AdminDashboard() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await adminApi.submissions(status));
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
  }, [ready, status]);

  async function handleApprove(id: number) {
    setActioningId(id);
    try {
      await adminApi.approveSubmission(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'approbation');
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: number) {
    const note = window.prompt('Raison du rejet (optionnel) :') || undefined;
    setActioningId(id);
    try {
      await adminApi.rejectSubmission(id, note);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du rejet');
    } finally {
      setActioningId(null);
    }
  }

  function handleLogout() {
    clearToken();
    router.push('/admin/login');
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              NouvellesDuPays <span className="text-orange-500">Admin</span>
            </h1>
            <nav className="mt-2 flex gap-4 text-sm">
              <span className="text-neutral-300 font-medium">Soumissions</span>
              <Link href="/admin/publishers" className="text-neutral-500 hover:text-neutral-300">
                Éditeurs
              </Link>
              <Link href="/admin/invitations" className="text-neutral-500 hover:text-neutral-300">
                Invitations
              </Link>
              <Link href="/admin/editorial" className="text-neutral-500 hover:text-neutral-300">
                Contexte éditorial
              </Link>
            </nav>
          </div>
          <button onClick={handleLogout} className="text-sm text-neutral-500 hover:text-neutral-300">
            Déconnexion
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1 rounded ${
                status === s ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {!loading && submissions.length === 0 && (
          <p className="text-neutral-500 text-sm">Aucune soumission {status !== 'all' ? `"${status}"` : ''}.</p>
        )}

        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {s.name} <span className="text-neutral-500 text-sm">({s.country_name}, {s.language})</span>
                  </p>
                  <a href={s.homepage_url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline">
                    {s.homepage_url}
                  </a>
                  <p className="text-xs text-neutral-500 mt-1">
                    Flux ({s.feed_type}) : <span className="text-neutral-400">{s.feed_url}</span>
                  </p>
                  {s.contact_email && <p className="text-xs text-neutral-500">Contact : {s.contact_email}</p>}
                  {s.verification_detail && (
                    <p className="text-xs text-neutral-600 mt-1 italic">{s.verification_detail}</p>
                  )}
                  {s.reviewer_note && (
                    <p className="text-xs text-red-400 mt-1">Note : {s.reviewer_note}</p>
                  )}
                  <p className="text-xs text-neutral-600 mt-1">
                    Soumis le {new Date(s.submitted_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                {s.status === 'pending' && (
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={actioningId === s.id}
                      className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
                    >
                      Approuver
                    </button>
                    <button
                      onClick={() => handleReject(s.id)}
                      disabled={actioningId === s.id}
                      className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
                {s.status !== 'pending' && (
                  <span
                    className={`text-xs px-2 py-1 rounded shrink-0 ml-4 ${
                      s.status === 'approved' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                    }`}
                  >
                    {s.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
