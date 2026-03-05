import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  // Removed output: "standalone" - not needed for Vercel deployments
  // Vercel has its own optimized deployment pipeline for Next.js
  distDir: '.next',
  eslint: {
    // Enforce ESLint during builds
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Enforce type checking during builds
    ignoreBuildErrors: false,
  },
  // Use git commit SHA for build ID - enables CDN cache reuse between deploys
  // while still invalidating cache when code actually changes
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_HASH || `build-${Date.now()}`;
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude pdf-parse from webpack bundling (native module)
      config.externals = config.externals || [];
      config.externals.push('pdf-parse');
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
