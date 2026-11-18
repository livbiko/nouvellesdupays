'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import {
  adminApi, UnauthorizedError,
  type CategoryImportResult, type ChannelClassification, type ChannelClassificationList, type CreatorCategory,
} from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// CR-2026-11-17-02: the category tree (8 main categories, 70 subcategories from the owner's brief, migration 020),
// managed here without code changes, and the subcategories of the /youtube directory channels. Nothing is deleted:
// a category is switched off (hidden on the site; a link to it counts for its main category). Changes show on
// /youtube at once on this API pod, within 5 minutes on the others.
const input = 'bg-neutral-900 border border-neutral-800 rounded px-2 py-1';
const small = 'bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-sm';
const button = 'rounded border border-neutral-700 px-2 py-0.5 text-sm hover:border-neutral-500 disabled:opacity-40';
const primaryButton = 'rounded bg-orange-600 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-40';
const RAIL_LABEL: Record<string, string> = {
  national_tv: 'TV nationale', live_now: 'Info en continu', local_voices: 'Voix locales', africa_voices: 'Voix panafricaines',
};
const PAGE = 50;

type Tab = 'tree' | 'channels' | 'csv';

export default function CategoriesPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [tab, setTab] = useState<Tab>('tree');
  const [categories, setCategories] = useState<CreatorCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = useCallback((err: unknown) => {
    if (err instanceof UnauthorizedError) router.push('/admin/login');
    else setError(err instanceof Error ? err.message : 'Erreur');
  }, [router]);

  const load = useCallback(() => adminApi.creatorCategories().then(setCategories).catch(fail), [fail]);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
      await load();
    } catch (err) {
      fail(err);
    }
  }

  if (!ready) return null;
  const mains = categories.filter((c) => !c.parent_slug);
  const subsOf = (slug: string) => categories.filter((c) => c.parent_slug === slug);
  const activeMains = mains.filter((c) => c.active !== false);
  const categoryOptions: ReactNode = activeMains.map((g) => (
    <optgroup key={g.slug} label={g.name_fr}>
      <option value={g.slug}>{g.name_fr} (général)</option>
      {subsOf(g.slug).filter((c) => c.active !== false).map((c) => <option key={c.slug} value={c.slug}>{c.name_fr}</option>)}
    </optgroup>
  ));
  const on = categories.filter((c) => c.active !== false);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        <h1 className="mt-6 text-2xl font-bold">Catégories</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {on.filter((c) => !c.parent_slug).length} catégories principales et {on.filter((c) => c.parent_slug).length} sous-catégories actives
          {categories.length > on.length ? `, ${categories.length - on.length} désactivée(s)` : ''}. Rien n’est supprimé : une catégorie
          désactivée est masquée sur le site et ses liens comptent pour sa catégorie principale.
        </p>
        <nav className="mt-4 flex gap-2 border-b border-neutral-800" aria-label="Onglets">
          {([['tree', 'Arborescence'], ['channels', 'Classement des chaînes'], ['csv', 'Import / export CSV']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-orange-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}>
              {label}
            </button>
          ))}
        </nav>
        {error && <p role="alert" className="mt-4 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{notice}</p>}

        {tab === 'tree' && <Tree mains={mains} subsOf={subsOf} run={run} />}
        {tab === 'channels' && <Channels categoryOptions={categoryOptions} categories={categories} fail={fail} setNotice={setNotice} setError={setError} />}
        {tab === 'csv' && <Csv fail={fail} />}
      </div>
    </main>
  );
}

// --- Arborescence --------------------------------------------------------------------------------------------------

function Tree({ mains, subsOf, run }: {
  mains: CreatorCategory[]; subsOf: (slug: string) => CreatorCategory[];
  run: (action: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const [newMain, setNewMain] = useState({ slug: '', name_fr: '' });
  const move = (list: CreatorCategory[], i: number, d: -1 | 1) => {
    const slugs = list.map((c) => c.slug);
    [slugs[i], slugs[i + d]] = [slugs[i + d], slugs[i]];
    return slugs;
  };
  return (
    <section className="mt-4 space-y-4">
      {mains.map((m, i) => (
        <div key={m.slug} className={`rounded-xl border border-neutral-800 p-3 ${m.active === false ? 'opacity-60' : ''}`}>
          <CategoryRow c={m} main mains={mains} run={run}
            up={i > 0 ? () => run(() => adminApi.orderCategories(null, move(mains, i, -1)), 'Ordre enregistré.') : undefined}
            down={i < mains.length - 1 ? () => run(() => adminApi.orderCategories(null, move(mains, i, 1)), 'Ordre enregistré.') : undefined} />
          <ul className="mt-2 space-y-1 border-l border-neutral-800 pl-4">
            {subsOf(m.slug).map((s, j, list) => (
              <li key={s.slug}>
                <CategoryRow c={s} mains={mains} run={run}
                  up={j > 0 ? () => run(() => adminApi.orderCategories(m.slug, move(list, j, -1)), 'Ordre enregistré.') : undefined}
                  down={j < list.length - 1 ? () => run(() => adminApi.orderCategories(m.slug, move(list, j, 1)), 'Ordre enregistré.') : undefined} />
              </li>
            ))}
            <li><AddSub parent={m} run={run} /></li>
          </ul>
        </div>
      ))}
      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-neutral-700 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => adminApi.addCategory(newMain), `Catégorie « ${newMain.name_fr} » ajoutée.`).then(() => setNewMain({ slug: '', name_fr: '' }));
        }}>
        <span className="w-full text-sm font-semibold">Ajouter une catégorie principale</span>
        <label className="text-sm">Nom<input className={`${input} ml-1`} value={newMain.name_fr} required
          onChange={(e) => setNewMain({ ...newMain, name_fr: e.target.value })} /></label>
        <label className="text-sm">Identifiant (URL)<input className={`${input} ml-1`} value={newMain.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="ex. sante" onChange={(e) => setNewMain({ ...newMain, slug: e.target.value })} /></label>
        <button type="submit" className={primaryButton}>Ajouter</button>
      </form>
    </section>
  );
}

function CategoryRow({ c, main = false, mains, run, up, down }: {
  c: CreatorCategory; main?: boolean; mains: CreatorCategory[];
  run: (action: () => Promise<unknown>, done: string) => Promise<void>; up?: () => void; down?: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name_fr: c.name_fr, name_en: c.name_en, description_fr: c.description_fr || '' });
  const counts = [
    c.approved_creators ? `${c.approved_creators} créateur(s) approuvé(s)` : null,
    c.creators ? `${c.creators} lien(s) créateur` : null,
    c.channels ? `${c.channels} chaîne(s)` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex gap-1">
          <button type="button" className={button} onClick={up} disabled={!up} aria-label={`Monter ${c.name_fr}`}>↑</button>
          <button type="button" className={button} onClick={down} disabled={!down} aria-label={`Descendre ${c.name_fr}`}>↓</button>
        </span>
        <span className={main ? 'text-base font-semibold' : ''}>{c.name_fr}</span>
        <code className="text-xs text-neutral-500">{c.slug}</code>
        {c.active === false && <span className="rounded bg-neutral-800 px-1.5 text-xs text-neutral-300">désactivée</span>}
        {counts && <span className="text-xs text-neutral-500">{counts}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {!main && (
            <label className="text-xs text-neutral-400">Déplacer vers
              <select className={`${small} ml-1`} value={c.parent_slug || ''}
                onChange={(e) => run(() => adminApi.updateCategory(c.slug, { parent_slug: e.target.value }), `« ${c.name_fr} » déplacée.`)}>
                {mains.map((m) => <option key={m.slug} value={m.slug}>{m.name_fr}</option>)}
              </select>
            </label>
          )}
          <button type="button" className={button} onClick={() => setEdit(!edit)} aria-expanded={edit}>Modifier</button>
          <button type="button" className={button}
            onClick={() => run(() => adminApi.updateCategory(c.slug, { active: c.active === false }),
              c.active === false ? `« ${c.name_fr} » réactivée.` : `« ${c.name_fr} » désactivée.`)}>
            {c.active === false ? 'Réactiver' : 'Désactiver'}
          </button>
        </span>
      </div>
      {edit && (
        <form className="mt-2 grid gap-2 rounded border border-neutral-800 p-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => adminApi.updateCategory(c.slug, form), `« ${form.name_fr} » enregistrée.`).then(() => setEdit(false));
          }}>
          <label className="text-xs text-neutral-400">Nom (affiché sur le site)
            <input className={`${input} mt-1 block w-full`} value={form.name_fr} required maxLength={80}
              onChange={(e) => setForm({ ...form, name_fr: e.target.value })} /></label>
          <label className="text-xs text-neutral-400">Nom anglais (administration)
            <input className={`${input} mt-1 block w-full`} value={form.name_en} required maxLength={80}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></label>
          <label className="text-xs text-neutral-400 sm:col-span-2">Description (pages catégorie)
            <textarea className={`${input} mt-1 block w-full`} rows={2} maxLength={500} value={form.description_fr}
              onChange={(e) => setForm({ ...form, description_fr: e.target.value })} /></label>
          <span className="flex gap-2 sm:col-span-2">
            <button type="submit" className={primaryButton}>Enregistrer</button>
            <button type="button" className={button} onClick={() => setEdit(false)}>Annuler</button>
          </span>
        </form>
      )}
    </div>
  );
}

function AddSub({ parent, run }: { parent: CreatorCategory; run: (action: () => Promise<unknown>, done: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: '', name_fr: '' });
  if (!open) {
    return <button type="button" className="text-xs text-orange-400 hover:underline" onClick={() => setOpen(true)}>+ Ajouter une sous-catégorie</button>;
  }
  return (
    <form className="flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => adminApi.addCategory({ ...form, parent_slug: parent.slug }), `« ${form.name_fr} » ajoutée.`)
          .then(() => { setForm({ slug: '', name_fr: '' }); setOpen(false); });
      }}>
      <label>Nom<input className={`${small} ml-1`} value={form.name_fr} required onChange={(e) => setForm({ ...form, name_fr: e.target.value })} /></label>
      <label>Identifiant<input className={`${small} ml-1`} value={form.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*"
        onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
      <button type="submit" className={button}>Ajouter</button>
      <button type="button" className={button} onClick={() => setOpen(false)}>Annuler</button>
    </form>
  );
}

// --- Classement des chaînes ----------------------------------------------------------------------------------------

function Channels({ categoryOptions, categories, fail, setNotice, setError }: {
  categoryOptions: ReactNode; categories: CreatorCategory[]; fail: (err: unknown) => void;
  setNotice: (s: string | null) => void; setError: (s: string | null) => void;
}) {
  const [filters, setFilters] = useState({ q: '', country: '', status: 'unclassified', category: '' });
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<ChannelClassificationList | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), limit: String(PAGE), offset: String(offset) });
    adminApi.channelCategories(qs.toString()).then(setData).catch(fail);
  }, [filters, offset, fail]);
  useEffect(() => { load(); }, [load]);

  async function save(ch: ChannelClassification, slugs: string[]) {
    setError(null);
    setNotice(null);
    try {
      await adminApi.setChannelCategories(ch.key, slugs, slugs[0]);
      setNotice(`« ${ch.name} » classée.`);
      load();
    } catch (err) {
      fail(err);
    }
  }

  const name = Object.fromEntries(categories.map((c) => [c.slug, c.name_fr]));
  return (
    <section className="mt-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setOffset(0); load(); }}>
        <label className="sr-only" htmlFor="ch-q">Rechercher</label>
        <input id="ch-q" className={input} placeholder="Nom de la chaîne" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <label className="sr-only" htmlFor="ch-country">Pays</label>
        <input id="ch-country" className={`${input} w-24`} placeholder="Pays (CI)" maxLength={2} value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value.toUpperCase() })} />
        <select aria-label="État" className={input} value={filters.status} onChange={(e) => { setOffset(0); setFilters({ ...filters, status: e.target.value }); }}>
          <option value="unclassified">Non classées</option>
          <option value="classified">Classées</option>
          <option value="all">Toutes</option>
        </select>
        <select aria-label="Catégorie" className={input} value={filters.category} onChange={(e) => { setOffset(0); setFilters({ ...filters, category: e.target.value }); }}>
          <option value="">Toutes les catégories</option>{categoryOptions}
        </select>
        <button type="submit" className={button}>Filtrer</button>
      </form>
      {data && (
        <p className="mt-3 text-sm text-neutral-400">
          {data.classified} chaîne(s) classée(s) sur {data.total}. {data.items.length ? `Affichage ${offset + 1}–${offset + data.items.length}.` : 'Aucune chaîne pour ces filtres.'}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {data?.items.map((ch) => (
          <ChannelRow key={ch.key} ch={ch} name={name} categoryOptions={categoryOptions} save={save} />
        ))}
      </ul>
      {data && (
        <div className="mt-4 flex gap-2">
          <button type="button" className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(offset - PAGE, 0))}>← Précédentes</button>
          <button type="button" className={button} disabled={data.items.length < PAGE} onClick={() => setOffset(offset + PAGE)}>Suivantes →</button>
        </div>
      )}
    </section>
  );
}

function ChannelRow({ ch, name, categoryOptions, save }: {
  ch: ChannelClassification; name: Record<string, string>; categoryOptions: ReactNode;
  save: (ch: ChannelClassification, slugs: string[]) => Promise<void>;
}) {
  const current = [...ch.categories].sort((a, b) => Number(b.primary) - Number(a.primary)).map((c) => c.slug);
  const [picks, setPicks] = useState<string[]>([current[0] || '', current[1] || '', current[2] || '']);
  const chosen = [...new Set(picks.filter(Boolean))];
  return (
    <li className="rounded-lg border border-neutral-800 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {ch.logo_url
          ? <img src={ch.logo_url} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 rounded-full bg-neutral-800 object-cover" />
          : <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-xs">{ch.name.charAt(0)}</span>}
        <span className="font-semibold">{ch.name}</span>
        <span className="text-xs text-neutral-500">{ch.countries.join(', ') || 'sans pays'} · {ch.rails.map((r) => RAIL_LABEL[r] || r).join(', ')}
          {ch.topics.length ? ` · thème ${ch.topics.join(', ')}` : ''}</span>
        {ch.categories.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {ch.categories.map((c) => (
              <span key={c.slug} className={`rounded-full px-2 text-xs ${c.primary ? 'bg-orange-950 text-orange-300' : 'border border-neutral-700 text-neutral-300'}`}>
                {name[c.slug] || c.slug}{c.active ? '' : ' (désactivée)'}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {['Sous-catégorie principale', 'Autre (option)', 'Autre (option)'].map((label, i) => (
          <select key={label + i} aria-label={label} className={small} value={picks[i]}
            onChange={(e) => setPicks(picks.map((p, j) => (j === i ? e.target.value : p)))}>
            <option value="">{label}</option>{categoryOptions}
          </select>
        ))}
        <button type="button" className={primaryButton} disabled={!picks[0]} onClick={() => save(ch, chosen)}>Enregistrer</button>
      </div>
    </li>
  );
}

// --- Import / export -----------------------------------------------------------------------------------------------

function Csv({ fail }: { fail: (err: unknown) => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<CategoryImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    try {
      const blob = await adminApi.exportChannelCategories();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'classement-chaines.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      fail(err);
    }
  }

  async function importCsv(dryRun: boolean) {
    setBusy(true);
    try {
      setResult(await adminApi.importChannelCategories(csv, dryRun));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4 text-sm">
      <div className="rounded-xl border border-neutral-800 p-3">
        <h2 className="font-semibold">Exporter</h2>
        <p className="mt-1 text-neutral-400">Toutes les chaînes du répertoire avec leur sous-catégorie principale et les autres (colonnes key, primary, others).</p>
        <button type="button" className={`${button} mt-2`} onClick={exportCsv}>Télécharger le CSV</button>
      </div>
      <div className="rounded-xl border border-neutral-800 p-3">
        <h2 className="font-semibold">Importer</h2>
        <p className="mt-1 text-neutral-400">
          Le fichier exporté ci-dessus, ou le fichier de relecture <code>classification.csv</code> avec la colonne owner_decision :
          « ok » = la proposition, « slug;slug » = ces sous-catégories (la première est la principale), « reject » ou vide = ignorée.
          Séparateur virgule ou point-virgule (Excel). Vérifiez d’abord : rien n’est enregistré tant que vous n’appliquez pas.
        </p>
        <input type="file" accept=".csv,text/csv" className="mt-2 block text-sm" aria-label="Fichier CSV"
          onChange={async (e) => { const f = e.target.files?.[0]; setResult(null); setCsv(f ? await f.text() : ''); }} />
        <label className="mt-2 block text-xs text-neutral-400">ou collez le contenu
          <textarea className={`${input} mt-1 block w-full font-mono text-xs`} rows={6} value={csv} onChange={(e) => { setResult(null); setCsv(e.target.value); }} />
        </label>
        <div className="mt-2 flex gap-2">
          <button type="button" className={button} disabled={!csv.trim() || busy} onClick={() => importCsv(true)}>Vérifier (sans enregistrer)</button>
          <button type="button" className={primaryButton} disabled={!csv.trim() || busy || !result || !result.dry_run || result.errors.length > 0 && result.applied === 0}
            onClick={() => importCsv(false)}>Appliquer</button>
        </div>
        {result && (
          <div className="mt-3 rounded border border-neutral-800 p-2" role="status">
            <p>{result.dry_run ? 'Vérification' : 'Import appliqué'} : {result.rows} ligne(s), {result.applied} {result.dry_run ? 'à appliquer' : 'appliquée(s)'},
              {' '}{result.skipped} ignorée(s), {result.errors.length} erreur(s).</p>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-red-300">
                {result.errors.map((e) => <li key={`${e.line}-${e.key}`}>ligne {e.line} ({e.key || 'sans clé'}) : {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
