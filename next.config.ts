import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  // Lets several dev servers run side by side (NEXT_DIST_DIR=.next-a pnpm dev -p 3101).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    // Allow 5 MB gift picture uploads (plus multipart/form-data overhead).
    serverActions: {
      bodySizeLimit: "6mb",
      // Extra hosts allowed to submit forms when a reverse proxy rewrites the
      // Host header. Read at build time (the Docker build passes it in).
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").filter(Boolean),
    },
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
