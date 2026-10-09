'use client';

import { useState } from 'react';
import type { VisitorDetails } from '@/lib/adminApi';

// "Visiteurs" block of /admin/analytics: where visitors first came from
// (Facebook, Google, WhatsApp, direct...) and the most recent visitors one by
// one, with their sign-up when they became a lead. Same period and filters as
// the rest of the dashboard.

export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Accès direct', facebook: 'Facebook', google: 'Google', other_search: 'Autres moteurs (Bing…)',
  whatsapp: 'WhatsApp', instagram: 'Instagram', x: 'X (Twitter)', tiktok: 'TikTok', linkedin: 'LinkedIn',
  youtube: 'YouTube', telegram: 'Telegram', email: 'E-mail / invitation', referral: 'Sites référents', other: 'Autre (campagne)',
};
const DEVICE_LABELS: Record<string, string> = { mobile: 'Mobile', tablet: 'Tablette', desktop: 'Ordinateur' };

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('fr-FR'));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('fr-FR')} %`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function VisitorsSection({ data }: { data: VisitorDetails }) {
  const [source, setSource] = useState<string | null>(null);
  const [leadsOnly, setLeadsOnly] = useState(false);
  const totalLeads = data.sources.reduce((n, s) => n + s.leads, 0);
  const rows = data.visitors.filter((v) => (!source || v.source === source) && (!leadsOnly || v.lead));

  return (
    <section aria-labelledby="visitors-title" className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-8">
      <h2 id="visitors-title" className="text-sm font-semibold">Visiteurs : d’où ils viennent</h2>
      <p className="text-xs text-neutral-500 mt-1 mb-3">
        {num(data.total_visitors)} visiteurs sur la période, classés par leur toute première visite. {num(totalLeads)} se sont inscrits
        {data.untracked_leads > 0 && <> ; {num(data.untracked_leads)} autre{data.untracked_leads > 1 ? 's' : ''} inscription{data.untracked_leads > 1 ? 's' : ''} sans suivi (cookies refusés), donc sans source connue</>}.
      </p>

      {data.sources.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun visiteur sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-neutral-500 border-b border-neutral-800">
                <th className="py-1.5 pr-3 font-medium text-left">Source</th>
                <th className="py-1.5 pr-3 font-medium text-right">Visiteurs</th>
                <th className="py-1.5 pr-3 font-medium text-right">Part</th>
                <th className="py-1.5 pr-3 font-medium text-right">Revenus</th>
                <th className="py-1.5 pr-3 font-medium text-right">Pages vues</th>
                <th className="py-1.5 pr-3 font-medium text-right">dont payants</th>
                <th className="py-1.5 pr-3 font-medium text-right">Inscrits (leads)</th>
                <th className="py-1.5 pr-3 font-medium text-right">Conversion</th>
                <th className="py-1.5 pr-3 font-medium text-left">Principaux sites</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((s) => {
                const active = source === s.source;
                const share = data.total_visitors > 0 ? Math.round((s.visitors / data.total_visitors) * 100) : 0;
                return (
                  <tr key={s.source} className={`border-b border-neutral-900 ${active ? 'bg-orange-500/10' : 'hover:bg-neutral-800/40'}`}>
                    <td className="py-1.5 pr-3">
                      <button type="button" onClick={() => setSource(active ? null : s.source)} aria-pressed={active}
                        className="text-left hover:text-orange-400 underline-offset-2 hover:underline">
                        {SOURCE_LABELS[s.source] ?? s.source}
                      </button>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(s.visitors)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="h-1.5 rounded bg-orange-500/70" style={{ width: `${Math.max(2, share * 0.6)}px` }} aria-hidden="true" />{share} %
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(s.returning_visitors)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(s.page_views)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(s.paid_visitors)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{num(s.leads)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{pct(s.lead_rate)}</td>
                    <td className="py-1.5 pr-3 text-neutral-400 max-w-xs truncate" title={s.referrers.join(', ')}>{s.referrers.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.visitors.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 mt-6 mb-2">
            <h3 className="text-xs font-semibold text-neutral-300">
              Derniers visiteurs{source ? ` — ${SOURCE_LABELS[source] ?? source}` : ''} ({num(rows.length)}{data.visitors.length >= data.list_limit ? ` des ${num(data.list_limit)} plus récents` : ''})
            </h3>
            <label className="text-xs text-neutral-400 flex items-center gap-1">
              <input type="checkbox" checked={leadsOnly} onChange={(e) => setLeadsOnly(e.target.checked)} /> inscrits seulement
            </label>
            {source && <button type="button" onClick={() => setSource(null)} className="text-xs text-orange-400 hover:underline">Toutes les sources</button>}
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500">Aucun visiteur pour ce choix.</p>
          ) : (
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-neutral-900">
                  <tr className="text-neutral-500 border-b border-neutral-800">
                    <th className="py-1.5 pr-3 font-medium text-left">Dernière visite</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Source</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Campagne / site</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Page d’arrivée</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Appareil</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Visites</th>
                    <th className="py-1.5 pr-3 font-medium text-right">Pages</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Pays consultés</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Inscription</th>
                    <th className="py-1.5 pr-3 font-medium text-left">Visiteur</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.visitor_id} className={`border-b border-neutral-900 ${v.lead ? 'bg-emerald-500/5' : ''}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums" title={`Première visite : ${when(v.first_seen_at)}`}>{when(v.last_seen_at)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{SOURCE_LABELS[v.source] ?? v.source}</td>
                      <td className="py-1.5 pr-3 max-w-[10rem] truncate" title={v.campaign || v.referrer_host || ''}>{v.campaign || v.referrer_host || '—'}</td>
                      <td className="py-1.5 pr-3 max-w-[12rem] truncate" title={v.landing_page || ''}>{v.landing_page || '—'}</td>
                      <td className="py-1.5 pr-3">{v.device ? DEVICE_LABELS[v.device] : '—'}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{num(v.sessions)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{num(v.page_views)}</td>
                      <td className="py-1.5 pr-3">{v.countries.length ? v.countries.join(', ') : '—'}</td>
                      <td className="py-1.5 pr-3 max-w-[14rem] truncate" title={v.lead ? `${v.lead.name ?? ''} <${v.lead.email}> — ${when(v.lead.at)}` : ''}>
                        {v.lead ? <span className="text-emerald-400">{v.lead.name ? `${v.lead.name} · ` : ''}{v.lead.email}</span> : '—'}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-neutral-500" title={v.visitor_id}>{v.visitor_id.slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-neutral-500 mt-2">
            Seuls les visiteurs ayant accepté les cookies de mesure apparaissent ici. Les e-mails sont des données personnelles : réservés à l’administration, jamais exportés avec les statistiques.
          </p>
        </>
      )}
    </section>
  );
}
