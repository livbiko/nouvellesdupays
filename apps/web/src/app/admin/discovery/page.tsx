'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type DiscoveredSource, type DiscoverySummary } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Review queue of the media discovery worker (apps/worker/src/discover.js).
// "Promouvoir" only creates a submission: it still has to be approved on the
// Soumissions page before anything is polled or shown publicly.
const REGIONS = ['West Africa', 'East Africa', 'Central Africa', 'North Africa', 'Southern Africa'];
const HEALTH_LABEL: Record<DiscoveredSource['health'], string> = {
  unchecked: 'non vérifié', ok: 'OK', unreachable: 'injoignable', dead: 'mort',
  blocked_by_robots: 'bloqué (robots.txt)', spam_suspect: 'spam / piraté', not_news: 'pas un site d’actualité',
};
const STATUS_LABEL: Record<DiscoveredSource['status'], string> = {
  discovered: 'découvert', under_review: 'à examiner', verified: 'promu', contacted: 'contacté',
  invited: 'invité', registered: 'inscrit', rejected: 'rejeté',
};
const ORIENTATIONS = ['unknown', 'public', 'state_affiliated', 'commercial', 'independent', 'political', 'community', 'religious', 'investigative'];
const SOURCE_TYPES = ['ONLINE_NEWS', 'NEWSPAPER', 'NEWS_AGENCY', 'TV', 'RADIO', 'MAGAZINE', 'INVESTIGATIVE', 'BLOG', 'JOURNALIST',
  'GOVERNMENT', 'SPORTS', 'FINANCIAL', 'TECHNOLOGY', 'OTHER'];
const SOCIALS: [keyof DiscoveredSource, string][] = [
  ['youtube_url', 'YouTube'], ['facebook_url', 'Facebook'], ['x_url', 'X'], ['instagram_url', 'Instagram'], ['tiktok_url', 'TikTok'],
];

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export default function DiscoveryPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [region, setRegion] = useState('West Africa');
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [items, setItems] = useState<DiscoveredSource[] | null>(null);
  const [filters, setFilters] = useState({ status: 'under_review', country: '', health: '', has_feed: '', q: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newCountry, setNewCountry] = useState('');

  function fail(err: unknown) {
    if (err instanceof UnauthorizedError) router.push('/admin/login');
    else setError(err instanceof Error ? err.message : 'Erreur');
  }

  async function load() {
    setError(null);
    const qs = new URLSearchParams({ region, limit: '200' });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    try {
      const [s, list] = await Promise.all([adminApi.discoverySummary(region), adminApi.discovered(qs.toString())]);
      setSummary(s);
      setItems(list);
    } catch (err) {
      fail(err);
    }
  }
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, region, filters]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setNotice(null);
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      fail(err);
    }
  }

  if (!ready) return null;
  const t = summary?.totals;
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {notice && <p className="text-green-400 text-sm mb-4" role="status">{notice}</p>}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Découverte de médias</h2>
          <select aria-label="Région" value={region} onChange={(e) => { setRegion(e.target.value); setFilters({ ...filters, country: '' }); }}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm">
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {t && (
          <p className="text-xs text-neutral-400 mb-4">
            {t.candidates} candidats · {t.healthy} OK · {t.with_feed} avec flux · {t.without_feed} sans flux (crawl) · {t.failing} en échec · {t.spam} spam ·
            {' '}{t.with_youtube} YouTube · {t.with_facebook} Facebook · {t.with_tiktok} TikTok —
            {' '}{t.publishers_mined} éditeurs explorés, dernière exploration {fmtDate(t.last_mined_at)}, dernière vérification {fmtDate(t.last_checked_at)}
          </p>
        )}

        {summary && (
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-1.5 pr-3">Pays</th><th className="pr-3">Éditeurs en ligne</th><th className="pr-3">Candidats</th>
                <th className="pr-3">À examiner</th><th className="pr-3">dont avec flux</th><th className="pr-3">Non vérifiés</th>
                <th className="pr-3">Promus</th><th className="pr-3">Rejetés</th>
              </tr></thead>
              <tbody>
                {summary.countries.map((c) => (
                  <tr key={c.iso_code} className={`border-b border-neutral-900 cursor-pointer hover:bg-neutral-900 ${filters.country === c.iso_code ? 'bg-neutral-900' : ''}`}
                    onClick={() => setFilters({ ...filters, country: filters.country === c.iso_code ? '' : c.iso_code })}>
                    <td className="py-1.5 pr-3">{c.name}</td>
                    <td className={`pr-3 ${c.live_publishers < 5 ? 'text-orange-400' : ''}`}>{c.live_publishers}</td>
                    <td className="pr-3">{c.candidates}</td><td className="pr-3">{c.to_review}</td><td className="pr-3">{c.to_review_with_feed}</td>
                    <td className="pr-3">{c.unchecked}</td><td className="pr-3">{c.promoted}</td><td className="pr-3">{c.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="flex flex-wrap gap-2 mb-6 text-sm" onSubmit={(e) => {
          e.preventDefault();
          act(() => adminApi.addDiscovered({ url: newUrl, country_iso: newCountry || undefined }), 'Site ajouté : il sera vérifié au prochain passage.');
          setNewUrl('');
        }}>
          <input aria-label="URL du site" placeholder="https://site-d-actualite.ci" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 flex-1 min-w-[14rem]" />
          <input aria-label="Code pays" placeholder="CI" maxLength={2} value={newCountry} onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 w-16" />
          <button className="bg-orange-600 hover:bg-orange-500 rounded px-3 py-1">Ajouter un site</button>
        </form>

        <div className="flex flex-wrap gap-2 mb-4 text-sm">
          <select aria-label="Statut" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
            <option value="">tous statuts</option><option value="open">ouverts</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="État technique" value={filters.health} onChange={(e) => setFilters({ ...filters, health: e.target.value })}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
            <option value="">tous états</option>
            {Object.entries(HEALTH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Flux" value={filters.has_feed} onChange={(e) => setFilters({ ...filters, has_feed: e.target.value })}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
            <option value="">avec ou sans flux</option><option value="true">avec flux</option><option value="false">sans flux</option>
          </select>
          <input aria-label="Recherche" placeholder="nom ou domaine" defaultValue={filters.q}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilters({ ...filters, q: (e.target as HTMLInputElement).value }); }}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1" />
          {filters.country && <button type="button" className="text-neutral-400 underline" onClick={() => setFilters({ ...filters, country: '' })}>pays : {filters.country} ✕</button>}
        </div>

        {!items && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {items && items.length === 0 && <p className="text-neutral-500 text-sm">Aucun candidat pour ces filtres.</p>}
        <div className="space-y-2">
          {items?.map((s) => (
            <div key={s.id} className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {s.name} <a href={s.homepage_url} target="_blank" rel="noopener noreferrer nofollow" className="text-orange-400 text-xs">{s.domain} ↗</a>
                  </p>
                  <p className="text-xs text-neutral-400">
                    {s.country_name ?? 'pays ?'} · {s.language ?? s.html_lang ?? 'langue ?'} · {STATUS_LABEL[s.status]} · {HEALTH_LABEL[s.health]}
                    {s.flags.length > 0 && <> · {s.flags.join(', ')}</>}
                  </p>
                </div>
                <p className="text-right">
                  <span className="text-lg font-semibold">{s.score ?? '—'}</span>
                  <span className="text-xs text-neutral-500"> /100 {s.score_band ?? ''}</span>
                </p>
              </div>
              {s.description && <p className="text-xs text-neutral-300 mt-1">{s.description}</p>}
              <p className="text-xs text-neutral-400 mt-1">
                {s.feed_url
                  ? <>Flux {s.feed_type} : <a href={s.feed_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">{s.feed_url}</a> · {s.item_count} articles · dernier {fmtDate(s.latest_item_at)}</>
                  : <>Pas de flux{s.sitemap_url ? ' (sitemap disponible)' : ''} — intégration par crawl · {s.article_link_count ?? 0} liens d’articles en page d’accueil</>}
              </p>
              <p className="text-xs text-neutral-400 mt-1 flex flex-wrap gap-x-3">
                {SOCIALS.filter(([k]) => s[k]).map(([k, label]) => (
                  <a key={k} href={String(s[k])} target="_blank" rel="noopener noreferrer nofollow" className="underline">{label}</a>
                ))}
                <span>trouvé via {s.discovery_method}{s.discovered_from ? ` (${s.discovered_from})` : ''}, vu {s.times_seen}×</span>
                <span>vérifié {fmtDate(s.last_checked_at)}</span>
                {s.last_error && <span className="text-red-400">{s.last_error}</span>}
              </p>
              {s.score_breakdown && (
                <p className="text-[11px] text-neutral-500 mt-1">{Object.entries(s.score_breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
              )}
              {s.notes && <p className="text-xs text-neutral-500 mt-1 whitespace-pre-line">{s.notes}</p>}

              {['discovered', 'under_review', 'rejected'].includes(s.status) && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  {s.status !== 'rejected' && (
                    <>
                      <select aria-label="Type" value={s.source_type ?? ''} onChange={(e) => act(() => adminApi.updateDiscovered(s.id, { source_type: e.target.value }), 'Type enregistré.')}
                        className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5">
                        <option value="" disabled>type ?</option>
                        {SOURCE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <select aria-label="Orientation éditoriale" value={s.editorial_orientation} onChange={(e) => act(() => adminApi.updateDiscovered(s.id, { editorial_orientation: e.target.value }), 'Orientation enregistrée.')}
                        className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5">
                        {ORIENTATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <select aria-label="Organisation ou personne" value={s.creator_kind} onChange={(e) => act(() => adminApi.updateDiscovered(s.id, { creator_kind: e.target.value }), 'Enregistré.')}
                        className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5">
                        <option value="organisation">organisation</option><option value="individual">personne (blogueur/journaliste)</option>
                      </select>
                      {!s.iso_code && (
                        <input aria-label="Code pays" placeholder="pays (CI)" maxLength={2} className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 w-20"
                          onKeyDown={(e) => { if (e.key === 'Enter') act(() => adminApi.updateDiscovered(s.id, { country_iso: (e.target as HTMLInputElement).value }), 'Pays enregistré.'); }} />
                      )}
                      {!s.language && (
                        <input aria-label="Langue" placeholder="langue (fr)" maxLength={3} defaultValue={s.html_lang ?? ''} className="bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 w-20"
                          onKeyDown={(e) => { if (e.key === 'Enter') act(() => adminApi.updateDiscovered(s.id, { language: (e.target as HTMLInputElement).value.toLowerCase() }), 'Langue enregistrée.'); }} />
                      )}
                      <button className="bg-green-700 hover:bg-green-600 rounded px-2 py-0.5"
                        onClick={() => act(async () => {
                          const r = await adminApi.promoteDiscovered(s.id);
                          setNotice(`Soumission #${r.submission_id} créée (${r.submission_status}, ${r.ingestion_method}) — à approuver dans Soumissions.`);
                        }, '')}>
                        Promouvoir → soumission
                      </button>
                      <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5"
                        onClick={() => {
                          const note = window.prompt('Raison du rejet (optionnel)') ?? undefined;
                          act(() => adminApi.updateDiscovered(s.id, { status: 'rejected', ...(note ? { notes: note } : {}) }), 'Rejeté.');
                        }}>
                        Rejeter
                      </button>
                    </>
                  )}
                  <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5" onClick={() => act(() => adminApi.recheckDiscovered(s.id), 'Re-vérification programmée (prochain passage horaire).')}>
                    Re-vérifier
                  </button>
                </div>
              )}
              {s.promoted_submission_id && <p className="text-xs text-green-400 mt-1">Soumission #{s.promoted_submission_id}</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
