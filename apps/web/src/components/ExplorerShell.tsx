'use client';

import { useRef, useState } from 'react';

// CR-2026-11-25-04: the client part of "Explorer par pays" - a drawer button on phones (always open from lg up) and a
// country search box. The tree itself is server-rendered <details> (works without JavaScript, every link crawlable);
// the search only hides non-matching countries and opens the groups that hold a match.
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’\-]/g, ' ').trim();
}

export default function ExplorerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const tree = useRef<HTMLDivElement>(null);

  const search = (value: string) => {
    setQ(value);
    const root = tree.current;
    if (!root) return;
    const n = norm(value);
    const groups = root.querySelectorAll<HTMLDetailsElement>('details[data-group]');
    if (!n) {
      root.querySelectorAll<HTMLElement>('[data-country]').forEach((el) => { el.hidden = false; });
      root.querySelectorAll<HTMLElement>('[data-group-item]').forEach((el) => { el.hidden = false; });
      groups.forEach((g) => { g.open = g.dataset.defaultOpen === '1'; });
      return;
    }
    root.querySelectorAll<HTMLElement>('[data-country]').forEach((el) => {
      el.hidden = !norm(el.dataset.country || '').includes(n);
    });
    // A region or continent with no visible country is hidden, the others are opened.
    root.querySelectorAll<HTMLElement>('[data-group-item]').forEach((item) => {
      const any = item.querySelector('[data-country]:not([hidden])');
      item.hidden = !any;
      const d = item.querySelector<HTMLDetailsElement>(':scope > details[data-group]');
      if (d) d.open = Boolean(any);
    });
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="explorer-pays"
        className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-left font-semibold lg:hidden">
        <span>Explorer par <span className="text-orange-500">pays</span></span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div id="explorer-pays" className={`${open ? 'block' : 'hidden'} mt-2 lg:mt-0 lg:block`}>
        <h2 className="hidden text-base font-semibold text-neutral-100 lg:block">
          Explorer par <span className="text-orange-500">pays</span>
        </h2>
        <label className="mt-2 block">
          <span className="sr-only">Rechercher un pays</span>
          <input type="search" value={q} onChange={(e) => search(e.target.value)} placeholder="Rechercher un pays…"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none" />
        </label>
        <div ref={tree} className="mt-3">{children}</div>
      </div>
    </div>
  );
}
