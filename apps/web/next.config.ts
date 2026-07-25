import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  turbopack: {
    // apps/web is deliberately its own standalone project (own lockfile),
    // not part of the root npm workspace -- see the Dockerfile/README for why.
    // Without this, Next.js gets confused by the root repo's separate lockfile.
    root: __dirname,
  },
};

export default nextConfig;
