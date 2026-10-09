import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/serverApi";
import { AFRICA_REGIONS, countrySlug } from "@/lib/africa";

const SITE = "https://nouvellesdupays.com";

// Globe navigation is client-side; the sitemap lists the home page, the
// public static pages, the /africa region and country pages, and every
// approved YouTube landing page. Rendered on request so it never depends on the API being
// reachable during `next build`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "always", priority: 1 },
    { url: `${SITE}/youtube`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/africa`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
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
    const videos = (await serverApi.videos("?limit=60")) ?? [];
    for (const v of videos) {
      pages.push({ url: `${SITE}/youtube/${v.slug}`, lastModified: v.published_at ? new Date(v.published_at) : now, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch {
    // API unreachable: still serve the static entries.
  }
  return pages;
}
