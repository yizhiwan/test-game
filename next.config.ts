import type { NextConfig } from "next";

/**
 * Two build targets from one codebase.
 *
 * The default build is a normal Next.js server app: API routes work, the game
 * talks to /api/npc/* on its own origin, deploy it to Vercel and you are done.
 *
 * BUILD_TARGET=capacitor produces a static bundle in ./out for the Android
 * shell. A static export cannot run server code, so scripts/build-capacitor.mjs
 * moves app/api aside for the duration of that build. In this mode the client
 * must be pointed at a hosted API with NEXT_PUBLIC_API_BASE_URL, or dialogue
 * falls back to canned lines.
 */
const isCapacitor = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isCapacitor
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
