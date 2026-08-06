'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Country } from '@/lib/types';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export default function RegisterPublisher() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [name, setName] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [countryIso, setCountryIso] = useState('');
  const [language, setLanguage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState({ status: 'submitting' });

    const { ok, body } = await api.registerPublisher({
      name,
      homepage_url: homepageUrl,
      feed_url: feedUrl,
      country_iso: countryIso,
      language,
      contact_email: contactEmail || undefined,
    });

    if (ok) {
      setSubmitState({
        status: 'success',
        message: body.verification || 'Flux vérifié et soumis pour validation.',
      });
      setName('');
      setHomepageUrl('');
      setFeedUrl('');
      setCountryIso('');
      setLanguage('');
      setContactEmail('');
    } else {
      setSubmitState({
        status: 'error',
        message: body.detail || body.error || 'La soumission a échoué.',
      });
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Retour
        </Link>

        <h1 className="text-2xl font-bold tracking-tight mt-4">
          Enregistrer un <span className="text-orange-500">flux d&apos;actualités</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-2">
          Vous représentez un média et souhaitez apparaître sur NouvellesDuPays ? Soumettez
          votre flux RSS/Atom ci-dessous. Nous le vérifions automatiquement (contenu réel,
          pas seulement une réponse HTTP 200), puis il est examiné avant publication.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1">Nom du média *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
              placeholder="Le Journal Exemple"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Site web *</label>
            <input
              required
              type="url"
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
              placeholder="https://www.exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">URL du flux RSS/Atom *</label>
            <input
              required
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
              placeholder="https://www.exemple.com/rss"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Pays *</label>
            <select
              required
              value={countryIso}
              onChange={(e) => setCountryIso(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
            >
              <option value="">Sélectionner un pays</option>
              {countries.map((c) => (
                <option key={c.iso_code} value={c.iso_code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Langue du contenu *</label>
            <input
              required
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
              placeholder="fr"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">
              Email de contact (optionnel)
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm"
              placeholder="contact@exemple.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitState.status === 'submitting'}
            className="w-full rounded bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 text-sm"
          >
            {submitState.status === 'submitting' ? 'Vérification en cours…' : 'Soumettre'}
          </button>

          {submitState.status === 'success' && (
            <p className="text-green-400 text-sm">{submitState.message}</p>
          )}
          {submitState.status === 'error' && (
            <p className="text-red-400 text-sm">{submitState.message}</p>
          )}
        </form>
      </div>
    </main>
  );
}
