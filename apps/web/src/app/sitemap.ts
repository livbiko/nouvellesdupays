import type { MetadataRoute } from "next";

// Single-page app -- all country/globe navigation happens client-side, no
// per-country server routes exist to enumerate here. If that changes (e.g.
// dedicated /country/:iso pages), extend this to fetch and list them.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://nouvellesdupays.com",
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1,
    },
  ];
}
