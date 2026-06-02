import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {},
  // pdf2json is the sole PDF extraction method on Vercel serverless.
  // Keep it external so it's not bundled by Next.js (avoids import issues).
  // pdfjs-dist is no longer used server-side (its Worker breaks on Vercel).
  serverExternalPackages: ['pdf2json', 'canvas'],
};

export default nextConfig;
