'use client';

import Link from 'next/link';
import { openConsentSettings } from '@/lib/tracking';

export default function SiteFooter() {
  return (
    <footer className="border-t border-neutral-900 mt-12 py-6 px-4 text-xs text-neutral-500">
      <div className="max-w-3xl mx-auto flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <Link href="/" className="hover:text-neutral-300">NouvellesDuPays</Link>
        <Link href="/register-publisher" className="hover:text-neutral-300">Inscrire un média</Link>
        <Link href="/submit-video" className="hover:text-neutral-300">Proposer une vidéo</Link>
        <Link href="/contact" className="hover:text-neutral-300">Contact</Link>
        <Link href="/privacy" className="hover:text-neutral-300">Confidentialité</Link>
        <button type="button" onClick={openConsentSettings} className="hover:text-neutral-300 underline-offset-2 hover:underline">
          Gérer les cookies
        </button>
      </div>
    </footer>
  );
}
