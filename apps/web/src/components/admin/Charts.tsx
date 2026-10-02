'use client';

import { useRef, useState } from 'react';

// Small dependency-free SVG charts for the admin analytics dashboard.
// Palette: categorical slots 1-2 of the reference palette's dark steps,
// validated against the admin surface (#171717): blue #3987e5, orange
// #d95926 -- all six checks pass. Text never uses series colour.
export const SERIES = ['#3987e5', '#d95926'];
const GRID = '#2a2a2a';
const AXIS_TEXT = '#8a8a85';

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

export function TrendChart({
  data,
  series,
}: {
  data: { label: string; values: number[] }[];
  series: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 36, r: 90, t: 12, b: 26 };
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => H - pad.b - (v / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  if (data.length === 0) return <p className="text-sm text-neutral-500">Pas de données sur la période.</p>;
  const last = data.length - 1;

  return (
    <div>
      <div className="flex gap-4 text-xs text-neutral-300 mb-2" aria-hidden="true">
        {series.map((s, si) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES[si] }} />{s}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
          aria-label={`Évolution quotidienne : ${series.join(', ')}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill={AXIS_TEXT}>{fmt(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % labelEvery === 0 || i === last) && (
            <text key={d.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>{d.label.slice(5)}</text>
          ))}
          {series.map((s, si) => (
            <g key={s}>
              <polyline fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                points={data.map((d, i) => `${x(i)},${y(d.values[si])}`).join(' ')} />
              {data.length === 1 && <circle cx={x(0)} cy={y(data[0].values[si])} r={4} fill={SERIES[si]} />}
              <text x={x(last) + 8} y={y(data[last].values[si]) + 4} fontSize={11} fill="#d4d4d0">
                {fmt(data[last].values[si])} {s.toLowerCase()}
              </text>
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#5a5a55" strokeWidth={1} />
              {series.map((s, si) => (
                <circle key={s} cx={x(hover)} cy={y(data[hover].values[si])} r={4} fill={SERIES[si]} stroke="#171717" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs shadow"
            style={{ left: `${Math.min(75, (x(hover) / W) * 100)}%` }}>
            <p className="text-neutral-400">{data[hover].label}</p>
            {series.map((s, si) => (
              <p key={s} className="text-neutral-100 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: SERIES[si] }} />{s} : {fmt(data[hover].values[si])}
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-neutral-400">
        <summary className="cursor-pointer">Voir le tableau</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th className="pr-4">Jour</th>{series.map((s) => <th key={s} className="pr-4 text-right">{s}</th>)}</tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><td className="pr-4">{d.label}</td>{d.values.map((v, i) => <td key={i} className="pr-4 text-right tabular-nums">{fmt(v)}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

// Horizontal bars, one hue (magnitude), value printed in neutral ink.
export function BarList({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-neutral-500">Pas de données.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label} : ${fmt(r.value)}${r.note ? ` (${r.note})` : ''}`}>
          <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-neutral-100">{fmt(r.value)}{r.note && <span className="text-neutral-500"> · {r.note}</span>}</span>
          </div>
          <div className="h-2 rounded bg-neutral-800">
            <div className="h-2 rounded" style={{ width: `${(r.value / max) * 100}%`, background: SERIES[0], minWidth: r.value > 0 ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Funnel({ stages }: { stages: { key: string; label: string; count: number | null; rate_from_previous: number | null; rate_from_top: number | null }[] }) {
  const known = stages.filter((s) => s.count !== null) as { key: string; label: string; count: number; rate_from_previous: number | null; rate_from_top: number | null }[];
  const max = Math.max(1, ...known.map((s) => s.count));
  return (
    <ol className="space-y-1.5" aria-label="Entonnoir de conversion">
      {stages.map((s, i) => (
        <li key={s.key}>
          {i > 0 && (
            <p className="text-[11px] text-neutral-500 pl-1 mb-1" aria-hidden="true">
              ↓ {s.rate_from_previous !== null ? `${s.rate_from_previous.toLocaleString('fr-FR')} %` : '—'}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-xs text-neutral-300">{s.label}</div>
            <div className="flex-1 h-6 rounded bg-neutral-800 relative">
              {s.count !== null && (
                <div className="h-6 rounded" style={{ width: `${(s.count / max) * 100}%`, background: SERIES[0], minWidth: s.count > 0 ? 4 : 0 }} />
              )}
            </div>
            <div className="w-28 shrink-0 text-right text-xs tabular-nums text-neutral-100">
              {s.count === null ? <span className="text-neutral-500" title="Saisissez les clics Meta dans « Campagnes »">n/d</span> : fmt(s.count)}
              {s.rate_from_top !== null && i > 0 && <span className="text-neutral-500"> ({s.rate_from_top.toLocaleString('fr-FR')} %)</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3" title={hint}>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      {hint && <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>}
    </div>
  );
}
