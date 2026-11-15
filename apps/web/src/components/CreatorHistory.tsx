// Build #260: a creator's performance history from the daily public snapshots (GET /api/creators/:slug history).
// Two separate charts, one measure each (never two scales on one axis): subscribers per day, and views gained per
// day = difference of total views between two consecutive daily readings (a day without both readings is left out,
// never estimated). Plain SVG rendered on the server; each mark carries a <title> for the hover readout, with a hit
// area wider than the mark, and the numbers are also in a table.

type Day = { day: string; subscribers: number | null; total_views: number | null };

const W = 640;
const H = 160;
const PAD = { top: 12, right: 12, bottom: 24, left: 56 };
const nf = new Intl.NumberFormat('fr-FR');
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const DAY_MS = 86400000;
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function scale(values: number[], zeroBased: boolean) {
  let lo = zeroBased ? 0 : Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) { hi += Math.max(1, Math.abs(hi) * 0.01); lo = zeroBased ? 0 : lo - Math.max(1, Math.abs(lo) * 0.01); }
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  return { y, lo, hi };
}

function Axis({ lo, hi, y, labels }: { lo: number; hi: number; y: (v: number) => number; labels: { x: number; text: string }[] }) {
  return (
    <g className="text-[10px]" fill="currentColor">
      {[lo, hi].map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-neutral-800" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="fill-neutral-500">{compact.format(v)}</text>
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.x} x={l.x} y={H - 6} textAnchor="middle" className="fill-neutral-500">{l.text}</text>
      ))}
    </g>
  );
}

export default function CreatorHistory({ history }: { history: Day[] }) {
  const subs = history.filter((d): d is Day & { subscribers: number } => d.subscribers != null);
  const gains: { day: string; views: number }[] = [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1];
    const b = history[i];
    const consecutive = Date.parse(b.day) - Date.parse(a.day) === DAY_MS;
    if (consecutive && a.total_views != null && b.total_views != null && b.total_views >= a.total_views) {
      gains.push({ day: b.day, views: b.total_views - a.total_views });
    }
  }
  if (subs.length < 3 && gains.length < 2) {
    return <p className="text-sm text-neutral-500">Historique en cours de constitution : un relevé public par jour, {history.length} jour(s) pour l’instant.</p>;
  }
  const span = Math.max(1, (Date.parse(history[history.length - 1].day) - Date.parse(history[0].day)) / DAY_MS);
  const x = (d: string) => PAD.left + ((Date.parse(d) - Date.parse(history[0].day)) / DAY_MS / span) * (W - PAD.left - PAD.right);
  const ends = [history[0].day, history[history.length - 1].day].map((d) => ({ x: x(d), text: dayLabel(d) }));

  return (
    <div className="space-y-6">
      {subs.length >= 3 && (() => {
        const s = scale(subs.map((d) => d.subscribers), false);
        const path = subs.map((d, i) => `${i ? 'L' : 'M'}${x(d.day).toFixed(1)},${s.y(d.subscribers).toFixed(1)}`).join(' ');
        return (
          <figure>
            <figcaption className="text-sm text-neutral-300 mb-1">Abonnés par jour</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Abonnés par jour">
              <Axis lo={s.lo} hi={s.hi} y={s.y} labels={ends} />
              <path d={path} fill="none" className="stroke-orange-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {subs.map((d) => (
                <g key={d.day}>
                  <circle cx={x(d.day)} cy={s.y(d.subscribers)} r={4} className="fill-orange-400 stroke-neutral-950" strokeWidth={2} />
                  <circle cx={x(d.day)} cy={s.y(d.subscribers)} r={12} fill="transparent">
                    <title>{`${dayLabel(d.day)} : ${nf.format(d.subscribers)} abonnés`}</title>
                  </circle>
                </g>
              ))}
            </svg>
            <p className="text-xs text-neutral-500">YouTube arrondit les nombres d’abonnés publics : une courbe plate peut cacher une petite évolution.</p>
          </figure>
        );
      })()}
      {gains.length >= 2 && (() => {
        const s = scale(gains.map((g) => g.views), true);
        const bw = Math.max(4, Math.min(24, ((W - PAD.left - PAD.right) / (span + 1)) * 0.6));
        return (
          <figure>
            <figcaption className="text-sm text-neutral-300 mb-1">Vues gagnées par jour (toutes vidéos)</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Vues gagnées par jour">
              <Axis lo={s.lo} hi={s.hi} y={s.y} labels={ends} />
              {gains.map((g) => {
                const top = s.y(g.views);
                const base = s.y(0);
                return (
                  <g key={g.day}>
                    {base - top >= 4 ? (
                      <path d={`M${x(g.day) - bw / 2},${base} V${top + 4} q0,-4 4,-4 H${x(g.day) + bw / 2 - 4} q4,0 4,4 V${base} Z`}
                        className="fill-orange-400" />
                    ) : (
                      <rect x={x(g.day) - bw / 2} y={top} width={bw} height={Math.max(base - top, 1)} className="fill-orange-400" />
                    )}
                    <rect x={x(g.day) - Math.max(bw, 20) / 2} y={PAD.top} width={Math.max(bw, 20)} height={base - PAD.top} fill="transparent">
                      <title>{`${dayLabel(g.day)} : +${nf.format(g.views)} vues`}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
          </figure>
        );
      })()}
      <details className="text-sm">
        <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">Voir les chiffres</summary>
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead className="text-neutral-500"><tr><th className="py-1 font-normal">Jour</th><th className="font-normal">Abonnés</th><th className="font-normal">Vues au total</th></tr></thead>
          <tbody className="text-neutral-300">
            {history.map((d) => (
              <tr key={d.day} className="border-t border-neutral-800">
                <td className="py-1">{dayLabel(d.day)}</td>
                <td>{d.subscribers != null ? nf.format(d.subscribers) : '—'}</td>
                <td>{d.total_views != null ? nf.format(d.total_views) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
