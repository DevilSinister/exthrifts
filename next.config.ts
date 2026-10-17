import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A build and a dev server must never share one output dir on Windows
  // (see the vault's Windows Environment Traps). Unset, this is the default.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  // Stock and drop visibility depend on the clock and the database at request
  // time, so the store renders dynamically instead of using Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  images: {
    // Uploads are pre-resized to fixed WebP widths; the loader picks one, so
    // the Node process never resizes images per request.
    loader: "custom",
    loaderFile: "./src/lib/images/loader.ts",
    deviceSizes: [400, 800, 1600],
    imageSizes: [400],
  },
  serverExternalPackages: ["sharp", "mariadb"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
