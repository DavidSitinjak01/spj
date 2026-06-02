import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
  // CRITICAL: Prevent Next.js from bundling pdfjs-dist.
  // When bundled, the "fake worker" in pdfjs-dist tries to dynamically import
  // pdf.worker.mjs using a path computed from import.meta.url, but the bundled
  // chunk doesn't exist at the expected path on Vercel serverless.
  // Keeping pdfjs-dist external ensures the worker module is in node_modules
  // where the fake worker can find it.
  serverExternalPackages: ['pdfjs-dist', 'pdf2json', 'canvas'],
};

export default nextConfig;
