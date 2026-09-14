import EditorialLensBadge from './EditorialLensBadge';
import type { Publisher } from '@/lib/types';

const FEED_LABELS: Record<string, string> = { rss: 'Flux RSS', atom: 'Flux Atom', 'sitemap-news': 'Sitemap' };

function SocialLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
    >
      {label}
    </a>
  );
}

// One card per publisher known for the country, feed or no feed -- this is
// deliberately the full roster (including feed_status='pending' outlets
// like Le Patriote), not just the ones currently producing articles, so a
// feed-less-but-known outlet stays visible while it's being onboarded.
export default function SourceCardGrid({ publishers }: { publishers: Publisher[] }) {
  if (publishers.length === 0) {
    return <p className="text-neutral-500 text-sm">Aucun média répertorié pour le moment.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {publishers.map((p) => {
        const hasBadge = p.editorial_tags && p.editorial_tags.length > 0 && p.editorial_confidence && p.editorial_confidence !== 'unknown';
        return (
          <div key={p.id} className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {p.source_type && p.source_type !== 'OTHER' ? p.source_type : 'Média'}
                  {' · '}
                  {p.feed_status === 'active' ? 'En ligne' : p.feed_status === 'pending' ? 'En attente de flux' : 'Indisponible'}
                </p>
              </div>
              {hasBadge && <EditorialLensBadge publisherId={p.id} />}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <a
                href={p.homepage_url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Site web
              </a>
              {p.feed_url && (
                <a
                  href={p.feed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] px-2 py-1 rounded bg-teal-950 text-teal-400 hover:bg-teal-900"
                >
                  {FEED_LABELS[p.feed_type || 'rss']}
                </a>
              )}
              <SocialLink href={p.youtube_url} label="YouTube" />
              <SocialLink href={p.facebook_url} label="Facebook" />
              <SocialLink href={p.instagram_url} label="Instagram" />
              <SocialLink href={p.tiktok_url} label="TikTok" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
