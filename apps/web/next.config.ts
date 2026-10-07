import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Django URLs end with a slash; keep it when proxying instead of 308-redirecting it away.
  skipTrailingSlashRedirect: true,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The repo root also has a package-lock.json; pin the root so Next does not guess.
    root: fileURLToPath(new URL("../..", import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // Routes renamed in the port; keep the old URLs working.
    return [
      { source: "/auth", destination: "/login", permanent: false },
      { source: "/facescan", destination: "/scanner", permanent: false },
    ];
  },
  async rewrites() {
    // The slash variants come first so a trailing slash survives the proxy hop.
    return [
      { source: "/api/:path*/", destination: `${BACKEND}/api/:path*/` },
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND}/media/:path*` },
    ];
  },
};

export default nextConfig;
