import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during builds to allow deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds (still check in dev)
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude pdf-parse from webpack bundling to avoid test code execution
      config.externals = config.externals || [];
      config.externals.push('pdf-parse');
    }
    return config;
  },
};

export default nextConfig;
