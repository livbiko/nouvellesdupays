'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, postJson } from '@/lib/api';
import { getFormTrackingContext, reportServerConversion } from '@/lib/tracking';
import { Field, Honeypot, SubmitStatus, friendlyError, inputClass, useFormTracking, useSubmitState } from '@/components/FormKit';
import type { Country } from '@/lib/types';

const CATEGORIES: [string, string][] = [
  ['politics', 'Politique'], ['business', 'Économie'], ['society', 'Société'], ['local', 'Local'],
  ['international', 'International'], ['sports', 'Sport'], ['culture', 'Culture'], ['entertainment', 'Divertissement'],
  ['health', 'Santé'], ['technology', 'Technologie'], ['education', 'Éducation'], ['environment', 'Environnement'],
];

const EMPTY = {
  name: '', homepage_url: '', country_iso: '', region: '', city: '', language: '', description: '',
  contact_name: '', contact_email: '', youtube_url: '', facebook_url: '', x_url: '', instagram_url: '',
  tiktok_url: '', feed_url: '', api_url: '', logo_url: '', sitemap_url: '', category_urls: '', article_url_patterns: '',
};

export default function RegisterPublisher() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState<string[]>([]);
  const [hasFeed, setHasFeed] = useState<'yes' | 'no'>('no');
  const [permission, setPermission] = useState(false);
  const [hp, setHp] = useState('');
  const [state, setState] = useSubmitState();
  const { formStartedAt, onFirstInteraction } = useFormTracking('PublisherRegistrationStarted');

  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!permission) {
      setState({ status: 'error', message: 'Merci de confirmer que vous êtes autorisé(e) à soumettre ce site.' });
      return;
    }
    setState({ status: 'submitting' });
    const tracking = getFormTrackingContext();
    const payload = {
      ...form,
      feed_url: hasFeed === 'yes' ? form.feed_url : '',
      api_url: hasFeed === 'yes' ? form.api_url : '',
      sitemap_url: hasFeed === 'no' ? form.sitemap_url : '',
      category_urls: hasFeed === 'no' ? form.category_urls : '',
      article_url_patterns: hasFeed === 'no' ? form.article_url_patterns : '',
      categories,
      permission_confirmed: permission,
      website_hp: hp,
      form_started_at: formStartedAt(),
      tracking,
    };
    const { ok, status, body } = await postJson<{ message?: string; verification?: string; conversion_event_id?: string }>(
      '/api/publishers/register',
      payload
    );
    if (ok) {
      reportServerConversion('PublisherRegistrationCompleted', body.conversion_event_id);
      setState({
        status: 'success',
        message: hasFeed === 'yes'
          ? `Flux vérifié et soumis pour validation. ${body.verification ?? ''}`
          : 'Merci ! Votre site a été soumis. Notre équipe va l’examiner et configurer la source avant sa mise en ligne.',
      });
      setForm(EMPTY);
      setCategories([]);
      setPermission(false);
    } else {
      setState({ status: 'error', message: friendlyError(status, body) });
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour</Link>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
          Inscrivez votre <span className="text-orange-500">site d’actualités</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
          Vous publiez de l’information locale, nationale ou régionale ? Faites apparaître votre média sur
          NouvellesDuPays — <strong className="text-neutral-200">même sans flux RSS, Atom ou API</strong>. Chaque
          site est examiné par notre équipe avant publication. Nous affichons uniquement le titre, un court extrait et
          un lien vers votre article : les lecteurs sont toujours renvoyés vers votre site.
        </p>

        <form onSubmit={handleSubmit} onFocusCapture={onFirstInteraction} className="mt-8 space-y-8" noValidate={false}>
          <Honeypot value={hp} onChange={setHp} />

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold mb-2">Votre média</legend>
            <Field id="name" label="Nom du site" required>
              <input id="name" required maxLength={200} value={form.name} onChange={set('name')} className={inputClass} placeholder="Le Journal Exemple" />
            </Field>
            <Field id="homepage_url" label="Adresse du site (URL)" required>
              <input id="homepage_url" required type="url" inputMode="url" value={form.homepage_url} onChange={set('homepage_url')} className={inputClass} placeholder="https://www.exemple.com" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="country_iso" label="Pays" required>
                <select id="country_iso" required value={form.country_iso} onChange={set('country_iso')} className={inputClass}>
                  <option value="">Sélectionner un pays</option>
                  {countries.map((c) => <option key={c.iso_code} value={c.iso_code}>{c.name}</option>)}
                </select>
              </Field>
              <Field id="language" label="Langue principale" required>
                <input id="language" required maxLength={20} value={form.language} onChange={set('language')} className={inputClass} placeholder="fr" list="languages" />
                <datalist id="languages">
                  {['fr', 'en', 'pt', 'ar', 'sw', 'ha', 'yo', 'wo', 'es', 'de'].map((l) => <option key={l} value={l} />)}
                </datalist>
              </Field>
              <Field id="region" label="Région">
                <input id="region" maxLength={120} value={form.region} onChange={set('region')} className={inputClass} />
              </Field>
              <Field id="city" label="Ville">
                <input id="city" maxLength={120} value={form.city} onChange={set('city')} className={inputClass} />
              </Field>
            </div>
            <Field id="description" label="Description du site" help="2 à 3 phrases : ligne éditoriale, zone couverte, fréquence de publication.">
              <textarea id="description" rows={3} maxLength={2000} value={form.description} onChange={set('description')} className={inputClass} aria-describedby="description-help" />
            </Field>
            <div role="group" aria-labelledby="cat-label">
              <p id="cat-label" className="block text-sm text-neutral-300 mb-2">Rubriques couvertes</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(([value, label]) => (
                  <label key={value} className={`cursor-pointer text-xs px-3 py-1.5 rounded-full border ${categories.includes(value) ? 'bg-orange-500 border-orange-500 text-white' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}>
                    <input type="checkbox" className="sr-only" checked={categories.includes(value)} onChange={() => toggleCategory(value)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Field id="logo_url" label="Logo (URL de l’image)">
              <input id="logo_url" type="url" inputMode="url" value={form.logo_url} onChange={set('logo_url')} className={inputClass} placeholder="https://www.exemple.com/logo.png" />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold mb-1">Comment récupérer vos articles ?</legend>
            <div className="flex flex-col sm:flex-row gap-2" role="radiogroup" aria-label="Disposez-vous d’un flux ?">
              {([['no', 'Je n’ai pas de flux RSS/Atom/API'], ['yes', 'J’ai un flux RSS/Atom ou une API']] as const).map(([v, label]) => (
                <label key={v} className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm ${hasFeed === v ? 'border-orange-500 bg-orange-500/10 text-neutral-100' : 'border-neutral-700 text-neutral-400'}`}>
                  <input type="radio" name="has_feed" value={v} checked={hasFeed === v} onChange={() => setHasFeed(v)} className="mr-2 accent-orange-500" />
                  {label}
                </label>
              ))}
            </div>

            {hasFeed === 'yes' ? (
              <>
                <Field id="feed_url" label="URL du flux RSS/Atom" help="Nous vérifions automatiquement qu’il contient de vrais articles.">
                  <input id="feed_url" type="url" inputMode="url" value={form.feed_url} onChange={set('feed_url')} className={inputClass} placeholder="https://www.exemple.com/rss" aria-describedby="feed_url-help" />
                </Field>
                <Field id="api_url" label="URL de l’API (si vous en avez une)">
                  <input id="api_url" type="url" inputMode="url" value={form.api_url} onChange={set('api_url')} className={inputClass} />
                </Field>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Aucun problème. Indiquez-nous où trouver vos articles : notre équipe configure la source, et notre robot
                  respecte votre fichier <code>robots.txt</code>, ne lit que les métadonnées publiques (titre, résumé, image,
                  date) et limite le nombre de requêtes.
                </p>
                <Field id="sitemap_url" label="Sitemap (si disponible)" help="Souvent https://votresite.com/sitemap.xml">
                  <input id="sitemap_url" type="url" inputMode="url" value={form.sitemap_url} onChange={set('sitemap_url')} className={inputClass} aria-describedby="sitemap_url-help" />
                </Field>
                <Field id="category_urls" label="Pages de rubriques" help="Une URL par ligne, par ex. https://votresite.com/politique (10 maximum).">
                  <textarea id="category_urls" rows={3} value={form.category_urls} onChange={set('category_urls')} className={inputClass} aria-describedby="category_urls-help" />
                </Field>
                <Field id="article_url_patterns" label="Format des adresses d’articles" help="Si nécessaire, une règle par ligne avec * comme joker, par ex. /article/* ou /2026/*">
                  <textarea id="article_url_patterns" rows={2} value={form.article_url_patterns} onChange={set('article_url_patterns')} className={inputClass} aria-describedby="article_url_patterns-help" />
                </Field>
              </>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold mb-1">Réseaux sociaux</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="youtube_url" label="Chaîne YouTube"><input id="youtube_url" type="url" inputMode="url" value={form.youtube_url} onChange={set('youtube_url')} className={inputClass} placeholder="https://www.youtube.com/@…" /></Field>
              <Field id="facebook_url" label="Page Facebook"><input id="facebook_url" type="url" inputMode="url" value={form.facebook_url} onChange={set('facebook_url')} className={inputClass} placeholder="https://www.facebook.com/…" /></Field>
              <Field id="x_url" label="X / Twitter"><input id="x_url" type="url" inputMode="url" value={form.x_url} onChange={set('x_url')} className={inputClass} placeholder="https://x.com/…" /></Field>
              <Field id="instagram_url" label="Instagram"><input id="instagram_url" type="url" inputMode="url" value={form.instagram_url} onChange={set('instagram_url')} className={inputClass} placeholder="https://www.instagram.com/…" /></Field>
              <Field id="tiktok_url" label="TikTok"><input id="tiktok_url" type="url" inputMode="url" value={form.tiktok_url} onChange={set('tiktok_url')} className={inputClass} placeholder="https://www.tiktok.com/@…" /></Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold mb-1">Contact</legend>
            <p className="text-xs text-neutral-500">Utilisé uniquement par notre équipe pour la validation — jamais affiché publiquement.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="contact_name" label="Nom du contact"><input id="contact_name" maxLength={120} autoComplete="name" value={form.contact_name} onChange={set('contact_name')} className={inputClass} /></Field>
              <Field id="contact_email" label="Email du contact" required={hasFeed === 'no'}>
                <input id="contact_email" type="email" autoComplete="email" required={hasFeed === 'no'} value={form.contact_email} onChange={set('contact_email')} className={inputClass} />
              </Field>
            </div>
          </fieldset>

          <label className="flex items-start gap-3 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" required checked={permission} onChange={(e) => setPermission(e.target.checked)} className="mt-1 accent-orange-500 h-4 w-4" />
            <span>
              Je confirme être le propriétaire de ce site ou être autorisé(e) à le soumettre, et j’accepte que NouvellesDuPays
              affiche les titres, extraits et liens de ses articles. <Link href="/privacy" className="underline">Confidentialité</Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={state.status === 'submitting'}
            className="w-full rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 text-sm"
          >
            {state.status === 'submitting' ? (hasFeed === 'yes' ? 'Vérification du flux…' : 'Envoi…') : 'Soumettre mon site'}
          </button>
          <SubmitStatus state={state} />
        </form>
      </div>
    </main>
  );
}
