'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { EditorialProfile } from '@/lib/types';

// Local label map, not shared with apps/web/src/app/admin/editorial's copy --
// same "small single-use helper, not centralized until a third caller needs
// it" pattern as domainFromUrl in apps/api/src/admin.js. Public-facing
// wording is softer than the admin panel's (e.g. "Média public" stays the
// same, but nothing here uses the raw enum name).
const TAG_LABELS: Record<string, string> = {
  public_state: 'Média public',
  government_aligned: 'Proche du gouvernement',
  party_aligned: 'Proche d’un parti',
  opposition_aligned: 'Proche de l’opposition',
  independent: 'Indépendant',
  commercial_generalist: 'Commercial / généraliste',
  editorially_mixed: 'Éditorialement mixte',
  specialist: 'Spécialisé',
};

const CONFIDENCE_LABELS: Record<string, string> = { high: 'Élevée', medium: 'Moyenne', low: 'Faible' };

function proximityLine(profile: EditorialProfile): string {
  if (profile.political_party_association) return profile.political_party_association;
  if (profile.classification_tags.includes('public_state') || profile.classification_tags.includes('government_aligned')) {
    return 'Gouvernementale (structurelle)';
  }
  if (profile.classification_tags.includes('party_aligned') || profile.classification_tags.includes('opposition_aligned')) {
    return 'Partisane';
  }
  return 'Aucune proximité documentée';
}

// Badge sits beside the publisher name at the same visual weight as the
// date/publisher-name metadata already there -- never larger, never a
// traffic-light color. Only rendered by the caller when tags is non-empty
// and confidence isn't 'unknown'/null (see CountryPanel.tsx) -- an
// unassessed publisher shows nothing here, not a guess.
export default function EditorialLensBadge({ publisherId }: { publisherId: number }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<EditorialProfile | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (profile === undefined) {
      setLoading(true);
      try {
        setProfile(await api.editorialProfile(publisherId));
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <span className="inline-block relative">
      <button
        onClick={toggle}
        className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/60 text-teal-400 hover:bg-teal-900 hover:text-teal-300 ml-1.5 align-middle"
      >
        Ⓘ Contexte éditorial
      </button>

      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute z-20 left-0 top-full mt-1 w-72 max-w-[80vw] bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-xs shadow-xl"
        >
          {loading && <p className="text-neutral-500">Chargement…</p>}
          {!loading && profile === null && (
            <p className="text-neutral-500">Aucun contexte éditorial disponible pour cet éditeur.</p>
          )}
          {!loading && profile && (
            <>
              <dl className="grid grid-cols-[88px_1fr] gap-y-1 gap-x-2">
                {profile.ownership_type && (
                  <>
                    <dt className="text-neutral-500 uppercase text-[10px] tracking-wide">Propriété</dt>
                    <dd className="text-neutral-200">{profile.ownership_type}</dd>
                  </>
                )}
                <dt className="text-neutral-500 uppercase text-[10px] tracking-wide">Positionnement</dt>
                <dd className="text-neutral-200">
                  {profile.classification_tags.map((t) => TAG_LABELS[t] || t).join(', ') || '—'}
                </dd>
                <dt className="text-neutral-500 uppercase text-[10px] tracking-wide">Proximité pol.</dt>
                <dd className="text-neutral-200">{proximityLine(profile)}</dd>
                <dt className="text-neutral-500 uppercase text-[10px] tracking-wide">Confiance</dt>
                <dd className="text-neutral-200">{CONFIDENCE_LABELS[profile.confidence] || profile.confidence}</dd>
                {profile.last_reviewed && (
                  <>
                    <dt className="text-neutral-500 uppercase text-[10px] tracking-wide">Vérifié le</dt>
                    <dd className="text-neutral-200">{new Date(profile.last_reviewed).toLocaleDateString('fr-FR')}</dd>
                  </>
                )}
              </dl>
              <p className="mt-2 pt-2 border-t border-neutral-800 text-neutral-500 italic">
                Ce contexte vise à informer, pas à juger. Il ne constitue pas un jugement sur la qualité,
                la véracité ou l’indépendance d’un média, et peut évoluer.
              </p>
            </>
          )}
        </span>
      )}
    </span>
  );
}
