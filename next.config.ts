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
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
