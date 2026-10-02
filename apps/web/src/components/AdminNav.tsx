'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/adminApi';

const LINKS: [string, string][] = [
  ['/admin', 'Soumissions'],
  ['/admin/publishers', 'Éditeurs'],
  ['/admin/youtube', 'YouTube'],
  ['/admin/analytics', 'Analytics'],
  ['/admin/analytics/live', 'Console événements'],
  ['/admin/campaigns', 'Campagnes'],
  ['/admin/leads', 'Inscriptions'],
  ['/admin/settings', 'Paramètres'],
  ['/admin/invitations', 'Invitations'],
  ['/admin/editorial', 'Contexte éditorial'],
];

// Shared admin header + navigation (previously copy-pasted per page).
export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          NouvellesDuPays <span className="text-orange-500">Admin</span>
        </h1>
        <nav aria-label="Administration" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map(([href, label]) =>
            pathname === href ? (
              <span key={href} aria-current="page" className="text-neutral-200 font-medium">{label}</span>
            ) : (
              <Link key={href} href={href} className="text-neutral-500 hover:text-neutral-300">{label}</Link>
            )
          )}
        </nav>
      </div>
      <button
        onClick={() => {
          clearToken();
          router.push('/admin/login');
        }}
        className="text-sm text-neutral-500 hover:text-neutral-300"
      >
        Déconnexion
      </button>
    </div>
  );
}
