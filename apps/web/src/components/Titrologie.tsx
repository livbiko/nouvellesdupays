import type { TitrologieCluster } from '@/lib/types';

// Local label/color map, same "not centralized until a third caller needs
// it" pattern as EditorialLensBadge's and /admin/editorial's own copies --
// this one needs a header color per tag, which the other two don't.
const TAG_META: Record<string, { label: string; className: string }> = {
  public_state: { label: 'Média public', className: 'text-amber-300 bg-amber-950' },
  government_aligned: { label: 'Proche du gouvernement', className: 'text-orange-300 bg-orange-950' },
  party_aligned: { label: 'Proche d’un parti', className: 'text-pink-300 bg-pink-950' },
  opposition_aligned: { label: 'Proche de l’opposition', className: 'text-red-300 bg-red-950' },
  independent: { label: 'Indépendant', className: 'text-teal-300 bg-teal-950' },
  commercial_generalist: { label: 'Commercial / généraliste', className: 'text-neutral-300 bg-neutral-800' },
  editorially_mixed: { label: 'Éditorialement mixte', className: 'text-purple-300 bg-purple-950' },
  specialist: { label: 'Spécialisé', className: 'text-blue-300 bg-blue-950' },
};

export default function Titrologie({ clusters, loading }: { clusters: TitrologieCluster[] | null; loading: boolean }) {
  if (loading) return <p className="text-neutral-500 text-sm">Chargement…</p>;

  if (!clusters || clusters.length === 0) {
    return (
      <p className="text-neutral-500 text-sm">
        Aucune actualité couverte par plusieurs perspectives éditoriales différentes ces dernières 48h.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {clusters.map((cluster, i) => {
        const tags = [...new Set(cluster.articles.map((a) => a.tag).filter(Boolean))] as string[];
        return (
          <div key={i}>
            <p className="text-xs text-neutral-500 mb-2 italic">Même actualité, plusieurs perspectives</p>
            <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(tags.length, 2)}, minmax(0, 1fr))` }}>
              {tags.map((tag) => {
                const meta = TAG_META[tag] || { label: tag, className: 'text-neutral-300 bg-neutral-800' };
                const tagArticles = cluster.articles.filter((a) => a.tag === tag);
                return (
                  <div key={tag} className="rounded border border-neutral-800 overflow-hidden">
                    <div className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 ${meta.className}`}>
                      {meta.label}
                    </div>
                    <div className="p-2 space-y-2">
                      {tagArticles.map((a, j) => (
                        <a
                          key={j}
                          href={a.original_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block hover:text-orange-400"
                        >
                          <p className="text-xs font-medium leading-snug">{a.headline}</p>
                          <p className="text-[10px] text-neutral-500 mt-0.5">{a.publisher_name}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
