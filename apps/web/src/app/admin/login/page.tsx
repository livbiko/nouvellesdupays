'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminApi.login(password);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold tracking-tight">
          NouvellesDuPays <span className="text-orange-500">Admin</span>
        </h1>
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Mot de passe</label>
          <input
            required
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 text-sm"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </main>
  );
}
