'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getConsent, loadTrackingConfig, needsConsentPrompt, setConsent, track, type TrackingConfig } from '@/lib/tracking';

// Mounted once in the root layout. Fires PageView on every route change
// (the home globe is a single route, so country/tab changes are tracked as
// their own events by the components themselves) and renders the consent
// banner. Admin pages are never tracked.
export default function TrackingProvider() {
  const pathname = usePathname();
  const [config, setConfig] = useState<TrackingConfig | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [analyticsGranted, setAnalyticsGranted] = useState(false);
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTrackingConfig().then((cfg) => {
      if (cancelled || !cfg) return;
      setConfig(cfg);
      setAnalyticsGranted(getConsent()?.analytics === true);
      if (needsConsentPrompt() && !window.location.pathname.startsWith('/admin')) setBannerOpen(true);
    });
    const onOpen = () => setBannerOpen(true);
    const onChange = () => setAnalyticsGranted(getConsent()?.analytics === true);
    window.addEventListener('ndp-open-consent', onOpen);
    window.addEventListener('ndp-consent-change', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('ndp-open-consent', onOpen);
      window.removeEventListener('ndp-consent-change', onChange);
    };
  }, []);

  // One PageView per route; re-fired once when consent is first granted so
  // the page the visitor accepted on (often an ad landing page) is counted.
  useEffect(() => {
    if (!config || !analyticsGranted || !pathname || pathname.startsWith('/admin')) return;
    const key = pathname;
    if (lastTracked.current === key) return;
    lastTracked.current = key;
    track('PageView', { title: document.title.slice(0, 120) });
  }, [config, pathname, analyticsGranted]);

  if (!bannerOpen || !config) return null;
  return <ConsentBanner onDone={() => setBannerOpen(false)} />;
}

function ConsentBanner({ onDone }: { onDone: () => void }) {
  const existing = getConsent();
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(existing?.analytics ?? false);
  const [advertising, setAdvertising] = useState(existing?.advertising ?? false);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus({ preventScroll: true });
  }, []);

  function save(a: boolean, ad: boolean) {
    setConsent(a, ad);
    onDone();
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ndp-consent-title"
      aria-describedby="ndp-consent-desc"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-neutral-700 bg-neutral-900/98 backdrop-blur shadow-2xl shadow-black/60 p-4 sm:p-5 text-sm">
        <h2 id="ndp-consent-title" className="font-semibold text-neutral-100">Votre vie privée</h2>
        <p id="ndp-consent-desc" className="text-neutral-400 mt-1.5 leading-relaxed">
          Avec votre accord, nous mesurons l’audience du site (statistiques anonymes, sans IP stockée) et
          l’efficacité de nos publicités Facebook/Meta. Rien n’est collecté avant votre choix, et vous pouvez le
          modifier à tout moment. <Link href="/privacy" className="underline text-neutral-300 hover:text-white">En savoir plus</Link>
        </p>

        {customise && (
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Choix des cookies</legend>
            <label className="flex items-start gap-2 text-neutral-300">
              <input type="checkbox" checked disabled className="mt-1" />
              <span><strong>Nécessaires</strong> — mémoriser votre choix de consentement et votre pays. Toujours actifs.</span>
            </label>
            <label className="flex items-start gap-2 text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-orange-500"
                checked={analytics}
                onChange={(e) => {
                  setAnalytics(e.target.checked);
                  if (!e.target.checked) setAdvertising(false);
                }}
              />
              <span><strong>Mesure d’audience</strong> — visites, pages vues, clics, inscriptions (identifiant aléatoire, données hébergées par NouvellesDuPays).</span>
            </label>
            <label className={`flex items-start gap-2 ${analytics ? 'text-neutral-300 cursor-pointer' : 'text-neutral-600'}`}>
              <input
                type="checkbox"
                className="mt-1 accent-orange-500"
                checked={advertising}
                disabled={!analytics}
                onChange={(e) => setAdvertising(e.target.checked)}
              />
              <span><strong>Publicité (Meta Pixel)</strong> — permet à Meta de mesurer les visites et inscriptions issues de nos publicités Facebook/Instagram.</span>
            </label>
          </fieldset>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {customise ? (
            <button
              ref={firstButton}
              onClick={() => save(analytics, advertising)}
              className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2"
            >
              Enregistrer mes choix
            </button>
          ) : (
            <>
              <button
                ref={firstButton}
                onClick={() => save(true, true)}
                className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2"
              >
                Tout accepter
              </button>
              <button
                onClick={() => save(false, false)}
                className="flex-1 rounded-md bg-neutral-100 hover:bg-white text-neutral-900 font-medium px-4 py-2"
              >
                Tout refuser
              </button>
              <button
                onClick={() => setCustomise(true)}
                className="flex-1 rounded-md border border-neutral-600 hover:border-neutral-400 text-neutral-200 px-4 py-2"
              >
                Personnaliser
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
