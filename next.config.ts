import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  // Lets several dev servers run side by side (NEXT_DIST_DIR=.next-a pnpm dev -p 3101).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    // Allow 15 MB sheet music PDFs and 5 MB pictures (plus multipart/form-data overhead).
    serverActions: {
      bodySizeLimit: "16mb",
      // Extra hosts allowed to submit forms when a reverse proxy rewrites the
      // Host header. Read at build time (the Docker build passes it in).
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean),
    },
  },
  // The guest site of a wedding served at the root of the domain (see
  // src/lib/site-paths.ts). Paths no app route claims go to /w/_/…, whose
  // pages show the root wedding — or 404 / the login page when there isn't one.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/w/_" }],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: "/w/_/:path*" }],
    };
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
