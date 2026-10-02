'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type Submission } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Publisher submissions. Workflow:
//   SUBMITTED (feed-less, unreviewed) -> PENDING REVIEW -> APPROVED -> ACTIVE
//   + REJECTED / SUSPENDED
// Feed-based submissions arrive already PENDING (their feed was verified
// automatically) and go live as soon as they are approved, as before.
const FILTERS = [
  ['open', 'À traiter'],
  ['submitted', 'Soumis'],
  ['pending', 'En revue'],
  ['approved', 'Approuvés'],
  ['active', 'Actifs'],
  ['suspended', 'Suspendus'],
  ['rejected', 'Rejetés'],
  ['all', 'Tous'],
] as const;

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-950 text-sky-300 border-sky-800',
  pending: 'bg-amber-950 text-amber-300 border-amber-800',
  approved: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  active: 'bg-green-900 text-green-200 border-green-700',
  rejected: 'bg-red-950 text-red-300 border-red-800',
  suspended: 'bg-neutral-800 text-neutral-300 border-neutral-600',
};
const STATUS_LABEL: Record<string, string> = {
  submitted: 'SOUMIS', pending: 'EN REVUE', approved: 'APPROUVÉ', active: 'ACTIF', rejected: 'REJETÉ', suspended: 'SUSPENDU',
};

export default function AdminDashboard() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [status, setStatus] = useState<(typeof FILTERS)[number][0]>('open');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  async function act(id: number, action: 'review' | 'approve' | 'reject' | 'activate' | 'suspend') {
    let note: string | undefined;
    if (action === 'reject' || action === 'suspend') {
      const answer = window.prompt(action === 'reject' ? 'Raison du rejet (optionnel) :' : 'Raison de la suspension (optionnel) :');
      if (answer === null) return;
      note = answer || undefined;
    }
    setActioningId(id);
    setError(null);
    setNotice(null);
    try {
      if (action === 'approve') {
        const r = await adminApi.approveSubmission(id);
        setNotice(r.live === false
          ? 'Approuvé. Configurez la source dans « Éditeurs » puis activez-la pour démarrer la collecte.'
          : 'Approuvé et en ligne.');
      } else if (action === 'reject') {
        await adminApi.rejectSubmission(id, note);
      } else {
        await adminApi.submissionAction(id, action, note);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible');
    } finally {
      setActioningId(null);
    }
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <AdminNav />

        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filtrer par statut">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={`text-xs px-3 py-1 rounded ${status === value ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && <p className="text-green-400 text-sm mb-4" role="status">{notice}</p>}
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {!loading && submissions.length === 0 && <p className="text-neutral-500 text-sm">Aucune soumission dans cette vue.</p>}

        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium flex flex-wrap items-center gap-2">
                    {s.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      {s.feed_url ? `flux ${s.feed_type}` : `sans flux · ${s.ingestion_method}`}
                    </span>
                  </p>
                  <p className="text-neutral-500 text-sm">{[s.country_name, s.region, s.city, s.language].filter(Boolean).join(' · ')}</p>
                  <a href={s.homepage_url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline break-all">{s.homepage_url}</a>
                  {s.description && <p className="text-xs text-neutral-400 mt-1">{s.description}</p>}
                  {s.categories?.length > 0 && <p className="text-xs text-neutral-500 mt-1">Rubriques : {s.categories.join(', ')}</p>}
                  {s.feed_url && <p className="text-xs text-neutral-500 mt-1">Flux : <span className="text-neutral-400 break-all">{s.feed_url}</span></p>}
                  {s.sitemap_url && <p className="text-xs text-neutral-500 mt-1">Sitemap : <span className="text-neutral-400 break-all">{s.sitemap_url}</span></p>}
                  {s.api_url && <p className="text-xs text-neutral-500 mt-1">API : <span className="text-neutral-400 break-all">{s.api_url}</span></p>}
                  {s.category_urls?.length > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">Rubriques à explorer : <span className="text-neutral-400 break-all">{s.category_urls.join(' · ')}</span></p>
                  )}
                  {s.article_url_patterns?.length > 0 && <p className="text-xs text-neutral-500 mt-1">Motifs d’URL : <code className="text-neutral-400">{s.article_url_patterns.join('  ')}</code></p>}
                  <p className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-2">
                    {[['YouTube', s.youtube_url], ['Facebook', s.facebook_url], ['X', s.x_url], ['Instagram', s.instagram_url], ['TikTok', s.tiktok_url], ['Logo', s.logo_url]]
                      .filter(([, u]) => u)
                      .map(([label, u]) => <a key={label} href={u!} target="_blank" rel="noreferrer" className="underline hover:text-neutral-300">{label}</a>)}
                  </p>
                  {(s.contact_name || s.contact_email) && (
                    <p className="text-xs text-neutral-500 mt-1">Contact : {[s.contact_name, s.contact_email].filter(Boolean).join(' — ')}</p>
                  )}
                  <p className="text-xs text-neutral-600 mt-1">
                    Autorisation confirmée : {s.permission_confirmed ? 'oui' : 'non (ancienne soumission)'} · Soumis le {new Date(s.submitted_at).toLocaleString('fr-FR')}
                  </p>
                  {s.verification_detail && <p className="text-xs text-neutral-600 mt-1 italic">{s.verification_detail}</p>}
                  {s.reviewer_note && <p className="text-xs text-red-400 mt-1">Note : {s.reviewer_note}</p>}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {s.status === 'submitted' && <Action onClick={() => act(s.id, 'review')} busy={actioningId === s.id} tone="neutral">Mettre en revue</Action>}
                  {(s.status === 'submitted' || s.status === 'pending') && <Action onClick={() => act(s.id, 'approve')} busy={actioningId === s.id} tone="green">Approuver</Action>}
                  {(s.status === 'approved' || s.status === 'suspended') && <Action onClick={() => act(s.id, 'activate')} busy={actioningId === s.id} tone="green">Activer</Action>}
                  {(s.status === 'approved' || s.status === 'active') && <Action onClick={() => act(s.id, 'suspend')} busy={actioningId === s.id} tone="neutral">Suspendre</Action>}
                  {(s.status === 'submitted' || s.status === 'pending') && <Action onClick={() => act(s.id, 'reject')} busy={actioningId === s.id} tone="red">Rejeter</Action>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Action({ onClick, busy, tone, children }: { onClick: () => void; busy: boolean; tone: 'green' | 'red' | 'neutral'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    neutral: 'bg-neutral-700 hover:bg-neutral-600 text-neutral-100',
  };
  return (
    <button onClick={onClick} disabled={busy} className={`text-xs px-3 py-1.5 rounded disabled:opacity-50 ${tones[tone]}`}>
      {children}
    </button>
  );
}
