/**
 * Next.js Instrumentation Hook
 * This file runs once per serverless function cold start on Vercel,
 * BEFORE any route handlers. We use it to polyfill browser APIs that
 * pdfjs-dist requires (DOMMatrix, DOMPoint, DOMRect) since they
 * don't exist in Node.js serverless environments.
 *
 * This is the FIRST line of defense - the polyfill is also applied in:
 * - src/lib/dom-polyfill.ts (module-level, on import)
 * - src/lib/pdf-processor.ts (function-level, before each extraction)
 */

export async function register() {
  // Import the polyfill module which applies polyfills on import
  await import('@/lib/dom-polyfill');
}
