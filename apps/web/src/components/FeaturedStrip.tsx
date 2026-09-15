import type { Article } from '@/lib/types';

// "À la une": a curated horizontal strip of a country's leading outlets,
// one card per publisher showing its latest headline, above the normal
// flat article list. Membership/order comes from publishers.is_top_outlet
// + top_outlet_rank (see db/migrations/007_top_outlets.sql) -- an editorial
// curation decision, not something this component infers.
export default function FeaturedStrip({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;

  return (
    <div className="mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-400/90 mb-2">
        À la une
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory">
        {articles.map((a) => (
          <a
            key={a.publisher_id}
            href={a.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group shrink-0 w-44 snap-start rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 hover:border-orange-500/50 hover:bg-neutral-900 transition-colors"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5 truncate">
              {a.publisher_name}
            </p>
            <p className="text-[13px] leading-snug font-medium text-neutral-100 group-hover:text-orange-400 transition-colors line-clamp-4">
              {a.headline}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
