import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent pdf.js canvas module from being processed on the server
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

export default nextConfig;
