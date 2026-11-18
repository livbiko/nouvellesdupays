import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

// CR-2026-11-17-03: "page not found" for /youtube/... (unknown place, category, subcategory or video), in French.
export default function YoutubeNotFound() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-16 text-center">
      <p className="text-sm font-semibold text-orange-400">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-3 text-neutral-400">
        Cette page n’existe pas, ou aucune chaîne n’y est encore répertoriée.
      </p>
      <p className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/youtube" className="text-orange-400 hover:underline">Vidéos & Médias</Link>
        <Link href="/youtube/afrique" className="text-orange-400 hover:underline">Chaînes d’Afrique</Link>
        <Link href="/youtube#categories" className="text-orange-400 hover:underline">Toutes les catégories</Link>
      </p>
      <SiteFooter />
    </main>
  );
}
