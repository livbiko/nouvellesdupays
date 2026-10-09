'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { BarList, Funnel, StatTile, TrendChart } from '@/components/admin/Charts';
import VisitorsSection from '@/components/admin/VisitorsSection';
import { adminApi, UnauthorizedError, type Dashboard, type FilterOptions } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

const RANGES = [
  ['today', 'Aujourd’hui'], ['yesterday', 'Hier'], ['7d', '7 jours'], ['30d', '30 jours'], ['90d', '90 jours'], ['custom', 'Personnalisé'],
] as const;

const CHANNEL_LABELS: Record<string, string> = {
  paid_social: 'Social payant', organic_social: 'Social organique', paid_search: 'Recherche payante',
  organic_search: 'Recherche organique', email: 'Email', referral: 'Sites référents', direct: 'Direct', other: 'Autre',
};

type Filters = Record<string, string>;

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('fr-FR'));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR')} %`);
const money = (n: number | null | undefined, cur: string | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur ?? ''}`;

export default function AnalyticsDashboard() {
  const router = useRouter();
  const ready = useAdminGuard();
  const tz = useMemo(() => (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'), []);
  const [filters, setFilters] = useState<Filters>({ range: '7d' });
  const [scope, setScope] = useState<'facebook' | 'all'>('facebook');
  const [data, setData] = useState<Dashboard | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportSet, setExportSet] = useState('events');

  const qs = useMemo(() => {
    const p = new URLSearchParams({ tz });
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    return p.toString();
  }, [filters, tz]);

  useEffect(() => {
    if (!ready) return;
    if (filters.range === 'custom' && (!filters.from || !filters.to)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi.dashboard(`${qs}&funnel_scope=${scope}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (err instanceof UnauthorizedError) router.push('/admin/login');
        else if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [ready, qs, scope, filters.range, filters.from, filters.to, router]);

  useEffect(() => {
    if (ready) adminApi.filterOptions(`range=90d&tz=${encodeURIComponent(tz)}`).then(setOptions).catch(() => setOptions(null));
  }, [ready, tz]);

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const activeFilters = Object.entries(filters).filter(([k, v]) => v && !['range', 'from', 'to', 'include_debug'].includes(k));

  async function doExport(format: 'csv' | 'json') {
    try {
      await adminApi.download(`${qs}&dataset=${exportSet}&format=${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export échoué');
    }
  }

  if (!ready) return null;
  const t = data?.overview.totals;
  const sel = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs max-w-44';

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <AdminNav />

        {/* Filters: one row above the charts */}
        <section aria-label="Filtres" className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 mb-6 space-y-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {RANGES.map(([v, l]) => (
              <button key={v} onClick={() => set('range', v)} aria-pressed={filters.range === v}
                className={`text-xs px-3 py-1 rounded ${filters.range === v ? 'bg-orange-500 text-white' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}>{l}</button>
            ))}
            {filters.range === 'custom' && (
              <>
                <label className="text-xs text-neutral-500 ml-2">Du <input type="date" value={filters.from || ''} onChange={(e) => set('from', e.target.value)} className={sel} /></label>
                <label className="text-xs text-neutral-500">au <input type="date" value={filters.to || ''} onChange={(e) => set('to', e.target.value)} className={sel} /></label>
              </>
            )}
            <span className="text-[11px] text-neutral-500 ml-auto">Fuseau : {tz}</span>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <FilterSelect label="Pays" value={filters.country} onChange={(v) => set('country', v)} options={options?.countries.map((c) => [c.iso_code, c.name]) ?? []} />
            <FilterSelect label="Campagne" value={filters.campaign} onChange={(v) => set('campaign', v)} options={options?.campaigns.map((c) => [c, c]) ?? []} />
            <FilterSelect label="Source" value={filters.source} onChange={(v) => set('source', v)} options={options?.sources.map((c) => [c, c]) ?? []} />
            <FilterSelect label="Medium" value={filters.medium} onChange={(v) => set('medium', v)} options={options?.mediums.map((c) => [c, c]) ?? []} />
            <FilterSelect label="Page d’arrivée" value={filters.landing_page} onChange={(v) => set('landing_page', v)} options={options?.landing_pages.map((c) => [c, c]) ?? []} />
            <FilterSelect label="Éditeur" value={filters.publisher_id} onChange={(v) => set('publisher_id', v)} options={options?.publishers.map((p) => [String(p.id), p.name]) ?? []} />
            <FilterSelect label="Chaîne YouTube" value={filters.channel_id} onChange={(v) => set('channel_id', v)} options={options?.youtube_channels.map((c) => [String(c.id), c.name || c.channel_url]) ?? []} />
            <FilterSelect label="Vidéo" value={filters.video_id} onChange={(v) => set('video_id', v)} options={options?.youtube_videos.map((v) => [String(v.id), v.slug]) ?? []} />
            <label className="text-xs text-neutral-500 flex items-center gap-1">
              <input type="checkbox" checked={filters.include_debug === '1'} onChange={(e) => set('include_debug', e.target.checked ? '1' : '')} /> inclure le trafic de test
            </label>
            {activeFilters.length > 0 && (
              <button onClick={() => setFilters({ range: filters.range, from: filters.from || '', to: filters.to || '' })} className="text-xs text-orange-400 hover:underline">
                Effacer les filtres ({activeFilters.length})
              </button>
            )}
          </div>
        </section>

        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {loading && !data && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {filters.range === 'custom' && (!filters.from || !filters.to) && <p className="text-neutral-500 text-sm mb-4">Choisissez une date de début et de fin.</p>}

        {data && t && (
          <div className={loading ? 'opacity-60 transition-opacity' : ''} aria-busy={loading}>
            <section aria-labelledby="overview" className="mb-8">
              <h2 id="overview" className="text-lg font-semibold mb-3">Vue d’ensemble</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatTile label="Visiteurs (total)" value={num(t.total_visitors)} hint="Visiteurs uniques par jour, additionnés" />
                <StatTile label="Visiteurs uniques" value={num(t.unique_visitors)} />
                <StatTile label="Sessions" value={num(t.sessions)} />
                <StatTile label="Pages vues" value={num(t.page_views)} />
                <StatTile label="Visiteurs Facebook" value={num(t.facebook_visitors)} hint={`${num(t.ad_visitors)} via publicité · ${num(t.organic_visitors)} organiques (tous canaux)`} />
                <StatTile label="Visiteurs YouTube" value={num(t.youtube_visitors)} hint="Pages vidéo ou interactions vidéo" />
                <StatTile label="Leads" value={num(t.leads)} hint="Inscriptions + soumissions + contacts" />
                <StatTile label="Inscriptions" value={num(t.registrations)} hint={`${num(data.overview.table_totals.registrations_all)} au total (y c. sans consentement)`} />
                <StatTile label="Taux de conversion" value={pct(t.conversion_rate)} hint="Inscriptions / visiteurs uniques" />
                <StatTile label="Clics" value={num(t.clicks)} hint={`${num(t.landing_page_views)} pages d’arrivée`} />
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">
                Les mesures de parcours ne couvrent que les visiteurs ayant accepté la mesure d’audience.
              </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <section aria-labelledby="trend" className="lg:col-span-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h2 id="trend" className="text-sm font-semibold mb-2">Visiteurs par jour</h2>
                <TrendChart series={['Visiteurs', 'Facebook']}
                  data={data.overview.timeseries.map((d) => ({ label: d.day, values: [d.visitors, d.facebook_visitors] }))} />
              </section>
              <section aria-labelledby="channels" className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <h2 id="channels" className="text-sm font-semibold mb-3">Sessions par canal</h2>
                <BarList rows={data.overview.channels.map((c) => ({ label: CHANNEL_LABELS[c.channel] || c.channel, value: c.sessions }))} />
              </section>
            </div>

            <section aria-labelledby="funnel" className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-8">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 id="funnel" className="text-sm font-semibold">Entonnoir de conversion</h2>
                <div className="flex gap-1">
                  {(['facebook', 'all'] as const).map((s) => (
                    <button key={s} onClick={() => setScope(s)} aria-pressed={scope === s}
                      className={`text-xs px-3 py-1 rounded ${scope === s ? 'bg-neutral-700 text-white' : 'text-neutral-400 border border-neutral-800'}`}>
                      {s === 'facebook' ? 'Trafic Facebook' : 'Tout le trafic'}
                    </button>
                  ))}
                </div>
              </div>
              <Funnel stages={data.funnel.stages} />
              <p className="text-[11px] text-neutral-500 mt-3">
                Entonnoir fermé : chaque étape ne compte que les sessions ayant franchi toutes les précédentes.
                {' '}{num(data.funnel.completed_any_path)} session(s) ont terminé une inscription par n’importe quel chemin.
              </p>
            </section>

            {data.visitors && <VisitorsSection data={data.visitors} />}

            <Section title="Performance des campagnes Facebook (par annonce)">
              <Table
                head={['Campagne', 'Source', 'Medium', 'Contenu', 'Visiteurs', 'Pages d’arrivée', 'Clics', 'Inscriptions', 'Conversion', 'Dépense', 'Coût / lead']}
                rows={data.campaigns.ads.map((r) => [r.campaign ?? '—', r.source ?? '—', r.medium ?? '—', r.content ?? '—', num(r.visitors), num(r.landing_page_views), num(r.clicks), num(r.registrations), pct(r.conversion_rate), money(r.spend, r.currency), money(r.cost_per_lead, r.currency)])}
                numeric={[4, 5, 6, 7, 8, 9, 10]}
                empty="Aucun trafic de campagne (UTM) sur la période."
              />
              {data.campaigns.campaigns.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-neutral-400 mt-5 mb-2">Totaux par campagne</h3>
                  <Table
                    head={['Campagne', 'Visiteurs', 'Clics Meta', 'Inscriptions', 'Leads', 'Conversion', 'Dépense', 'Coût / lead', 'Coût / inscription']}
                    rows={data.campaigns.campaigns.map((r) => [r.campaign ?? '—', num(r.visitors), num(r.link_clicks), num(r.registrations), num(r.leads), pct(r.conversion_rate), money(r.spend, r.currency), money(r.cost_per_lead, r.currency), money(r.cost_per_registration, r.currency)])}
                    numeric={[1, 2, 3, 4, 5, 6, 7, 8]}
                    empty=""
                  />
                </>
              )}
            </Section>

            <Section title="Pages d’arrivée">
              <Table
                head={['Page', 'Visiteurs', 'Clics YouTube', 'Inscriptions commencées', 'Inscriptions terminées', 'Conversion']}
                rows={data.landing_pages.map((r) => [r.landing_page, num(r.visitors), num(r.youtube_clicks), num(r.registration_starts), num(r.registrations), pct(r.conversion_rate)])}
                numeric={[1, 2, 3, 4, 5]}
                empty="Aucune page d’arrivée sur la période."
              />
            </Section>

            <Section title="Performance YouTube">
              <Table
                head={['Vidéo', 'Chaîne', 'Vues page', 'Lectures', 'Clics', 'Sorties YouTube', 'Partages', 'Inscriptions', 'Conversion']}
                rows={data.youtube.map((r) => [r.slug, r.channel_name ?? '—', num(r.views), num(r.plays), num(r.clicks), num(r.outbound_clicks), num(r.shares), num(r.registrations), pct(r.conversion_rate)])}
                numeric={[2, 3, 4, 5, 6, 7, 8]}
                empty="Aucune vue de page vidéo sur la période."
              />
            </Section>

            <Section title="Inscription des éditeurs">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatTile label="Sites soumis" value={num(data.publisher_registration.submitted)} hint={`${num(data.publisher_registration.without_feed)} sans flux`} />
                <StatTile label="Approuvés" value={num(data.publisher_registration.approved)} hint={`${num(data.publisher_registration.active)} actifs`} />
                <StatTile label="En attente" value={num(data.publisher_registration.pending)} />
                <StatTile label="Rejetés" value={num(data.publisher_registration.rejected)} />
                <StatTile label="Suspendus" value={num(data.publisher_registration.suspended)} />
                <StatTile label="Formulaires commencés" value={num(data.publisher_registration.started)} />
                <StatTile label="Conversion formulaire" value={pct(data.publisher_registration.completion_rate)} hint={`${num(data.publisher_registration.completed)} terminés`} />
              </div>
            </Section>

            <Section title="Export">
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <label className="text-neutral-400">Jeu de données{' '}
                  <select value={exportSet} onChange={(e) => setExportSet(e.target.value)} className={sel}>
                    <option value="events">Événements bruts</option>
                    <option value="sessions">Sessions</option>
                    <option value="campaigns">Campagnes (par annonce)</option>
                    <option value="campaign_totals">Campagnes (totaux)</option>
                    <option value="landing_pages">Pages d’arrivée</option>
                    <option value="youtube">YouTube</option>
                    <option value="funnel">Entonnoir</option>
                  </select>
                </label>
                <button onClick={() => doExport('csv')} className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600">Exporter CSV</button>
                <button onClick={() => doExport('json')} className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600">Exporter JSON</button>
                <span className="text-neutral-500">Utilise la période et les filtres ci-dessus.</span>
              </div>
            </Section>
          </div>
        )}
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: (string[] | [string, string])[] }) {
  return (
    <label className="text-xs text-neutral-500">
      <span className="sr-only">{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`bg-neutral-900 border rounded px-2 py-1 text-xs max-w-44 ${value ? 'border-orange-500 text-neutral-100' : 'border-neutral-800 text-neutral-400'}`}>
        <option value="">{label} : tous</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-8">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows, numeric, empty }: { head: string[]; rows: string[][]; numeric: number[]; empty: string }) {
  if (rows.length === 0) return empty ? <p className="text-sm text-neutral-500">{empty}</p> : null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-neutral-500 border-b border-neutral-800">
            {head.map((h, i) => <th key={h} className={`py-1.5 pr-3 font-medium ${numeric.includes(i) ? 'text-right' : 'text-left'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-neutral-900 hover:bg-neutral-800/40">
              {r.map((c, i) => <td key={i} className={`py-1.5 pr-3 ${numeric.includes(i) ? 'text-right tabular-nums' : 'max-w-xs truncate'}`} title={c}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
