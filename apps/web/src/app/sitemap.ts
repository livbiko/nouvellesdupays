import type { MetadataRoute } from "next";
import { serverApi } from "@/lib/serverApi";

const SITE = "https://nouvellesdupays.com";

// Globe navigation is client-side (no per-country routes), so the sitemap
// lists the home page, the public static pages, and every approved YouTube
// landing page. Rendered on request so it never depends on the API being
// reachable during `next build`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "always", priority: 1 },
    { url: `${SITE}/youtube`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/register`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/register-publisher`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/submit-video`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
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
