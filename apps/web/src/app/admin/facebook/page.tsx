'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type AdminFacebookVideo, type CreatorCategory, type FacebookVideoInput } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

// CR-2026-11-27-01: the videos of /facebook. Everything is typed here: our servers never open the Facebook link (the
// API only checks that it is a facebook.com or fb.watch address). The thumbnail is optional - a screenshot or image
// the team has the right to use, uploaded here (JPEG, PNG or WebP, 400 KB at most). "Masquer" takes a video off the
// public page without deleting it.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TYPES: [string, string][] = [
  ['', '—'], ['tv-nationale', 'Télévision nationale'], ['tv-continu', 'Télévision en continu'], ['voix-locales', 'Voix locales'],
  ['voix-panafricaines', 'Voix panafricaines'], ['media-en-ligne', 'Média en ligne'], ['createur-independant', 'Créateur indépendant'], ['collectif', 'Collectif'],
];
const LANGS: [string, string][] = [['', '—'], ['fr', 'Français'], ['en', 'Anglais'], ['ar', 'Arabe'], ['pt', 'Portugais'], ['es', 'Espagnol'], ['sw', 'Swahili']];

type Form = { url: string; title: string; page_name: string; page_url: string; published_at: string; country: string; category: string; type: string; language: string };
const EMPTY: Form = { url: '', title: '', page_name: '', page_url: '', published_at: '', country: '', category: '', type: '', language: '' };

function readFile(file: File): Promise<{ type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ type: file.type, data: String(r.result).split(',')[1] || '' });
    r.onerror = () => reject(new Error('Lecture du fichier impossible'));
    r.readAsDataURL(file);
  });
}

export default function AdminFacebook() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [videos, setVideos] = useState<AdminFacebookVideo[]>([]);
  const [countries, setCountries] = useState<{ iso_code: string; name: string }[]>([]);
  const [categories, setCategories] = useState<CreatorCategory[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (err: unknown) => {
    if (err instanceof UnauthorizedError) router.push('/admin/login');
    else setError(err instanceof Error ? err.message : 'Erreur');
  };
  async function load() {
    setLoading(true);
    try {
      setVideos(await adminApi.facebookVideos());
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!ready) return;
    load();
    fetch(`${API_URL}/api/countries`).then((r) => r.json()).then((rows) => setCountries(rows.map((c: { iso_code: string; name: string }) => ({ iso_code: c.iso_code.trim(), name: c.name })))).catch(() => {});
    adminApi.creatorCategories().then(setCategories).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body: FacebookVideoInput = {
        url: form.url, title: form.title, page_name: form.page_name, page_url: form.page_url || null,
        published_at: `${form.published_at}:00Z`, country: form.country || null, category: form.category || null,
        type: form.type || null, language: form.language || null,
      };
      if (file) body.thumbnail = await readFile(file);
      if (editing) {
        await adminApi.updateFacebookVideo(editing, body);
        setNotice('Vidéo modifiée.');
      } else {
        await adminApi.addFacebookVideo(body);
        setNotice('Vidéo ajoutée : elle est visible sur /facebook dans la minute.');
      }
      setForm(EMPTY);
      setFile(null);
      setEditing(null);
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  function edit(v: AdminFacebookVideo) {
    setEditing(v.id);
    setFile(null);
    setForm({
      url: v.url, title: v.title, page_name: v.page_name, page_url: v.page_url || '', published_at: v.published_at.slice(0, 16),
      country: v.country_iso || '', category: v.category || '', type: v.type || '', language: v.language || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  const input = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-orange-500 focus:outline-none';
  const shown = videos.filter((v) => v.review_status === 'approved').length;
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <AdminNav />
        <h2 className="text-lg font-semibold">Vidéos Facebook <span className="text-sm font-normal text-neutral-500">· {shown} visibles sur /facebook, {videos.length - shown} masquées</span></h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Collez le lien de la vidéo (facebook.com ou fb.watch) et recopiez son titre, sa page et sa date. Nos serveurs n’ouvrent
          jamais le lien. La miniature est facultative : une image que nous avons le droit d’utiliser (JPEG, PNG ou WebP, 400 Ko au plus).
        </p>

        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">Lien de la vidéo *
            <input required className={input} value={form.url} onChange={set('url')} placeholder="https://www.facebook.com/…/videos/…" />
          </label>
          <label className="sm:col-span-2 text-sm">Titre *
            <input required maxLength={300} className={input} value={form.title} onChange={set('title')} />
          </label>
          <label className="text-sm">Page Facebook (nom) *
            <input required maxLength={200} className={input} value={form.page_name} onChange={set('page_name')} />
          </label>
          <label className="text-sm">Lien de la page
            <input className={input} value={form.page_url} onChange={set('page_url')} placeholder="https://www.facebook.com/…" />
          </label>
          <label className="text-sm">Date de publication (UTC) *
            <input required type="datetime-local" className={input} value={form.published_at} onChange={set('published_at')} />
          </label>
          <label className="text-sm">Pays
            <select className={input} value={form.country} onChange={set('country')}>
              <option value="">—</option>
              {countries.map((c) => <option key={c.iso_code} value={c.iso_code}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Catégorie
            <select className={input} value={form.category} onChange={set('category')}>
              <option value="">—</option>
              {categories.filter((c) => c.active !== false).map((c) => <option key={c.slug} value={c.slug}>{c.parent_slug ? '— ' : ''}{c.name_fr}</option>)}
            </select>
          </label>
          <label className="text-sm">Type
            <select className={input} value={form.type} onChange={set('type')}>
              {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm">Langue
            <select className={input} value={form.language} onChange={set('language')}>
              {LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm">Miniature {editing ? '(laisser vide pour garder l’actuelle)' : ''}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-sm text-neutral-300"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex items-end gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50">
              {editing ? 'Enregistrer' : 'Ajouter la vidéo'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="text-sm text-neutral-400 hover:text-neutral-200">Annuler</button>
            )}
          </div>
        </form>

        {error && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p className="mt-4 rounded-lg border border-green-900 bg-green-950/40 p-3 text-sm text-green-300">{notice}</p>}

        {loading ? <p className="mt-6 text-sm text-neutral-500">Chargement…</p> : videos.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">Aucune vidéo pour le moment.</p>
        ) : (
          <ul className="mt-6 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {videos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-100">
                    {v.title}{' '}
                    {v.review_status === 'hidden' && <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">masquée</span>}
                  </p>
                  <p className="truncate text-xs text-neutral-400">
                    {v.page_name} · {v.country_name || 'sans pays'} · {new Date(v.published_at).toLocaleDateString('fr-FR')}
                    {v.has_thumbnail ? ' · miniature' : ''}
                  </p>
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-orange-400 hover:underline">{v.url}</a>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <button type="button" disabled={busy} onClick={() => edit(v)} className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500">Modifier</button>
                  {v.has_thumbnail && (
                    <button type="button" disabled={busy} onClick={() => act(() => adminApi.updateFacebookVideo(v.id, { thumbnail: null }))}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-neutral-500">Retirer la miniature</button>
                  )}
                  {v.review_status === 'approved' ? (
                    <button type="button" disabled={busy} onClick={() => act(() => adminApi.hideFacebookVideo(v.id))}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-red-500">Masquer</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => act(() => adminApi.updateFacebookVideo(v.id, { review_status: 'approved' }))}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs hover:border-green-500">Afficher</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
