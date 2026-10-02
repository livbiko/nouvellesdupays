'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postJson } from '@/lib/api';
import { getFormTrackingContext, reportServerConversion } from '@/lib/tracking';
import { Field, Honeypot, SubmitStatus, friendlyError, inputClass, useFormStartedAt, useSubmitState } from '@/components/FormKit';

export default function ContactPage() {
  const empty = { name: '', email: '', subject: '', message: '' };
  const [form, setForm] = useState(empty);
  const [hp, setHp] = useState('');
  const [state, setState] = useSubmitState();
  const formStartedAt = useFormStartedAt();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'submitting' });
    const { ok, status, body } = await postJson<{ conversion_event_id?: string }>('/api/contact', {
      ...form, website_hp: hp, form_started_at: formStartedAt(), tracking: getFormTrackingContext(),
    });
    if (ok) {
      reportServerConversion('ContactSubmitted', body.conversion_event_id);
      setState({ status: 'success', message: 'Merci, votre message a bien été envoyé. Nous vous répondrons par email.' });
      setForm(empty);
    } else {
      setState({ status: 'error', message: friendlyError(status, body) });
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour</Link>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Contact</h1>
        <p className="text-neutral-400 text-sm mt-2">Partenariat, signalement, données personnelles : écrivez-nous.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Honeypot value={hp} onChange={setHp} />
          <Field id="ct-name" label="Nom" required><input id="ct-name" required maxLength={120} autoComplete="name" value={form.name} onChange={set('name')} className={inputClass} /></Field>
          <Field id="ct-email" label="Email" required><input id="ct-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} /></Field>
          <Field id="ct-subject" label="Sujet"><input id="ct-subject" maxLength={200} value={form.subject} onChange={set('subject')} className={inputClass} /></Field>
          <Field id="ct-message" label="Message" required><textarea id="ct-message" required minLength={10} maxLength={5000} rows={6} value={form.message} onChange={set('message')} className={inputClass} /></Field>
          <button type="submit" disabled={state.status === 'submitting'} className="w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 text-sm">
            {state.status === 'submitting' ? 'Envoi…' : 'Envoyer'}
          </button>
          <SubmitStatus state={state} />
        </form>
      </div>
    </main>
  );
}
