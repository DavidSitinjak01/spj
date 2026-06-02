import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
  // Enable instrumentation hook for DOMMatrix polyfill on Vercel serverless
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
