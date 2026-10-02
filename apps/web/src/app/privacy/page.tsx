import type { Metadata } from 'next';
import Link from 'next/link';
import ConsentSettingsButton from '@/components/ConsentSettingsButton';

export const metadata: Metadata = {
  title: 'Confidentialité et cookies — NouvellesDuPays',
  description: 'Quelles données NouvellesDuPays collecte, pourquoi, et comment gérer votre consentement.',
  alternates: { canonical: '/privacy' },
};

// NOTE FOR THE OPERATOR: this page describes what the code actually does.
// It is not legal advice -- have it reviewed (controller identity, contact
// address, retention periods, lawful bases) before running paid campaigns.
export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <article className="max-w-2xl mx-auto text-sm leading-relaxed text-neutral-300 space-y-5">
        <Link href="/" className="text-neutral-400 hover:text-neutral-200">← Retour</Link>
        <h1 className="text-2xl font-bold text-neutral-100">Confidentialité et cookies</h1>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100">Votre choix</h2>
          <p>
            Aucune mesure d’audience ni aucun pixel publicitaire n’est activé avant votre choix dans le bandeau de
            consentement. Vous pouvez modifier ce choix à tout moment :
          </p>
          <ConsentSettingsButton />
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100">Mesure d’audience (si vous l’acceptez)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Un identifiant aléatoire de visiteur et de session, stocké dans votre navigateur (localStorage).</li>
            <li>Les pages vues, les clics sur des articles ou vidéos, le démarrage et la fin d’une inscription.</li>
            <li>La provenance de la visite : paramètres de campagne (utm_*), identifiant de clic Facebook (fbclid), page d’arrivée et site référent (sans paramètres).</li>
            <li>Le type d’appareil (mobile, tablette, ordinateur). Votre adresse IP et votre navigateur exact ne sont <strong>pas</strong> enregistrés.</li>
          </ul>
          <p>Ces données sont hébergées par NouvellesDuPays et servent uniquement à mesurer et améliorer le site.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100">Publicité Meta (si vous l’acceptez)</h2>
          <p>
            Le Meta Pixel (Facebook/Instagram) et l’API Conversions de Meta nous permettent de savoir si nos publicités
            amènent des visites et des inscriptions. Dans ce cas, Meta reçoit l’événement (par ex. « inscription »), votre
            adresse IP et votre navigateur au moment de l’événement, l’identifiant de clic publicitaire et, pour une
            inscription, votre email <em>haché</em> (jamais en clair). Meta traite ces données selon sa propre politique.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100">Formulaires</h2>
          <p>
            Lorsque vous vous inscrivez, soumettez un média ou une vidéo, ou nous contactez, nous conservons les
            informations saisies (dont votre email) pour traiter votre demande. Votre email n’est jamais affiché
            publiquement ni revendu. Pour toute demande d’accès, de rectification ou de suppression, utilisez la{' '}
            <Link href="/contact" className="underline">page contact</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-100">Autres services</h2>
          <p>
            Les vidéos YouTube ne sont chargées qu’au clic, via youtube-nocookie.com. Pour vous proposer votre pays au
            premier chargement du globe, le site interroge un service de géolocalisation par IP (ipapi.co).
          </p>
        </section>
      </article>
    </main>
  );
}
