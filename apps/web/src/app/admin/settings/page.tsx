'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { adminApi, UnauthorizedError, type Settings, type SettingsResponse } from '@/lib/adminApi';
import { useAdminGuard } from '@/lib/useAdminGuard';

type FieldSpec = { key: string; label: string; help?: string; type: 'bool' | 'text' | 'number' | 'select'; options?: [string, string][] };

const GROUPS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: 'Mesure d’audience & consentement',
    fields: [
      { key: 'tracking_enabled', label: 'Mesure d’audience activée', type: 'bool', help: 'Coupe toute collecte (navigateur et serveur).' },
      { key: 'consent_mode', label: 'Mode de consentement', type: 'select', options: [['opt_in', 'Opt-in — rien avant accord (UK/UE, recommandé)'], ['opt_out', 'Opt-out — audience par défaut, publicité toujours sur accord']] },
      { key: 'consent_policy_version', label: 'Version de la politique', type: 'text', help: 'Changez-la pour redemander le consentement à tous les visiteurs.' },
      { key: 'event_debug', label: 'Mode débogage', type: 'bool', help: 'Journalise les événements dans la console du navigateur et les logs API.' },
    ],
  },
  {
    title: 'Meta (Facebook / Instagram)',
    fields: [
      { key: 'meta_pixel_enabled', label: 'Meta Pixel activé', type: 'bool' },
      { key: 'meta_pixel_id', label: 'ID du Pixel', type: 'text', help: 'Chiffres uniquement. Public (visible dans le navigateur).' },
      { key: 'meta_capi_enabled', label: 'API Conversions (serveur) activée', type: 'bool', help: 'Nécessite META_ACCESS_TOKEN côté serveur.' },
      { key: 'meta_test_event_code', label: 'Code d’événement de test', type: 'text', help: 'Depuis Gestionnaire d’événements → Tester les événements. À vider après les tests.' },
    ],
  },
  {
    title: 'Soumissions',
    fields: [
      { key: 'publisher_submissions_open', label: 'Inscription des éditeurs ouverte', type: 'bool', help: 'Toute soumission reste soumise à approbation manuelle.' },
      { key: 'youtube_submissions_open', label: 'Soumission de vidéos/chaînes ouverte', type: 'bool', help: 'Toute vidéo reste soumise à approbation manuelle.' },
    ],
  },
  {
    title: 'Collecte (sites sans flux)',
    fields: [
      { key: 'crawler_default_frequency_minutes', label: 'Fréquence par défaut (minutes)', type: 'number', help: 'Appliquée aux nouvelles sources sitemap/html.' },
      { key: 'crawler_max_articles_per_run', label: 'Articles max. par passage', type: 'number', help: 'Valeur indicative ; le worker utilise CRAWL_MAX_ARTICLES_PER_RUN.' },
    ],
  },
  {
    title: 'Pages de destination YouTube',
    fields: [
      { key: 'landing_cta_text', label: 'Texte d’appel par défaut', type: 'text' },
      { key: 'landing_show_related_news', label: 'Afficher les actualités liées', type: 'bool' },
      { key: 'landing_show_related_videos', label: 'Afficher les vidéos liées', type: 'bool' },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const ready = useAdminGuard();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<Settings>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    adminApi.settings()
      .then((d) => { setData(d); setDraft(d.settings); })
      .catch((err) => {
        if (err instanceof UnauthorizedError) router.push('/admin/login');
        else setMessage({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
      });
  }, [ready, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const changed = Object.fromEntries(Object.entries(draft).filter(([k, v]) => data.settings[k] !== v));
    if (Object.keys(changed).length === 0) return;
    try {
      const d = await adminApi.saveSettings(changed);
      setData(d);
      setDraft(d.settings);
      setMessage({ ok: true, text: 'Paramètres enregistrés (pris en compte sous 1 minute).' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Erreur' });
    }
  }

  if (!ready) return null;
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <AdminNav />
        {data && (
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3 mb-6 text-xs text-neutral-400">
            <p className="font-semibold text-neutral-200 mb-1">Secrets serveur (lecture seule — variables d’environnement)</p>
            <p>META_ACCESS_TOKEN : {data.secrets.meta_access_token_configured ? '✓ configuré' : '✗ absent'} · YOUTUBE_API_KEY : {data.secrets.youtube_api_key_configured ? '✓ configuré' : '✗ absent (oEmbed utilisé)'} · Graph API {data.secrets.meta_graph_api_version}</p>
          </div>
        )}
        {!data && !message && <p className="text-neutral-500 text-sm">Chargement…</p>}
        {data && (
          <form onSubmit={save} className="space-y-6">
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="rounded-lg border border-neutral-800 p-4 space-y-3">
                <legend className="px-1 text-sm font-semibold">{g.title}</legend>
                {g.fields.map((f) => (
                  <div key={f.key}>
                    {f.type === 'bool' ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(draft[f.key])} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })} className="accent-orange-500" />
                        {f.label}
                      </label>
                    ) : (
                      <label className="block text-sm">
                        {f.label}
                        {f.type === 'select' ? (
                          <select value={String(draft[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} className="block w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm">
                            {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={String(draft[f.key] ?? '')}
                            onChange={(e) => setDraft({ ...draft, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                            className="block w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm"
                          />
                        )}
                      </label>
                    )}
                    {f.help && <p className="text-xs text-neutral-500 mt-0.5">{f.help}</p>}
                  </div>
                ))}
              </fieldset>
            ))}
            <button className="rounded bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2">Enregistrer</button>
          </form>
        )}
        {message && <p className={`text-sm mt-3 ${message.ok ? 'text-green-400' : 'text-red-400'}`} role="status">{message.text}</p>}
      </div>
    </main>
  );
}
