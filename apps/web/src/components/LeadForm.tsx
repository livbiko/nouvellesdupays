'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, postJson } from '@/lib/api';
import { getFormTrackingContext, reportServerConversion } from '@/lib/tracking';
import { Honeypot, SubmitStatus, friendlyError, inputClass, useFormTracking, useSubmitState } from './FormKit';
import type { Country } from '@/lib/types';

const INTERESTS: [string, string][] = [
  ['politics', 'Politique'], ['business', 'Économie'], ['sports', 'Sport'], ['entertainment', 'Culture & divertissement'],
  ['technology', 'Technologie'], ['health', 'Santé'], ['videos', 'Vidéos'], ['local_voices', 'Voix locales'],
];

// "Rejoindre NouvellesDuPays" -- the visitor-registration conversion.
// Fires RegistrationStarted on first interaction; RegistrationCompleted is
// recorded server-side by POST /api/leads and mirrored to the Pixel with
// the same event id.
export default function LeadForm({
  defaultCountry,
  videoSlug,
  formId = 'registration',
  compact = false,
}: {
  defaultCountry?: string | null;
  videoSlug?: string;
  formId?: string;
  compact?: boolean;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState(defaultCountry || '');
  const [interests, setInterests] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [hp, setHp] = useState('');
  const [state, setState] = useSubmitState();
  const { formStartedAt, onFirstInteraction } = useFormTracking('RegistrationStarted', { form: formId });

  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!privacy) {
      setState({ status: 'error', message: 'Merci d’accepter la politique de confidentialité.' });
      return;
    }
    setState({ status: 'submitting' });
    const tracking = getFormTrackingContext();
    const { ok, status, body } = await postJson<{ conversion_event_id?: string }>('/api/leads', {
      email, name, country_iso: country || undefined, interests, privacy_accepted: privacy, marketing_consent: marketing,
      source_page: typeof window !== 'undefined' ? window.location.pathname : undefined,
      video_slug: videoSlug, form_id: formId, website_hp: hp, form_started_at: formStartedAt(), tracking,
    });
    if (ok) {
      reportServerConversion('RegistrationCompleted', body.conversion_event_id, { form: formId });
      setState({ status: 'success', message: 'Merci ! Votre inscription est confirmée. Bienvenue sur NouvellesDuPays.' });
      setEmail('');
      setName('');
    } else {
      setState({ status: 'error', message: friendlyError(status, body) });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-green-800 bg-green-950/40 p-4 text-sm text-green-300" role="status">
        {state.message}{' '}
        <Link href="/" className="underline text-green-200">Explorer le globe →</Link>
      </div>
    );
  }

  const id = (s: string) => `${formId}-${s}`;
  return (
    <form onSubmit={handleSubmit} onFocusCapture={onFirstInteraction} className="space-y-3">
      <Honeypot value={hp} onChange={setHp} />
      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        <div>
          <label htmlFor={id('email')} className="block text-sm text-neutral-300 mb-1">Email <span className="text-orange-400" aria-hidden="true">*</span></label>
          <input id={id('email')} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="vous@exemple.com" />
        </div>
        <div>
          <label htmlFor={id('name')} className="block text-sm text-neutral-300 mb-1">Prénom <span className="text-neutral-600">(optionnel)</span></label>
          <input id={id('name')} autoComplete="given-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor={id('country')} className="block text-sm text-neutral-300 mb-1">Pays qui vous intéresse <span className="text-neutral-600">(optionnel)</span></label>
        <select id={id('country')} value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass}>
          <option value="">—</option>
          {countries.map((c) => <option key={c.iso_code} value={c.iso_code}>{c.name}</option>)}
        </select>
      </div>
      {!compact && (
        <div role="group" aria-labelledby={id('interests')}>
          <p id={id('interests')} className="block text-sm text-neutral-300 mb-2">Centres d’intérêt</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(([v, label]) => (
              <label key={v} className={`cursor-pointer text-xs px-3 py-1.5 rounded-full border ${interests.includes(v) ? 'bg-orange-500 border-orange-500 text-white' : 'border-neutral-700 text-neutral-300'}`}>
                <input type="checkbox" className="sr-only" checked={interests.includes(v)} onChange={() => setInterests((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-start gap-2 text-xs text-neutral-400 cursor-pointer">
        <input type="checkbox" required checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 accent-orange-500" />
        <span>J’accepte la <Link href="/privacy" className="underline">politique de confidentialité</Link>. Votre email n’est jamais affiché ni revendu.</span>
      </label>
      <label className="flex items-start gap-2 text-xs text-neutral-400 cursor-pointer">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 accent-orange-500" />
        <span>Je souhaite recevoir une sélection d’actualités par email (désinscription à tout moment).</span>
      </label>
      <button type="submit" disabled={state.status === 'submitting'} className="w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 text-sm">
        {state.status === 'submitting' ? 'Inscription…' : 'Rejoindre NouvellesDuPays — gratuit'}
      </button>
      <SubmitStatus state={state} />
    </form>
  );
}
