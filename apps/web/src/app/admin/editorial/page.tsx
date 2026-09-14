'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  adminApi, UnauthorizedError, EDITORIAL_TAGS, CONFIDENCE_LEVELS,
  type EditorialProfile, type EvidenceSource,
} from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

const TAG_LABELS: Record<string, string> = {
  public_state: 'Média public / État',
  government_aligned: 'Proche du gouvernement',
  party_aligned: 'Proche d’un parti',
  opposition_aligned: 'Proche de l’opposition',
  independent: 'Indépendant',
  commercial_generalist: 'Commercial / généraliste',
  editorially_mixed: 'Éditorialement mixte',
  specialist: 'Spécialisé',
  unknown: 'Non évalué',
};

interface FormState {
  ownership_type: string;
  owner: string;
  classification_tags: string[];
  political_party_association: string;
  historical_context: string;
  current_context: string;
  confidence: EditorialProfile['confidence'];
  evidence_summary: string;
  evidence_sources_json: string;
  evidence_date: string;
  review_required: boolean;
}

function toFormState(p: EditorialProfile): FormState {
  return {
    ownership_type: p.ownership_type || '',
    owner: p.owner || '',
    classification_tags: p.classification_tags || [],
    political_party_association: p.political_party_association || '',
    historical_context: p.historical_context || '',
    current_context: p.current_context || '',
    confidence: p.confidence || 'unknown',
    evidence_summary: p.evidence_summary || '',
    evidence_sources_json: JSON.stringify(p.evidence_sources || [], null, 2),
    evidence_date: p.evidence_date ? p.evidence_date.slice(0, 10) : '',
    review_required: Boolean(p.review_required),
  };
}

export default function AdminEditorial() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [profiles, setProfiles] = useState<EditorialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await adminApi.editorialProfiles());
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.push('/admin/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function toggleExpand(p: EditorialProfile) {
    if (expandedId === p.publisher_id) {
      setExpandedId(null);
      setForm(null);
      return;
    }
    setExpandedId(p.publisher_id);
    setForm(toFormState(p));
    setSaveError(null);
  }

  function toggleTag(tag: string) {
    if (!form) return;
    const has = form.classification_tags.includes(tag);
    setForm({
      ...form,
      classification_tags: has
        ? form.classification_tags.filter((t) => t !== tag)
        : [...form.classification_tags, tag],
    });
  }

  async function handleSave(publisherId: number) {
    if (!form) return;
    let evidenceSources: EvidenceSource[];
    try {
      evidenceSources = form.evidence_sources_json.trim() ? JSON.parse(form.evidence_sources_json) : [];
      if (!Array.isArray(evidenceSources)) throw new Error('not an array');
    } catch {
      setSaveError('Sources (JSON) : format invalide -- doit être un tableau JSON.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await adminApi.saveEditorialProfile(publisherId, {
        ownership_type: form.ownership_type || null,
        owner: form.owner || null,
        classification_tags: form.classification_tags,
        political_party_association: form.political_party_association || null,
        historical_context: form.historical_context || null,
        current_context: form.current_context || null,
        confidence: form.confidence,
        evidence_summary: form.evidence_summary || null,
        evidence_sources: evidenceSources,
        evidence_date: form.evidence_date || null,
        review_required: form.review_required,
      });
      setExpandedId(null);
      setForm(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            NouvellesDuPays <span className="text-orange-500">Admin</span>
          </h1>
          <nav className="mt-2 flex gap-4 text-sm">
            <Link href="/admin" className="text-neutral-500 hover:text-neutral-300">Soumissions</Link>
            <Link href="/admin/publishers" className="text-neutral-500 hover:text-neutral-300">Éditeurs</Link>
            <Link href="/admin/invitations" className="text-neutral-500 hover:text-neutral-300">Invitations</Link>
            <span className="text-neutral-300 font-medium">Contexte éditorial</span>
          </nav>
        </div>

        <p className="text-xs text-neutral-500 mb-4 max-w-2xl">
          Le positionnement éditorial est un contexte, pas un jugement -- chaque classification doit citer une source.
          Un éditeur sans profil s'affiche comme « Non évalué », jamais comme une supposition.
        </p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Chargement…</p>}

        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.publisher_id} className="rounded border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.publisher_name}{' '}
                    <span className="text-neutral-500 text-sm">({p.country_name})</span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.classification_tags.length === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-500">Non évalué</span>
                    )}
                    {p.classification_tags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded bg-teal-950 text-teal-300">
                        {TAG_LABELS[t] || t}
                      </span>
                    ))}
                    {p.profile_id && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        p.confidence === 'high' ? 'bg-green-950 text-green-300' :
                        p.confidence === 'medium' ? 'bg-yellow-950 text-yellow-300' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        Confiance : {p.confidence}
                      </span>
                    )}
                    {p.review_required && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-950 text-red-300">À revoir</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleExpand(p)}
                  className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 shrink-0"
                >
                  {expandedId === p.publisher_id ? 'Fermer' : 'Modifier'}
                </button>
              </div>

              {expandedId === p.publisher_id && form && (
                <div className="mt-4 pt-4 border-t border-neutral-800 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-neutral-500">
                      Type de propriété
                      <input
                        value={form.ownership_type}
                        onChange={(e) => setForm({ ...form, ownership_type: e.target.value })}
                        placeholder="ex. État de Côte d'Ivoire"
                        className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                      />
                    </label>
                    <label className="text-xs text-neutral-500">
                      Propriétaire
                      <input
                        value={form.owner}
                        onChange={(e) => setForm({ ...form, owner: e.target.value })}
                        className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                      />
                    </label>
                  </div>

                  <div>
                    <span className="text-xs text-neutral-500">Classification (sélection multiple)</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {EDITORIAL_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-2.5 py-1 rounded border ${
                            form.classification_tags.includes(tag)
                              ? 'bg-teal-900 border-teal-700 text-teal-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                          }`}
                        >
                          {TAG_LABELS[tag] || tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-neutral-500">
                      Parti politique associé
                      <input
                        value={form.political_party_association}
                        onChange={(e) => setForm({ ...form, political_party_association: e.target.value })}
                        placeholder="ex. PDCI-RDA"
                        className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                      />
                    </label>
                    <label className="text-xs text-neutral-500">
                      Confiance
                      <select
                        value={form.confidence}
                        onChange={(e) => setForm({ ...form, confidence: e.target.value as EditorialProfile['confidence'] })}
                        className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                      >
                        {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="text-xs text-neutral-500 block">
                    Contexte historique
                    <textarea
                      value={form.historical_context}
                      onChange={(e) => setForm({ ...form, historical_context: e.target.value })}
                      placeholder="ex. Historiquement l'organe du PDCI-RDA."
                      rows={2}
                      className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                    />
                  </label>

                  <label className="text-xs text-neutral-500 block">
                    Contexte actuel
                    <textarea
                      value={form.current_context}
                      onChange={(e) => setForm({ ...form, current_context: e.target.value })}
                      placeholder="ex. Structure de propriété actuelle non revérifiée depuis..."
                      rows={2}
                      className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                    />
                  </label>

                  <label className="text-xs text-neutral-500 block">
                    Résumé des preuves
                    <textarea
                      value={form.evidence_summary}
                      onChange={(e) => setForm({ ...form, evidence_summary: e.target.value })}
                      rows={2}
                      className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                    />
                  </label>

                  <label className="text-xs text-neutral-500 block">
                    Sources (JSON -- tableau de {'{'}category, url, note, accessed_at{'}'})
                    <textarea
                      value={form.evidence_sources_json}
                      onChange={(e) => setForm({ ...form, evidence_sources_json: e.target.value })}
                      rows={5}
                      spellCheck={false}
                      className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs font-mono text-neutral-200"
                    />
                  </label>

                  <div className="flex items-center gap-4">
                    <label className="text-xs text-neutral-500">
                      Date de la preuve la plus récente
                      <input
                        type="date"
                        value={form.evidence_date}
                        onChange={(e) => setForm({ ...form, evidence_date: e.target.value })}
                        className="mt-1 block bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-200"
                      />
                    </label>
                    <label className="text-xs text-neutral-500 flex items-center gap-2 mt-5">
                      <input
                        type="checkbox"
                        checked={form.review_required}
                        onChange={(e) => setForm({ ...form, review_required: e.target.checked })}
                      />
                      À revoir manuellement
                    </label>
                  </div>

                  {saveError && <p className="text-red-400 text-xs">{saveError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleSave(p.publisher_id)}
                      disabled={saving}
                      className="text-xs px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white"
                    >
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
