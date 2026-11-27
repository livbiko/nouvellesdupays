'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { translator, type Locale } from '@/i18n';

// CR-2026-11-26-02: "Créateurs indépendants africains" with the look and controls of the "Voix indépendantes
// africaines" banner (IndependentVoicesBanner): orange-tinted panel, previous / pause / next, no motion with
// reduced-motion, right-to-left aware. The cards are rendered on the server (DirectoryCard) and passed as children.
const AUTO_ADVANCE_MS = 8000;

export default function IndependentCreatorsCarousel({ id, title, accent, intro, count, footer, children, locale = 'fr' }: {
  id: string; title: string; accent: string; intro: string; count: number; footer?: React.ReactNode; children: React.ReactNode; locale?: Locale;
}) {
  const { t } = translator(locale);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false); // pointer or keyboard focus inside: no auto-advance
  const [reduced, setReduced] = useState(true); // until the browser says otherwise, no motion
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    // Right-to-left (Arabic): as in the banner, "next" moves left and scrollLeft counts down from 0.
    const rtl = getComputedStyle(el).direction === 'rtl';
    const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 8;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: reduced ? 'auto' : 'smooth' });
    else el.scrollBy({ left: (rtl ? -dir : dir) * el.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  }, [reduced]);

  useEffect(() => {
    if (reduced || paused || hold || count < 2) return;
    const timer = window.setInterval(() => scroll(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [reduced, paused, hold, count, scroll]);

  const control = 'rounded-full border border-neutral-700 px-2.5 py-1 text-sm text-neutral-300 hover:border-orange-500 hover:text-white disabled:opacity-40';
  return (
    <section id={id} aria-labelledby={`${id}-titre`} aria-roledescription={t('banner.carousel')}
      className="mt-10 scroll-mt-20 rounded-2xl border border-orange-900/60 bg-gradient-to-br from-orange-950/40 to-neutral-900 p-4 sm:p-5"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false); }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-titre`} className="text-sm font-bold uppercase tracking-wider text-orange-400">{title} {accent}</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-300">{intro}</p>
        </div>
        {count > 1 && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" className={control} onClick={() => scroll(-1)} aria-label={t('banner.previous')}><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span></button>
            {!reduced && (
              <button type="button" className={control} onClick={() => setPaused((p) => !p)} aria-pressed={paused}
                aria-label={paused ? t('banner.resume') : t('banner.pause')}>
                {paused ? '▶' : '❚❚'}
              </button>
            )}
            <button type="button" className={control} onClick={() => scroll(1)} aria-label={t('banner.next')}><span aria-hidden="true" className="inline-block rtl:rotate-180">→</span></button>
          </div>
        )}
      </div>
      <ul ref={list} aria-live={paused || reduced ? 'polite' : 'off'}
        className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {children}
      </ul>
      {footer}
    </section>
  );
}
