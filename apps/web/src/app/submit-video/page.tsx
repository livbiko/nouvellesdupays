'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, postJson } from '@/lib/api';
import { getFormTrackingContext, reportServerConversion } from '@/lib/tracking';
import { Field, Honeypot, SubmitStatus, friendlyError, inputClass, useFormTracking, useSubmitState } from '@/components/FormKit';
import type { Country } from '@/lib/types';

const CATEGORIES: [string, string][] = [
  ['news', 'Actualités'], ['politics', 'Politique'], ['business', 'Économie'], ['sports', 'Sport'],
  ['culture', 'Culture'], ['entertainment', 'Divertissement'], ['technology', 'Technologie'], ['health', 'Santé'],
  ['education', 'Éducation'], ['documentary', 'Documentaire'], ['interview', 'Interview'], ['other', 'Autre'],
];

// Same rules as the API's parseVideoId -- instant feedback before submit.
const VIDEO_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const CHANNEL_RE = /youtube\.com\/(?:channel\/UC[A-Za-z0-9_-]{22}|@[\w.-]{3,}|c\/[\w.-]+|user\/[\w.-]+)/;

export default function SubmitVideoPage() {
  const [tab, setTab] = useState<'video' | 'channel'>('video');
  const [countries, setCountries] = useState<Country[]>([]);
  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour</Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
          Proposer une <span className="text-orange-500">vidéo YouTube</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
          Journalistes, créateurs, médias : proposez une vidéo d’actualité ou votre chaîne. Nous récupérons
          automatiquement le titre, la miniature et la chaîne depuis YouTube. Après validation, chaque vidéo obtient sa
          propre page sur NouvellesDuPays, avec un lien vers YouTube.
        </p>

        <div role="tablist" aria-label="Type de soumission" className="mt-6 flex gap-2">
          {([['video', 'Une vidéo'], ['channel', 'Une chaîne']] as const).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              aria-controls={`panel-${v}`}
              onClick={() => setTab(v)}
              className={`text-sm px-4 py-2 rounded-md ${tab === v ? 'bg-orange-500 text-white' : 'bg-neutral-900 border border-neutral-800 text-neutral-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" className="mt-6">
          {tab === 'video' ? <VideoForm countries={countries} /> : <ChannelForm countries={countries} />}
        </div>
      </div>
    </main>
  );
}

function CommonFields({
  countries, form, set, idPrefix,
}: {
  countries: Country[];
  form: Record<string, string>;
  set: (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  idPrefix: string;
}) {
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field id={id('country')} label="Pays" required>
          <select id={id('country')} required value={form.country_iso} onChange={set('country_iso')} className={inputClass}>
            <option value="">Sélectionner</option>
            {countries.map((c) => <option key={c.iso_code} value={c.iso_code}>{c.name}</option>)}
          </select>
        </Field>
        <Field id={id('language')} label="Langue">
          <input id={id('language')} maxLength={20} value={form.language} onChange={set('language')} className={inputClass} placeholder="fr" />
        </Field>
        <Field id={id('category')} label="Catégorie" required>
          <select id={id('category')} required value={form.category} onChange={set('category')} className={inputClass}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <Field id={id('description')} label="Description" help="Utilisée seulement si YouTube ne fournit pas de description.">
        <textarea id={id('description')} rows={3} maxLength={2000} value={form.description} onChange={set('description')} className={inputClass} aria-describedby={`${id('description')}-help`} />
      </Field>
      <Field id={id('email')} label="Email de contact" required help="Pour vous informer de la validation. Jamais affiché publiquement.">
        <input id={id('email')} type="email" required autoComplete="email" value={form.contact_email} onChange={set('contact_email')} className={inputClass} aria-describedby={`${id('email')}-help`} />
      </Field>
    </>
  );
}

function VideoForm({ countries }: { countries: Country[] }) {
  const empty = { video_url: '', channel_url: '', title: '', channel_name: '', thumbnail_url: '', country_iso: '', language: '', category: 'news', description: '', contact_email: '' };
  const [form, setForm] = useState(empty);
  const [hp, setHp] = useState('');
  const [state, setState] = useSubmitState();
  const { formStartedAt, onFirstInteraction } = useFormTracking('YouTubeSubmissionStarted', { kind: 'video' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const videoValid = !form.video_url || VIDEO_RE.test(form.video_url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!VIDEO_RE.test(form.video_url)) {
      setState({ status: 'error', message: 'Cette adresse ne ressemble pas à une vidéo YouTube.' });
      return;
    }
    setState({ status: 'submitting' });
    const { ok, status, body } = await postJson<{ title?: string; conversion_event_id?: string }>('/api/youtube/submit-video', {
      ...form, website_hp: hp, form_started_at: formStartedAt(), tracking: getFormTrackingContext(),
    });
    if (ok) {
      reportServerConversion('YouTubeSubmissionCompleted', body.conversion_event_id, { kind: 'video' });
      setState({ status: 'success', message: `Merci ! « ${body.title ?? 'Votre vidéo'} » sera publiée après validation par notre équipe.` });
      setForm(empty);
    } else {
      setState({ status: 'error', message: friendlyError(status, body) });
    }
  }

  return (
    <form onSubmit={submit} onFocusCapture={onFirstInteraction} className="space-y-4">
      <Honeypot value={hp} onChange={setHp} />
      <Field id="v-url" label="Lien de la vidéo YouTube" required>
        <input id="v-url" type="url" required inputMode="url" value={form.video_url} onChange={set('video_url')} className={inputClass} placeholder="https://www.youtube.com/watch?v=…" aria-invalid={!videoValid} aria-describedby="v-url-err" />
        {!videoValid && <p id="v-url-err" className="text-xs text-red-400 mt-1">Formats acceptés : youtube.com/watch?v=…, youtu.be/…, /shorts/…</p>}
      </Field>
      <details className="rounded-md border border-neutral-800 p-3">
        <summary className="text-sm text-neutral-300 cursor-pointer">Informations complémentaires (si YouTube ne les fournit pas)</summary>
        <div className="mt-3 space-y-4">
          <Field id="v-title" label="Titre de la vidéo"><input id="v-title" maxLength={200} value={form.title} onChange={set('title')} className={inputClass} /></Field>
          <Field id="v-channel" label="Lien de la chaîne YouTube"><input id="v-channel" type="url" inputMode="url" value={form.channel_url} onChange={set('channel_url')} className={inputClass} placeholder="https://www.youtube.com/@…" /></Field>
          <Field id="v-channel-name" label="Nom de la chaîne / du média"><input id="v-channel-name" maxLength={120} value={form.channel_name} onChange={set('channel_name')} className={inputClass} /></Field>
          <Field id="v-thumb" label="Miniature (URL)" help="Inutile en général : nous utilisons la miniature officielle YouTube."><input id="v-thumb" type="url" value={form.thumbnail_url} onChange={set('thumbnail_url')} className={inputClass} aria-describedby="v-thumb-help" /></Field>
        </div>
      </details>
      <CommonFields countries={countries} form={form} set={set} idPrefix="v" />
      <button type="submit" disabled={state.status === 'submitting'} className="w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 text-sm">
        {state.status === 'submitting' ? 'Vérification sur YouTube…' : 'Proposer la vidéo'}
      </button>
      <SubmitStatus state={state} />
    </form>
  );
}

function ChannelForm({ countries }: { countries: Country[] }) {
  const empty = { channel_url: '', name: '', country_iso: '', language: '', category: 'news', description: '', contact_email: '' };
  const [form, setForm] = useState(empty);
  const [hp, setHp] = useState('');
  const [state, setState] = useSubmitState();
  const { formStartedAt, onFirstInteraction } = useFormTracking('YouTubeSubmissionStarted', { kind: 'channel' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = !form.channel_url || CHANNEL_RE.test(form.channel_url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!CHANNEL_RE.test(form.channel_url)) {
      setState({ status: 'error', message: 'Cette adresse ne ressemble pas à une chaîne YouTube.' });
      return;
    }
    setState({ status: 'submitting' });
    const { ok, status, body } = await postJson<{ conversion_event_id?: string }>('/api/youtube/submit-channel', {
      ...form, website_hp: hp, form_started_at: formStartedAt(), tracking: getFormTrackingContext(),
    });
    if (ok) {
      reportServerConversion('YouTubeSubmissionCompleted', body.conversion_event_id, { kind: 'channel' });
      setState({ status: 'success', message: 'Merci ! Votre chaîne sera examinée par notre équipe.' });
      setForm(empty);
    } else {
      setState({ status: 'error', message: friendlyError(status, body) });
    }
  }

  return (
    <form onSubmit={submit} onFocusCapture={onFirstInteraction} className="space-y-4">
      <Honeypot value={hp} onChange={setHp} />
      <Field id="c-url" label="Lien de la chaîne YouTube" required>
        <input id="c-url" type="url" required inputMode="url" value={form.channel_url} onChange={set('channel_url')} className={inputClass} placeholder="https://www.youtube.com/@votrechaine" aria-invalid={!valid} />
        {!valid && <p className="text-xs text-red-400 mt-1">Formats acceptés : youtube.com/@nom, /channel/UC…, /c/nom</p>}
      </Field>
      <Field id="c-name" label="Nom de la chaîne / du média"><input id="c-name" maxLength={120} value={form.name} onChange={set('name')} className={inputClass} /></Field>
      <CommonFields countries={countries} form={form} set={set} idPrefix="c" />
      <button type="submit" disabled={state.status === 'submitting'} className="w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 text-sm">
        {state.status === 'submitting' ? 'Vérification…' : 'Proposer la chaîne'}
      </button>
      <SubmitStatus state={state} />
    </form>
  );
}
