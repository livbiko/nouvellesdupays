'use client';

import { useCallback, useRef, useState } from 'react';
import { track } from '@/lib/tracking';
import type { EventName } from '@/lib/trackingEvents';

// Shared building blocks for the public forms (publisher registration,
// YouTube submission, visitor registration, contact). Keeps labels,
// error/help text and the anti-spam fields consistent and accessible.

export const inputClass =
  'w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500 aria-[invalid=true]:border-red-500';

// Render timestamp for the anti-spam minimum fill time.
export function useFormStartedAt() {
  const startedAt = useRef<number>(0);
  if (startedAt.current === 0 && typeof window !== 'undefined') startedAt.current = Date.now();
  return () => startedAt.current || Date.now();
}

// Render timestamp + "started" event fired once, on first interaction.
export function useFormTracking(startedEvent: EventName, props?: Record<string, string>) {
  const formStartedAt = useFormStartedAt();
  const fired = useRef(false);
  const onFirstInteraction = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    track(startedEvent, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedEvent]);
  return { formStartedAt, onFirstInteraction };
}

// Invisible to people (and to assistive tech), irresistible to form bots.
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Website
        <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function Field({
  id,
  label,
  required,
  help,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-neutral-300 mb-1">
        {label}
        {required ? <span className="text-orange-400" aria-hidden="true"> *</span> : <span className="text-neutral-600"> (optionnel)</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-neutral-500 mt-1">
          {help}
        </p>
      )}
    </div>
  );
}

export type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export function SubmitStatus({ state }: { state: SubmitState }) {
  return (
    <div aria-live="polite" role="status" className="min-h-[1.25rem]">
      {state.status === 'success' && <p className="text-green-400 text-sm">{state.message}</p>}
      {state.status === 'error' && <p className="text-red-400 text-sm">{state.message}</p>}
    </div>
  );
}

export function useSubmitState() {
  return useState<SubmitState>({ status: 'idle' });
}

// French user-facing messages for the API's English error strings.
export function friendlyError(status: number, body: { error?: string; detail?: string; reason?: string } | null): string {
  if (status === 429) return 'Trop de tentatives. Merci de réessayer un peu plus tard.';
  if (status === 409) return 'Cette soumission existe déjà (déjà enregistrée ou en cours de validation).';
  if (status === 503) return 'Les soumissions sont temporairement fermées.';
  if (body?.reason === 'too_fast') return 'Merci de prendre le temps de remplir le formulaire, puis réessayez.';
  if (body?.reason) return 'La soumission a été bloquée par notre filtre anti-spam.';
  if (body?.detail) return `${body.error ?? 'Erreur'} : ${body.detail}`;
  return body?.error || 'La soumission a échoué. Merci de réessayer.';
}
