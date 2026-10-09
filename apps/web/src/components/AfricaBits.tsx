import Link from 'next/link';
import { countrySlug, timeAgo } from '@/lib/africa';
import type { AfricaCountry } from '@/lib/types';

// Server-rendered building blocks shared by /africa, /africa/<region> and
// /africa/<country>. Articles always link out to the original publisher
// (headline + source + time, never the article body).

export interface ListArticle {
  id: number;
  headline: string;
  original_url: string;
  published_at: string | null;
  publisher_name: string;
  country_name?: string;
  country_iso?: string;
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="text-sm text-neutral-400 flex flex-wrap gap-x-2">
      {items.map((it, i) => (
        <span key={it.label} className="flex gap-x-2">
          {i > 0 && <span aria-hidden="true">›</span>}
          {it.href ? <Link href={it.href} className="hover:text-neutral-200">{it.label}</Link> : <span className="text-neutral-200">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function ArticleList({ articles, showCountry = false, now = Date.now() }: { articles: ListArticle[]; showCountry?: boolean; now?: number }) {
  return (
    <ul className="divide-y divide-neutral-900 border-y border-neutral-900">
      {articles.map((a) => (
        <li key={a.id} className="py-2.5">
          <a href={a.original_url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-orange-400 leading-snug">
            {a.headline}
          </a>
          <p className="text-xs text-neutral-500 mt-0.5">
            {a.publisher_name}
            {showCountry && a.country_name && <> · {a.country_name}</>}
            {a.published_at && <> · <time dateTime={a.published_at}>{timeAgo(a.published_at, now)}</time></>}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function CountryCards({ countries }: { countries: AfricaCountry[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {countries.map((c) => (
        <li key={c.iso_code}>
          <Link
            href={`/africa/${countrySlug(c.name)}`}
            className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/60 hover:border-orange-500/60 px-3 py-2"
          >
            {c.flag_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.flag_url} alt="" width={32} height={21} className="rounded-sm shrink-0" loading="lazy" />
            )}
            <span className="min-w-0">
              <span className="block font-medium truncate">{c.name}</span>
              <span className="block text-xs text-neutral-500">
                {c.publishers} source{c.publishers === 1 ? '' : 's'}
                {c.articles_24h > 0 && <> · {c.articles_24h} articles / 24 h</>}
                {c.national_tv > 0 && <> · TV</>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Unavailable() {
  return <p className="mt-8 text-red-400 text-sm">Ces informations sont momentanément indisponibles. Merci de réessayer plus tard.</p>;
}
