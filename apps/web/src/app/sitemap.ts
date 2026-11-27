import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/serverApi";
import { AFRICA_REGIONS, countrySlug } from "@/lib/africa";
import { countryPlace } from "@/lib/youtubePlaces";
import { languageAlternates } from "@/i18n/routing";

const SITE = "https://nouvellesdupays.com";

// Globe navigation is client-side; the sitemap lists the home page, the
// public static pages, the /africa region and country pages, every approved
// creator and every approved YouTube landing page. Rendered on request so it never depends on the API being
// reachable during `next build`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "always", priority: 1 },
    { url: `${SITE}/youtube`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/africa`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/africa/rankings`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/creators`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...AFRICA_REGIONS.map((r) => ({ url: `${SITE}/africa/${r.slug}`, lastModified: now, changeFrequency: "hourly" as const, priority: 0.8 })),
    { url: `${SITE}/register`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/register-publisher`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/submit-video`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const summary = await serverApi.africaSummary();
    for (const r of summary?.regions ?? []) {
      for (const c of r.countries) {
        pages.push({ url: `${SITE}/africa/${countrySlug(c.name)}`, lastModified: c.latest_at ? new Date(c.latest_at) : now, changeFrequency: "hourly", priority: c.publishers > 0 ? 0.8 : 0.4 });
      }
    }
  } catch {
    // API unreachable: region pages above are still listed.
  }
  try {
    for (const s of (await serverApi.sources()) ?? []) {
      pages.push({ url: `${SITE}/source/${s.slug}`, lastModified: s.latest_at ? new Date(s.latest_at) : now, changeFrequency: "daily", priority: 0.6 });
    }
  } catch {
    // API unreachable: the other entries are still listed.
  }
  try {
    for (const c of (await serverApi.creators("?limit=500")) ?? []) {
      pages.push({ url: `${SITE}/creators/${c.slug}`, lastModified: new Date(c.updated_at), changeFrequency: "weekly", priority: 0.6 });
    }
    // Country YouTube pages (Build #255, at /youtube/<country> since #261) exist only from 5 approved creators.
    for (const c of (await serverApi.creatorCountries()) ?? []) {
      if (c.has_page) pages.push({ url: `${SITE}/youtube/${countrySlug(c.name)}`, lastModified: now, changeFrequency: "daily", priority: 0.7 });
    }
  } catch {
    // API unreachable: the other entries are still listed.
  }
  // CR-2026-11-17-03: /youtube region, country and category pages that have at least one channel (no empty pages).
  try {
    const first = await serverApi.youtubeDirectory("?per=60&sort=alpha");
    if (first) {
      const entries = [...first.items];
      for (let p = 2; p <= Math.ceil(first.total / 60); p += 1) entries.push(...((await serverApi.youtubeDirectory(`?per=60&sort=alpha&page=${p}`))?.items ?? []));
      const mains = new Set((first.taxonomy ?? []).filter((t) => !t.parent_slug).map((t) => t.slug));
      const parentOf = Object.fromEntries((first.taxonomy ?? []).map((t) => [t.slug, t.parent_slug]));
      const urls = new Set<string>();
      const addCats = (placeSlug: string, cats: string[]) => {
        for (const c of cats) {
          if (mains.has(c)) urls.add(`/youtube/${placeSlug}/${c}`);
          else if (parentOf[c]) urls.add(`/youtube/${placeSlug}/${parentOf[c]}/${c}`);
        }
      };
      const countries = new Map(first.facets.countries.map((c) => [c.iso, c]));
      for (const e of entries) {
        const isos = e.country_list ? e.country_list.map((c) => c.iso) : e.country_iso ? [e.country_iso] : [];
        addCats("categorie", e.categories);
        for (const iso of isos) {
          const c = countries.get(iso);
          if (!c) continue;
          const place = countryPlace(c);
          urls.add(`/youtube/${place.slug}`);
          addCats(place.slug, e.categories);
          if (place.parent) {
            urls.add(`/youtube/${place.parent.slug}`);
            addCats(place.parent.slug, e.categories);
            if (place.parent.parent) {
              urls.add(`/youtube/${place.parent.parent.slug}`);
              addCats(place.parent.parent.slug, e.categories);
            }
          }
        }
      }
      const listed = new Set(pages.map((p) => p.url));
      for (const u of [...urls].sort()) {
        if (!listed.has(`${SITE}${u}`)) pages.push({ url: `${SITE}${u}`, lastModified: now, changeFrequency: "daily", priority: u.split("/").length > 3 ? 0.5 : 0.6 });
      }
    }
  } catch {
    // API unreachable: the other entries are still listed.
  }
  try {
    const videos = (await serverApi.videos("?limit=60")) ?? [];
    for (const v of videos) {
      pages.push({ url: `${SITE}/youtube/${v.slug}`, lastModified: v.published_at ? new Date(v.published_at) : now, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch {
    // API unreachable: still serve the static entries.
  }
  // CR-2026-11-27-01: /facebook and its place pages, once they have videos (no empty pages).
  try {
    const fb = await serverApi.facebookDirectory("?per=1");
    if (fb && fb.total > 0) {
      const latest = fb.updated_at ? new Date(fb.updated_at) : now;
      pages.push({ url: `${SITE}/facebook`, lastModified: latest, changeFrequency: "daily", priority: 0.7 });
      const urls = new Set<string>();
      for (const c of fb.facets.countries) {
        const place = countryPlace(c);
        for (let p: typeof place | undefined = place; p; p = p.parent) urls.add(`/facebook/${p.slug}`);
      }
      for (const u of [...urls].sort()) pages.push({ url: `${SITE}${u}`, lastModified: latest, changeFrequency: "daily", priority: 0.5 });
    }
  } catch {
    // API unreachable: the other entries are still listed.
  }
  // CR-2026-11-26-01: every /youtube page exists in 9 languages, one address each; the entry (French address) lists
  // them all as alternates (xhtml:link hreflang) instead of 9 separate entries.
  for (const p of pages) {
    const path = p.url.slice(SITE.length);
    if (/^\/(youtube|facebook)(\/|$)/.test(path)) {
      p.alternates = { languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([l, u]) => [l, `${SITE}${u}`])) };
    }
  }
  return pages;
}
