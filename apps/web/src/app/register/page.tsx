import type { Metadata } from 'next';
import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

export const metadata: Metadata = {
  title: 'Rejoindre NouvellesDuPays',
  description: 'Inscrivez-vous gratuitement pour suivre l’actualité de votre pays et les voix indépendantes, sur un seul globe.',
  alternates: { canonical: '/register' },
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 sm:px-6 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">← Retour au globe</Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-4">
          Rejoindre <span className="text-orange-500">NouvellesDuPays</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-2 leading-relaxed">
          Les actualités de 190 pays, des médias locaux et des voix indépendantes, réunis sur un globe interactif.
          L’inscription est gratuite et ne demande qu’un email.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-neutral-300">
          <li>✓ Sélection d’actualités de votre pays</li>
          <li>✓ Nouvelles vidéos de chaînes indépendantes</li>
          <li>✓ Aucun spam — désinscription en un clic</li>
        </ul>
        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <LeadForm formId="register-page" />
        </div>
      </div>
    </main>
  );
}
