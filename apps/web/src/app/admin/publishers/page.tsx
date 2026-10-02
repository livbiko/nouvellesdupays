'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import {
  adminApi, UnauthorizedError, SOURCE_TYPES, LICENSE_STATUSES,
  type AdminPublisher, type Source, type SourceTestResult,
} from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

const FEED_STATUS = ['active', 'pending', 'unavailable', 'suspended'] as const;

function ago(iso: string | null) {
  if (!iso) return 'jamais';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  if (mins < 48 * 60) return `il y a ${Math.round(mins / 60)} h`;
  return `il y a ${Math.round(mins / 1440)} j`;
}

// Health light: green = last poll OK and recent, amber = never polled /
// stale, red = currently failing, grey = not active.
function health(p: AdminPublisher): { color: string; label: string } {
  if (p.feed_status === 'suspended') return { color: 'bg-neutral-500', label: 'Suspendu' };
  if (p.feed_status !== 'active') return { color: 'bg-neutral-600', label: p.feed_status === 'pending' ? 'En attente' : 'Indisponible' };
  if ((p.error_sources ?? 0) > 0) return { color: 'bg-red-500', label: 'Erreur de collecte' };
  if (!p.last_success_at) return { color: 'bg-amber-400', label: 'Jamais collecté' };
  if (Date.now() - new Date(p.last_success_at).getTime() > 24 * 3600 * 1000) return { color: 'bg-amber-400', label: 'Pas de collecte depuis 24 h' };
  return { color: 'bg-green-500', label: 'OK' };
}

export default function AdminPublishers() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [publishers, setPublishers] = useState<AdminPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publishers.filter((p) =>
      (statusFilter === 'all' || p.feed_status === statusFilter || (statusFilter === 'errors' && (p.error_sources ?? 0) > 0)) &&
      (!q || p.name.toLowerCase().includes(q) || p.country_name.toLowerCase().includes(q) || p.homepage_url.toLowerCase().includes(q))
    );
  }, [publishers, query, statusFilter]);

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <AdminNav />

        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <label htmlFor="pub-search" className="sr-only">Rechercher</label>
          <input id="pub-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (nom, pays, URL)…"
            className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 text-sm w-64" />
          {['all', ...FEED_STATUS, 'errors'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1 rounded ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}>
              {s === 'all' ? 'Tous' : s === 'errors' ? 'En erreur' : s}
            </button>
          ))}
          <span className="text-xs text-neutral-500 ml-auto">{visible.length} éditeur(s)</span>
        </div>

        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-800">
                  <th className="py-2 pr-3">État</th>
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Pays</th>
                  <th className="py-2 pr-3">Sources</th>
                  <th className="py-2 pr-3">Dernière collecte OK</th>
                  <th className="py-2 pr-3 text-right">Articles</th>
                  <th className="py-2 pr-3 text-right" title="Clics vers l’éditeur sur 30 jours">Trafic 30 j</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Licence</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const h = health(p);
                  return (
                    <PublisherRow key={p.id} p={p} h={h} open={openId === p.id} saving={savingId === p.id}
                      onToggle={() => setOpenId(openId === p.id ? null : p.id)} onUpdate={(f) => handleUpdate(p.id, f)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function PublisherRow({
  p, h, open, saving, onToggle, onUpdate,
}: {
  p: AdminPublisher;
  h: { color: string; label: string };
  open: boolean;
  saving: boolean;
  onToggle: () => void;
  onUpdate: (fields: Partial<AdminPublisher>) => void;
}) {
  const select = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs';
  return (
    <>
      <tr className="border-b border-neutral-900 align-top">
        <td className="py-2 pr-3">
          <span className="flex items-center gap-1.5 text-xs text-neutral-400 whitespace-nowrap" title={p.last_error || h.label}>
            <span className={`w-2.5 h-2.5 rounded-full ${h.color}`} aria-hidden="true" />{h.label}
          </span>
        </td>
        <td className="py-2 pr-3">
          <a href={p.homepage_url} target="_blank" rel="noreferrer" className="hover:underline">{p.name}</a>
          {p.last_error && (p.error_sources ?? 0) > 0 && <p className="text-[11px] text-red-400 max-w-xs truncate" title={p.last_error}>{p.last_error}</p>}
        </td>
        <td className="py-2 pr-3 text-neutral-400">{p.country_name}</td>
        <td className="py-2 pr-3 text-neutral-400 text-xs">{p.feed_count} · {(p.source_types || []).filter(Boolean).join(', ') || '—'}</td>
        <td className="py-2 pr-3 text-neutral-400 text-xs whitespace-nowrap">{ago(p.last_success_at)}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{p.article_count}</td>
        <td className="py-2 pr-3 text-right tabular-nums">{p.clicks_30d}</td>
        <td className="py-2 pr-3">
          <select aria-label="Statut" value={p.feed_status} disabled={saving} className={select}
            onChange={(e) => onUpdate({ feed_status: e.target.value as AdminPublisher['feed_status'] })}>
            {FEED_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="py-2 pr-3">
          <select aria-label="Type" value={p.source_type} disabled={saving} className={select} onChange={(e) => onUpdate({ source_type: e.target.value })}>
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td className="py-2 pr-3">
          <select aria-label="Licence" value={p.license_status} disabled={saving} className={select} onChange={(e) => onUpdate({ license_status: e.target.value })}>
            {LICENSE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="py-2">
          <button onClick={onToggle} aria-expanded={open} className="text-xs text-orange-400 hover:underline whitespace-nowrap">
            {open ? 'Fermer' : 'Modifier / sources'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-neutral-800 bg-neutral-900/50">
          <td colSpan={11} className="p-4">
            <PublisherEditor p={p} onSave={onUpdate} />
            <SourcesPanel publisherId={p.id} homepage={p.homepage_url} />
          </td>
        </tr>
      )}
    </>
  );
}

function PublisherEditor({ p, onSave }: { p: AdminPublisher; onSave: (f: Partial<AdminPublisher>) => void }) {
  const fields = ['name', 'homepage_url', 'logo_url', 'region', 'city', 'youtube_url', 'facebook_url', 'x_url', 'instagram_url', 'tiktok_url'] as const;
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f, (p[f] as string | null) ?? ''])) as Record<(typeof fields)[number], string>);
  const changed = fields.filter((f) => form[f] !== ((p[f] as string | null) ?? ''));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (changed.length) onSave(Object.fromEntries(changed.map((f) => [f, form[f] || null])) as Partial<AdminPublisher>);
      }}
      className="mb-5"
    >
      <h3 className="text-sm font-semibold mb-2">Informations</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {fields.map((f) => (
          <label key={f} className="text-xs text-neutral-500">
            {f}
            <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="mt-0.5 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200" />
          </label>
        ))}
      </div>
      <button type="submit" disabled={changed.length === 0} className="mt-2 text-xs px-3 py-1.5 rounded bg-orange-500 disabled:opacity-40 text-white">
        Enregistrer {changed.length > 0 ? `(${changed.length})` : ''}
      </button>
    </form>
  );
}

function SourcesPanel({ publisherId, homepage }: { publisherId: number; homepage: string }) {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<number, SourceTestResult | 'running'>>({});
  const [newSource, setNewSource] = useState({ feed_type: 'html', feed_url: homepage });

  async function load() {
    try {
      setSources(await adminApi.sources(publisherId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisherId]);

  async function save(id: number, fields: Partial<Source>) {
    setError(null);
    try {
      await adminApi.updateSource(id, fields);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function test(id: number) {
    setTests((t) => ({ ...t, [id]: 'running' }));
    try {
      const r = await adminApi.testSource(id);
      setTests((t) => ({ ...t, [id]: r }));
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { ok: false, detail: err instanceof Error ? err.message : 'Erreur', duration_ms: 0 } }));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminApi.addSource(publisherId, newSource as Partial<Source>);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (!sources) return <p className="text-xs text-neutral-500">Chargement des sources…</p>;
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Sources & configuration de collecte</h3>
      {error && <p className="text-red-400 text-xs mb-2" role="alert">{error}</p>}
      {sources.length === 0 && <p className="text-xs text-neutral-500 mb-2">Aucune source configurée.</p>}
      <div className="space-y-3">
        {sources.map((s) => (
          <SourceEditor key={s.id} s={s} onSave={(f) => save(s.id, f)} onTest={() => test(s.id)} test={tests[s.id]} />
        ))}
      </div>
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2 items-end text-xs">
        <label className="text-neutral-500">Type
          <select value={newSource.feed_type} onChange={(e) => setNewSource({ ...newSource, feed_type: e.target.value })} className="block mt-0.5 bg-neutral-950 border border-neutral-800 rounded px-2 py-1">
            {['rss', 'atom', 'sitemap-news', 'sitemap', 'html'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-neutral-500 flex-1 min-w-60">URL
          <input value={newSource.feed_url} onChange={(e) => setNewSource({ ...newSource, feed_url: e.target.value })} className="block w-full mt-0.5 bg-neutral-950 border border-neutral-800 rounded px-2 py-1" />
        </label>
        <button className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600">Ajouter une source</button>
      </form>
    </div>
  );
}

function SourceEditor({ s, onSave, onTest, test }: { s: Source; onSave: (f: Partial<Source>) => void; onTest: () => void; test?: SourceTestResult | 'running' }) {
  const crawled = s.feed_type === 'sitemap' || s.feed_type === 'html';
  const [freq, setFreq] = useState(s.crawl_frequency_minutes?.toString() ?? '');
  const [domains, setDomains] = useState(s.allowed_domains.join(', '));
  const [cats, setCats] = useState(s.category_urls.join('\n'));
  const [patterns, setPatterns] = useState(s.article_url_patterns.join('\n'));
  const [parser, setParser] = useState(JSON.stringify(s.parser_config || {}));
  const input = 'block w-full mt-0.5 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let parserConfig: Record<string, unknown> = {};
    try {
      parserConfig = JSON.parse(parser || '{}');
    } catch {
      window.alert('parser_config doit être du JSON valide');
      return;
    }
    onSave({
      crawl_frequency_minutes: freq === '' ? null : Number(freq),
      allowed_domains: domains.split(/[\s,]+/).filter(Boolean),
      category_urls: cats.split('\n').map((x) => x.trim()).filter(Boolean),
      article_url_patterns: patterns.split('\n').map((x) => x.trim()).filter(Boolean),
      parser_config: parserConfig,
    });
  }

  return (
    <div className="rounded border border-neutral-800 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-neutral-800">{s.feed_type}</span>
        <a href={s.feed_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{s.feed_url}</a>
        <span className={`px-2 py-0.5 rounded ${s.consecutive_failures > 0 ? 'bg-red-950 text-red-300' : 'bg-neutral-800 text-neutral-400'}`}>
          {s.consecutive_failures > 0 ? `${s.consecutive_failures} échec(s)` : s.last_status || 'jamais collecté'}
        </span>
        <span className="text-neutral-500">dernier succès : {ago(s.last_success_at)} · {s.article_count} articles</span>
        <label className="flex items-center gap-1 ml-auto">
          <input type="checkbox" checked={s.enabled} onChange={(e) => onSave({ enabled: e.target.checked })} /> activée
        </label>
        <label className="flex items-center gap-1" title="Respecter robots.txt (recommandé). Ne désactiver qu’avec l’accord écrit de l’éditeur.">
          <input type="checkbox" checked={s.respect_robots_txt}
            onChange={(e) => {
              if (!e.target.checked && !window.confirm('Ignorer robots.txt uniquement avec l’accord explicite de l’éditeur. Continuer ?')) return;
              onSave({ respect_robots_txt: e.target.checked });
            }} /> robots.txt
        </label>
        <button type="button" onClick={onTest} disabled={test === 'running'} className="px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50">
          {test === 'running' ? 'Test…' : 'Tester'}
        </button>
      </div>
      {s.last_error && <p className="text-[11px] text-red-400 mt-1">Dernière erreur ({ago(s.last_error_at)}) : {s.last_error}</p>}

      <form onSubmit={submit} className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2 text-xs text-neutral-500">
        <label>Fréquence (min)
          <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder={crawled ? '60' : 'chaque passage'} inputMode="numeric" className={input} />
        </label>
        <label>Domaines autorisés
          <input value={domains} onChange={(e) => setDomains(e.target.value)} className={input} />
        </label>
        <label>Pages de rubriques
          <textarea rows={2} value={cats} onChange={(e) => setCats(e.target.value)} className={input} disabled={s.feed_type !== 'html'} />
        </label>
        <label>Motifs d’URL d’articles
          <textarea rows={2} value={patterns} onChange={(e) => setPatterns(e.target.value)} className={input} disabled={!crawled} placeholder="/article/*" />
        </label>
        <label>parser_config (JSON)
          <textarea rows={2} value={parser} onChange={(e) => setParser(e.target.value)} className={`${input} font-mono`} />
        </label>
        <div className="md:col-span-5">
          <button className="px-3 py-1.5 rounded bg-orange-500 text-white">Enregistrer la configuration</button>
        </div>
      </form>

      {test && test !== 'running' && (
        <div className={`mt-2 rounded p-2 text-xs ${test.ok ? 'bg-green-950/50 text-green-300' : 'bg-red-950/50 text-red-300'}`} role="status">
          <p>{test.ok ? '✓' : '✗'} {test.detail} ({test.duration_ms} ms)</p>
          {test.sample && test.sample.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-neutral-300">
              {test.sample.map((a) => <li key={a.link}><a href={a.link} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a></li>)}
            </ul>
          )}
          {test.log && <details className="mt-1"><summary className="cursor-pointer">Journal</summary><pre className="whitespace-pre-wrap text-neutral-400">{test.log.join('\n')}</pre></details>}
        </div>
      )}
    </div>
  );
}
