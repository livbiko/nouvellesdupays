import Link from 'next/link';
import ExplorerShell from './ExplorerShell';
import { countrySlug } from '@/lib/africa';
import { frCountry } from '@/lib/countryNames';
import { YOUTUBE_REGIONS } from '@/lib/youtubePlaces';
import type { ExplorerCountry, ExplorerGroup, YoutubeExplorer } from '@/lib/types';

// CR-2026-11-25-04: "Explorer par pays" - continent (Africa by its five regions) > country > category > subcategory,
// each with the number of channels and creators the directory lists there (GET /api/youtube/explorer). Native
// <details> so it opens with the keyboard and screen readers announce it; links go to the existing nested pages
// (/youtube/<place>[/<category>[/<subcategory>]]). A country without channels is listed, greyed, without a link.
export type ExplorerCurrent = { iso?: string; category?: string };

const continentSlug = (key: string) => YOUTUBE_REGIONS.find((r) => r.query.continent === key)?.slug ?? key;
const n = (count: number) => <span className="ml-auto pl-2 text-xs tabular-nums text-neutral-500">{count}</span>;

function Country({ c, names, current }: { c: ExplorerCountry; names: Record<string, string>; current: ExplorerCurrent }) {
  const label = frCountry(c.iso, c.name);
  const flag = c.flag_url
    ? <img src={c.flag_url} alt="" width={20} height={15} loading="lazy" className="h-[15px] w-5 flex-shrink-0 rounded-[2px] object-cover" />
    : <span aria-hidden="true" className="h-[15px] w-5 flex-shrink-0 rounded-[2px] bg-neutral-800" />;
  if (!c.count) {
    return (
      <li data-country={`${label} ${c.name}`} className="flex items-center gap-2 py-1 pl-1 text-sm text-neutral-600">
        {flag}<span className="truncate">{label}</span>{n(0)}
      </li>
    );
  }
  const slug = countrySlug(c.name);
  const here = current.iso === c.iso;
  return (
    <li data-country={`${label} ${c.name}`}>
      <details data-group open={here || undefined} data-default-open={here ? '1' : undefined}>
        <summary className={`flex cursor-pointer items-center gap-2 rounded py-1 pl-1 text-sm hover:text-orange-400 ${here ? 'font-semibold text-orange-300' : 'text-neutral-200'}`}>
          {flag}<span className="truncate">{label}</span>{n(c.count)}
        </summary>
        <ul className="mb-1 ml-3 border-l border-neutral-800 pl-3 text-sm">
          <li><Link href={`/youtube/${slug}`} className="flex py-0.5 text-neutral-300 hover:text-orange-400">Toutes les chaînes{n(c.count)}</Link></li>
          {c.categories.map((cat) => {
            const active = here && current.category === cat.slug;
            return cat.subcategories && cat.subcategories.length > 0 ? (
              <li key={cat.slug}>
                <details data-group open={active || undefined} data-default-open={active ? '1' : undefined}>
                  <summary className={`flex cursor-pointer py-0.5 hover:text-orange-400 ${active ? 'text-orange-300' : 'text-neutral-300'}`}>
                    {names[cat.slug] ?? cat.slug}{n(cat.count)}
                  </summary>
                  <ul className="ml-3 border-l border-neutral-800 pl-3 text-xs">
                    <li><Link href={`/youtube/${slug}/${cat.slug}`} className="flex py-0.5 text-neutral-400 hover:text-orange-400">Toute la catégorie{n(cat.count)}</Link></li>
                    {cat.subcategories.map((s) => (
                      <li key={s.slug}>
                        <Link href={`/youtube/${slug}/${cat.slug}/${s.slug}`} className="flex py-0.5 text-neutral-400 hover:text-orange-400">
                          {names[s.slug] ?? s.slug}{n(s.count)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ) : (
              <li key={cat.slug}>
                <Link href={`/youtube/${slug}/${cat.slug}`} aria-current={active ? 'page' : undefined}
                  className={`flex py-0.5 hover:text-orange-400 ${active ? 'text-orange-300' : 'text-neutral-300'}`}>
                  {names[cat.slug] ?? cat.slug}{n(cat.count)}
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}

function Group({ g, href, names, current, depth }: { g: ExplorerGroup; href: string; names: Record<string, string>; current: ExplorerCurrent; depth: number }) {
  const countries = g.countries ?? [];
  const sorted = [...countries].sort((a, b) => frCountry(a.iso, a.name).localeCompare(frCountry(b.iso, b.name), 'fr'));
  const holdsCurrent = Boolean(current.iso) && (countries.some((c) => c.iso === current.iso)
    || (g.regions ?? []).some((r) => (r.countries ?? []).some((c) => c.iso === current.iso)));
  // Africa is open by default (Africa first); everything else opens on demand or around the current country.
  const open = holdsCurrent || (depth === 0 && g.key === 'afrique' && !current.iso);
  return (
    <li data-group-item>
      <details data-group open={open || undefined} data-default-open={open ? '1' : undefined}>
        <summary className={`flex cursor-pointer items-center rounded py-1.5 ${depth === 0 ? 'font-semibold text-neutral-100' : 'text-sm font-medium text-neutral-200'} hover:text-orange-400`}>
          {g.label}{n(g.count)}
        </summary>
        <div className={depth === 0 ? 'ml-1' : 'ml-2'}>
          <Link href={href} className="block py-0.5 pl-1 text-xs text-orange-400 hover:underline">Page {g.label} →</Link>
          {g.regions ? (
            <ul>{g.regions.map((r) => <Group key={r.key} g={r} href={`/youtube/${r.key}`} names={names} current={current} depth={depth + 1} />)}</ul>
          ) : (
            <ul>{sorted.map((c) => <Country key={c.iso} c={c} names={names} current={current} />)}</ul>
          )}
        </div>
      </details>
    </li>
  );
}

export default function CountryExplorer({ explorer, current = {} }: { explorer: YoutubeExplorer; current?: ExplorerCurrent }) {
  const names = Object.fromEntries(explorer.categories.map((c) => [c.slug, c.name_fr]));
  return (
    <nav aria-label="Explorer par pays">
      <ExplorerShell>
        <ul className="space-y-0.5">
          {explorer.continents.map((g) => (
            <Group key={g.key} g={g} href={`/youtube/${continentSlug(g.key)}`} names={names} current={current} depth={0} />
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-neutral-500">Le nombre indique les chaînes et créateurs référencés. Un pays grisé n’en a pas encore.</p>
      </ExplorerShell>
    </nav>
  );
}
