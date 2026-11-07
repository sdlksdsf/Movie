import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the sandbox preview host(s) to talk to the dev server without
  // Next.js rejecting the request as a cross-origin dev request.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost:3000", "127.0.0.1:3000"],
  images: {
    // Local, pre-optimised WebP artwork — no need for the runtime optimiser.
    unoptimized: true,
  },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
