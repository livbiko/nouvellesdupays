'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi, UnauthorizedError, SOURCE_TYPES, LICENSE_STATUSES, type AdminPublisher } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

export default function AdminPublishers() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [publishers, setPublishers] = useState<AdminPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPublishers(await adminApi.publishers());
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
  }, [ready]);

  async function handleUpdate(id: number, fields: Partial<AdminPublisher>) {
    setSavingId(id);
    setPublishers((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    try {
      await adminApi.updatePublisher(id, fields);
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
            <span className="text-neutral-300 font-medium">Éditeurs</span>
          </nav>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-800">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Pays</th>
                  <th className="py-2 pr-4">Flux</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Licence</th>
                </tr>
              </thead>
              <tbody>
                {publishers.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-900">
                    <td className="py-2 pr-4">
                      <a href={p.homepage_url} target="_blank" rel="noreferrer" className="hover:underline">
                        {p.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-neutral-400">{p.country_name}</td>
                    <td className="py-2 pr-4 text-neutral-400">{p.feed_count}</td>
                    <td className="py-2 pr-4">
                      <select
                        value={p.feed_status}
                        disabled={savingId === p.id}
                        onChange={(e) => handleUpdate(p.id, { feed_status: e.target.value as AdminPublisher['feed_status'] })}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
                      >
                        <option value="active">active</option>
                        <option value="unavailable">unavailable</option>
                        <option value="pending">pending</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={p.source_type}
                        disabled={savingId === p.id}
                        onChange={(e) => handleUpdate(p.id, { source_type: e.target.value })}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
                      >
                        {SOURCE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={p.license_status}
                        disabled={savingId === p.id}
                        onChange={(e) => handleUpdate(p.id, { license_status: e.target.value })}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
                      >
                        {LICENSE_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
