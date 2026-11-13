'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import {
  adminApi, UnauthorizedError,
  type Creator, type CreatorCategory, type CreatorConfidence, type CreatorEvidence, type CreatorSummary, type EvidenceKind,
} from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// Review queue of the creator directory (apps/api/src/creators.js). Nothing here is public: a creator only appears
// on the site once approved. Approval needs strong evidence for one of its accounts ("vérifié"), or a reviewer decision
// with a note, which keeps it PROVISIONAL ("sélectionné", Build #248). No audience number is typed
// in here - numbers come from the platforms' APIs or the creator's own connected account.
const PLATFORMS = [['youtube', 'YouTube'], ['facebook', 'Facebook'], ['tiktok', 'TikTok']] as const;
const STATUS_LABEL: Record<Creator['review_status'], string> = {
  candidate: 'candidat', approved: 'approuvé', rejected: 'rejeté', merged: 'fusionné',
};
const CONFIDENCE_LABEL: Record<CreatorConfidence, string> = {
  VERIFIED: 'vérifié', HIGH_CONFIDENCE: 'confiance élevée', PROVISIONAL: 'provisoire', REQUIRES_REVIEW: 'à examiner',
};
// Kinds the API refuses without the page that shows them (Build #233).
const NEEDS_URL = ['platform_badge', 'cross_link', 'official_website'];
const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  platform_badge: 'badge de la plateforme', cross_link: 'lien croisé depuis un compte officiel',
  official_website: 'lien depuis le site officiel', creator_confirmed: 'confirmé par le créateur',
  reviewer: 'décision du relecteur (sélection, note obligatoire)', name_match_only: 'nom identique seulement (faible)',
  impersonator_suspected: 'imposteur suspecté',
};
const VERIFICATION_LABEL = { unverified: 'non vérifié', linked_from_site: 'lié depuis le site', verified: 'vérifié', rejected: 'rejeté' };
const AGENT_LABEL = { global: 'Coordinateur', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok' };

const input = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1';
const small = 'bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5';
// countries.region values: where a creator without a declared country is filed (Build #223).
const REGIONS = [
  'West Africa', 'Central Africa', 'East Africa', 'North Africa', 'Southern Africa', 'Middle East', 'Western Europe', 'Southern Europe',
  'Northern Europe', 'Eastern Europe', 'Europe', 'North America', 'Central America', 'Caribbean', 'South America', 'Caucasus',
  'Central Asia', 'South Asia', 'Southeast Asia', 'East Asia', 'Asia', 'Oceania',
];
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

export default function CreatorsPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [summary, setSummary] = useState<CreatorSummary | null>(null);
  const [categories, setCategories] = useState<CreatorCategory[]>([]);
  const [items, setItems] = useState<Creator[] | null>(null);
  const [filters, setFilters] = useState({ status: 'candidate', country: '', region: '', language: '', platform: '', q: '' });
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ display_name: '', country_iso: '', languages: '', primary: '', second: '', creator_kind: 'individual', discovered_from: '', possible_minor: false });

  function fail(err: unknown) {
    if (err instanceof UnauthorizedError) router.push('/admin/login');
    else setError(err instanceof Error ? err.message : 'Erreur');
  }

  async function load() {
    setError(null);
    const qs = new URLSearchParams({ limit: '200' });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    try {
      const [s, list] = await Promise.all([adminApi.creatorSummary(), adminApi.creators(qs.toString())]);
      setSummary(s);
      setItems(list);
    } catch (err) {
      fail(err);
    }
  }
  useEffect(() => {
    if (ready) {
      load();
      adminApi.creatorCategories().then(setCategories).catch(fail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filters]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setNotice(null);
    setError(null);
    try {
      await fn();
      if (message) setNotice(message);
      await load();
    } catch (err) {
      fail(err);
    }
  }

  if (!ready) return null;
  const t = summary?.totals;
  const groups = categories.filter((c) => !c.parent_slug);
  const categoryOptions = groups.map((g) => (
    <optgroup key={g.slug} label={g.name_fr}>
      <option value={g.slug}>{g.name_fr} (général)</option>
      {categories.filter((c) => c.parent_slug === g.slug).map((c) => <option key={c.slug} value={c.slug}>{c.name_fr}</option>)}
    </optgroup>
  ));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        {error && <p className="text-red-400 text-sm mb-4" role="alert">{error}</p>}
        {notice && <p className="text-green-400 text-sm mb-4" role="status">{notice}</p>}

        <h2 className="text-lg font-semibold mb-2">Créateurs (YouTube, Facebook, TikTok)</h2>
        {t && (
          <p className="text-xs text-neutral-400 mb-4">
            {t.candidates} candidats · {t.approved} approuvés · {t.verified} vérifiés · {t.rejected} rejetés · {t.merged} fusionnés ·
            {' '}{t.accounts} comptes liés · {t.candidates_no_country} candidats sans pays déclaré{t.possible_minor > 0 && <span className="text-orange-400"> · {t.possible_minor} mineur(s) possible(s) à examiner</span>}
          </p>
        )}

        {summary && (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="text-left text-neutral-500 border-b border-neutral-800">
                <th className="py-1.5 pr-3">Agent</th><th className="pr-3">État</th><th className="pr-3">Quota / jour</th>
                <th className="pr-3">Dernière exécution</th><th className="pr-3">Blocage</th><th />
              </tr></thead>
              <tbody>
                {summary.agents.map((a) => (
                  <tr key={a.agent} className="border-b border-neutral-900">
                    <td className="py-1.5 pr-3">{AGENT_LABEL[a.agent]}</td>
                    <td className="pr-3">{a.paused ? `en pause${a.paused_reason ? ` (${a.paused_reason})` : ''}` : 'actif'}</td>
                    <td className="pr-3">{a.daily_quota_units || '—'}</td>
                    <td className="pr-3">{a.last_run_at ? `${fmtDate(a.last_run_at)} · ${a.last_run_status}` : 'jamais'}</td>
                    <td className="pr-3 text-orange-400">{a.blocker ?? ''}</td>
                    <td>
                      <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5"
                        onClick={() => act(() => adminApi.setCreatorAgent(a.agent, !a.paused), a.paused ? 'Agent relancé.' : 'Agent en pause.')}>
                        {a.paused ? 'Relancer' : 'Mettre en pause'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="flex flex-wrap gap-2 mb-6 text-sm" onSubmit={(e) => {
          e.preventDefault();
          const cats = [form.primary, form.second].filter(Boolean);
          act(async () => {
            const r = await adminApi.addCreator({
              display_name: form.display_name, country_iso: form.country_iso || undefined,
              languages: form.languages ? form.languages.split(/[\s,]+/).filter(Boolean).map((l) => l.toLowerCase()) : [],
              categories: cats, primary_category: form.primary || undefined, creator_kind: form.creator_kind,
              discovered_from: form.discovered_from || undefined, possible_minor: form.possible_minor,
            });
            setOpenId(r.id);
            setFilters({ ...filters, status: 'candidate' });
          }, 'Candidat ajouté : liez ses comptes officiels et ajoutez une preuve.');
          setForm({ ...form, display_name: '', discovered_from: '', possible_minor: false });
        }}>
          <input aria-label="Nom du créateur" placeholder="Nom du créateur" required value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={`${input} flex-1 min-w-[12rem]`} />
          <input aria-label="Code pays" placeholder="CI" maxLength={2} value={form.country_iso}
            onChange={(e) => setForm({ ...form, country_iso: e.target.value.toUpperCase() })} className={`${input} w-16`} />
          <input aria-label="Langues" placeholder="fr, dyu" value={form.languages}
            onChange={(e) => setForm({ ...form, languages: e.target.value })} className={`${input} w-24`} />
          <select aria-label="Catégorie principale" value={form.primary} onChange={(e) => setForm({ ...form, primary: e.target.value })} className={input}>
            <option value="">catégorie principale</option>{categoryOptions}
          </select>
          <select aria-label="Seconde catégorie" value={form.second} onChange={(e) => setForm({ ...form, second: e.target.value })} className={input}>
            <option value="">seconde catégorie (option)</option>{categoryOptions}
          </select>
          <select aria-label="Type" value={form.creator_kind} onChange={(e) => setForm({ ...form, creator_kind: e.target.value })} className={input}>
            <option value="individual">personne</option><option value="group">groupe</option><option value="media_brand">marque média</option>
          </select>
          <input aria-label="Trouvé via" placeholder="trouvé via (source)" value={form.discovered_from}
            onChange={(e) => setForm({ ...form, discovered_from: e.target.value })} className={`${input} w-44`} />
          <label className="flex items-center gap-1 text-xs text-neutral-400">
            <input type="checkbox" checked={form.possible_minor} onChange={(e) => setForm({ ...form, possible_minor: e.target.checked })} />
            mineur possible
          </label>
          <button className="bg-orange-600 hover:bg-orange-500 rounded px-3 py-1">Ajouter un candidat</button>
        </form>

        <div className="flex flex-wrap gap-2 mb-4 text-sm">
          <select aria-label="Statut" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={input}>
            <option value="all">tous statuts</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Plateforme" value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })} className={input}>
            <option value="">toutes plateformes</option>
            {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" aria-pressed={filters.country === 'none'}
            onClick={() => setFilters({ ...filters, country: filters.country === 'none' ? '' : 'none' })}
            className={`${input} ${filters.country === 'none' ? 'border-orange-600 text-orange-300' : ''}`}>Pays non déclaré</button>
          {filters.country !== 'none' && (
            <input aria-label="Pays" placeholder="pays (CI)" maxLength={2} defaultValue={filters.country}
              onKeyDown={(e) => { if (e.key === 'Enter') setFilters({ ...filters, country: (e.target as HTMLInputElement).value.toUpperCase() }); }}
              className={`${input} w-24`} />
          )}
          <select aria-label="Région" value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} className={input}>
            <option value="">toutes régions</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input aria-label="Langue" placeholder="langue (fr)" maxLength={3} defaultValue={filters.language}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilters({ ...filters, language: (e.target as HTMLInputElement).value.toLowerCase() }); }}
            className={`${input} w-28`} />
          <input aria-label="Recherche" placeholder="nom" defaultValue={filters.q}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilters({ ...filters, q: (e.target as HTMLInputElement).value }); }}
            className={input} />
        </div>

        {!items && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {items && items.length === 0 && <p className="text-neutral-500 text-sm">Aucun créateur pour ces filtres.</p>}
        <div className="space-y-2">
          {items?.map((c) => (
            <div key={c.id} className="rounded border border-neutral-800 bg-neutral-900 p-3 text-sm">
              <button className="w-full text-left flex flex-wrap justify-between gap-2" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                <span>
                  <span className="font-medium">{c.display_name}</span>
                  <span className="text-xs text-neutral-400">
                    {' '}· {c.country_name ?? `pays non déclaré${c.region ? ` · ${c.region}` : ''}`}
                    {c.languages.length > 0 && <> · {c.languages.join(', ')}</>} · {c.categories.map((x) => x.name_fr).join(', ') || 'catégorie ?'} · {STATUS_LABEL[c.review_status]}
                    {' '}· {CONFIDENCE_LABEL[c.confidence]}
                  </span>
                  {c.possible_minor && <span className="text-xs text-orange-400"> · mineur possible</span>}
                </span>
                <span className="text-xs text-neutral-500">
                  {c.accounts.map((a) => PLATFORMS.find(([k]) => k === a.platform)?.[1]).join(' · ') || 'aucun compte'}
                </span>
              </button>
              {openId === c.id && <CreatorDetail id={c.id} categoryOptions={categoryOptions} act={act} fail={fail} />}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function CreatorDetail({ id, categoryOptions, act, fail }: {
  id: number;
  categoryOptions: ReactNode;
  act: (fn: () => Promise<unknown>, message: string) => Promise<void>;
  fail: (err: unknown) => void;
}) {
  const [c, setC] = useState<(Creator & { evidence: CreatorEvidence[] }) | null>(null);
  const [link, setLink] = useState({ platform: 'youtube', url: '', evidence_kind: '', evidence_url: '' });
  // No preselected type (Build #234): a preselected cross_link was saved by accident twice on 11-11. The API also
  // refuses the kinds a reader can check without their URL (Build #233); the URL field is required for them here too.
  const [ev, setEv] = useState({ social_account_id: '', evidence_kind: '', evidence_url: '', note: '' });

  const reload = () => adminApi.creator(id).then(setC).catch(fail);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const run = (fn: () => Promise<unknown>, message: string) => act(fn, message).then(reload);

  if (!c) return <p className="text-xs text-neutral-500 mt-2">Chargement…</p>;
  const editable = c.review_status !== 'merged';
  return (
    <div className="mt-3 space-y-3 text-xs">
      <p className="text-neutral-400">
        slug {c.slug} · {c.country_name ?? 'pays non déclaré'} · région {c.region ?? '—'} · langues {c.languages.join(', ') || '—'} · trouvé via {c.discovered_from ?? '—'}
        {c.merged_into_id && <> · fusionné dans #{c.merged_into_id}</>}
        {c.reviewer_note && <> · note : {c.reviewer_note}</>}
        {c.publisher_id && <> · source d&apos;actualités liée : #{c.publisher_id} {c.publisher_name}</>}
      </p>

      <div>
        <p className="text-neutral-500 mb-1">Comptes officiels</p>
        {c.accounts.length === 0 && <p className="text-neutral-500">Aucun compte lié.</p>}
        <ul className="space-y-1">
          {c.accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 items-center">
              <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">{a.url}</a>
              <span className={a.verification === 'rejected' ? 'text-red-400' : a.verification === 'verified' ? 'text-green-400' : 'text-neutral-400'}>
                {VERIFICATION_LABEL[a.verification]}
              </span>
              {a.publisher_id && <span className="text-neutral-500">aussi éditeur #{a.publisher_id}</span>}
              {editable && (
                <button className="text-neutral-500 underline" onClick={() => run(() => adminApi.unlinkCreatorAccount(c.id, a.id), 'Compte retiré.')}>retirer</button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form className="flex flex-wrap gap-2 mt-2" onSubmit={async (e) => {
            e.preventDefault();
            const fields = {
              platform: link.platform, url: link.url, evidence_kind: link.evidence_kind || undefined, evidence_url: link.evidence_url || undefined,
            };
            try {
              await adminApi.linkCreatorAccount(c.id, fields);
            } catch (err) {
              // An account that already belongs to a publisher is only linked after an explicit confirmation.
              if (err instanceof Error && /confirm/.test(err.message) && window.confirm(`${err.message}\n\nLier quand même ?`)) {
                await run(() => adminApi.linkCreatorAccount(c.id, { ...fields, link_existing: true }), 'Compte lié.');
                setLink({ ...link, url: '', evidence_url: '' });
                return;
              }
              fail(err);
              return;
            }
            await run(async () => undefined, 'Compte lié.');
            setLink({ ...link, url: '', evidence_url: '' });
          }}>
            <select aria-label="Plateforme" value={link.platform} onChange={(e) => setLink({ ...link, platform: e.target.value })} className={small}>
              {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input aria-label="URL du profil" placeholder="https://youtube.com/@…" required value={link.url}
              onChange={(e) => setLink({ ...link, url: e.target.value })} className={`${small} flex-1 min-w-[14rem]`} />
            <select aria-label="Preuve" value={link.evidence_kind} onChange={(e) => setLink({ ...link, evidence_kind: e.target.value })} className={small}>
              <option value="">preuve (option)</option>
              {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input aria-label="URL de la preuve" placeholder="page qui montre le lien" value={link.evidence_url}
              required={NEEDS_URL.includes(link.evidence_kind)} onChange={(e) => setLink({ ...link, evidence_url: e.target.value })} className={`${small} w-56`} />
            <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5">Lier le compte</button>
          </form>
        )}
      </div>

      <div>
        <p className="text-neutral-500 mb-1">Preuves</p>
        {c.evidence.length === 0 && <p className="text-neutral-500">Aucune preuve.</p>}
        <ul className="space-y-0.5">
          {c.evidence.map((e) => (
            <li key={e.id} className={e.evidence_kind === 'impersonator_suspected' ? 'text-red-400' : 'text-neutral-300'}>
              {fmtDate(e.created_at)} · {EVIDENCE_LABEL[e.evidence_kind]}
              {e.social_account_id && <> · compte #{e.social_account_id}</>}
              {e.evidence_url && <> · <a href={e.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">source</a></>}
              {e.note && <> · {e.note}</>}
            </li>
          ))}
        </ul>
        {editable && c.accounts.length > 0 && (
          <form className="flex flex-wrap gap-2 mt-2" onSubmit={(e) => {
            e.preventDefault();
            run(() => adminApi.addCreatorEvidence(c.id, {
              social_account_id: ev.social_account_id ? Number(ev.social_account_id) : null, evidence_kind: ev.evidence_kind,
              evidence_url: ev.evidence_url || undefined, note: ev.note || undefined,
            }), 'Preuve enregistrée.');
            setEv({ ...ev, evidence_kind: '', evidence_url: '', note: '' });
          }}>
            <select aria-label="Compte" required value={ev.social_account_id} onChange={(e) => setEv({ ...ev, social_account_id: e.target.value })} className={small}>
              <option value="">compte…</option>
              {c.accounts.map((a) => <option key={a.id} value={a.id}>{a.platform} {a.handle ?? a.url}</option>)}
            </select>
            <select aria-label="Type de preuve" required value={ev.evidence_kind} onChange={(e) => setEv({ ...ev, evidence_kind: e.target.value })} className={small}>
              <option value="" disabled>type de preuve…</option>
              {Object.entries(EVIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input aria-label="URL de la preuve" placeholder="https://…" value={ev.evidence_url}
              required={NEEDS_URL.includes(ev.evidence_kind)} onChange={(e) => setEv({ ...ev, evidence_url: e.target.value })} className={`${small} w-56`} />
            <input aria-label="Note" placeholder="note" value={ev.note} onChange={(e) => setEv({ ...ev, note: e.target.value })} className={`${small} w-48`} />
            <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5">Ajouter la preuve</button>
          </form>
        )}
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Catégorie principale" value={c.categories.find((x) => x.primary)?.slug ?? ''} className={small}
            onChange={(e) => {
              const rest = c.categories.filter((x) => !x.primary && x.slug !== e.target.value).map((x) => x.slug);
              run(() => adminApi.updateCreator(c.id, { categories: [e.target.value, ...rest], primary_category: e.target.value }), 'Catégorie enregistrée.');
            }}>
            <option value="" disabled>catégorie principale</option>{categoryOptions}
          </select>
          <input aria-label="Pays du créateur" placeholder="pays (CI)" maxLength={2} defaultValue={c.iso_code ?? ''} className={`${small} w-20`}
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
              if (e.key === 'Enter' && v) run(() => adminApi.updateCreator(c.id, { country_iso: v }), 'Pays enregistré.');
            }} />
          {!c.iso_code && (
            <select aria-label="Région du créateur" value={c.region ?? ''} className={small}
              onChange={(e) => run(() => adminApi.updateCreator(c.id, { region: e.target.value || null }), 'Région enregistrée.')}>
              <option value="">région…</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <input aria-label="Langues du créateur" placeholder="fr, en" defaultValue={c.languages.join(', ')} className={`${small} w-24`}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const langs = (e.target as HTMLInputElement).value.split(/[\s,]+/).filter(Boolean).map((l) => l.toLowerCase());
              run(() => adminApi.updateCreator(c.id, { languages: langs }), 'Langues enregistrées.');
            }} />
          <input aria-label="Source d'actualités liée" placeholder="éditeur n°" title="Numéro de la source d'actualités que ce créateur est aussi (vide pour retirer)"
            defaultValue={c.publisher_id ?? ''} className={`${small} w-24`}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const v = (e.target as HTMLInputElement).value.trim();
              run(() => adminApi.updateCreator(c.id, { publisher_id: v ? Number(v) : null }), v ? 'Source liée.' : 'Lien retiré.');
            }} />
          <select aria-label="Niveau de confiance" value={c.confidence} className={small}
            onChange={(e) => run(() => adminApi.updateCreator(c.id, { confidence: e.target.value }), 'Confiance enregistrée.')}>
            {Object.entries(CONFIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="flex items-center gap-1 text-neutral-400">
            <input type="checkbox" checked={c.possible_minor}
              onChange={(e) => run(() => adminApi.updateCreator(c.id, { possible_minor: e.target.checked }), 'Enregistré.')} />
            mineur possible
          </label>
          {c.review_status !== 'approved' && (
            <button className="bg-green-700 hover:bg-green-600 rounded px-2 py-0.5"
              title="Avec une preuve forte : profil vérifié. Avec seulement une décision du relecteur (note obligatoire) : confiance « provisoire », profil affiché comme sélectionné par la rédaction."
              onClick={() => run(() => adminApi.updateCreator(c.id, { review_status: 'approved' }), 'Approuvé.')}>Approuver</button>
          )}
          {c.review_status !== 'rejected' && (
            <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5" onClick={() => {
              const note = window.prompt('Raison du rejet (optionnel)') ?? undefined;
              run(() => adminApi.updateCreator(c.id, { review_status: 'rejected', ...(note ? { reviewer_note: note } : {}) }), 'Rejeté.');
            }}>Rejeter</button>
          )}
          {c.review_status !== 'candidate' && (
            <button className="bg-neutral-800 hover:bg-neutral-700 rounded px-2 py-0.5"
              onClick={() => run(() => adminApi.updateCreator(c.id, { review_status: 'candidate' }), 'Remis en candidat.')}>Remettre en candidat</button>
          )}
          <button className="text-neutral-500 underline" onClick={() => {
            const into = Number(window.prompt('Fusionner ce doublon dans le créateur n° :') ?? '');
            if (into) run(() => adminApi.mergeCreator(c.id, into), `Fusionné dans #${into}.`);
          }}>fusionner (doublon)</button>
        </div>
      )}
    </div>
  );
}
