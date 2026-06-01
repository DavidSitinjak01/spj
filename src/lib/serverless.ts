/**
 * Serverless environment detection and graceful error handling for Vercel deployment.
 *
 * On Vercel serverless functions:
 * - The file system is read-only (except /tmp)
 * - Python runtime is not available
 * - Local upload directories cannot be created or written to
 *
 * This module provides utilities to detect the serverless environment
 * and return helpful error responses instead of crashing with 500 errors.
 */

import fs from 'fs';
import path from 'path';

let _isServerlessCache: boolean | null = null;

/**
 * Detect if we're running on a serverless platform (Vercel, etc.)
 * where local file system operations and Python scripts are unavailable.
 *
 * Detection strategy:
 * 1. Check VERCEL environment variable (set by Vercel)
 * 2. Check if the upload directory exists and is writable (fallback)
 */
export function isServerless(): boolean {
  if (_isServerlessCache !== null) return _isServerlessCache;

  // Check Vercel environment variable
  if (process.env.VERCEL) {
    _isServerlessCache = true;
    return true;
  }

  // Check other known serverless platforms
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) {
    _isServerlessCache = true;
    return true;
  }

  // Fallback: check if upload directory exists and is writable
  try {
    const uploadDir = path.join(process.cwd(), 'upload');
    if (!fs.existsSync(uploadDir)) {
      // Upload dir doesn't exist and we might not be able to create it
      // Don't cache this result - it might change during runtime
      return false;
    }
    // Try to check writability
    fs.accessSync(uploadDir, fs.constants.W_OK);
    _isServerlessCache = false;
    return false;
  } catch {
    // Directory exists but isn't writable = serverless
    _isServerlessCache = true;
    return true;
  }
}

/**
 * Standard error response for serverless environment.
 * Returns a JSON response with a helpful message in Indonesian
 * and a `serverless: true` flag that the frontend can detect.
 */
export function serverlessErrorResponse(featureName?: string): Response {
  const feature = featureName || 'PDF';
  return new Response(
    JSON.stringify({
      error: `Fitur ${feature} memerlukan penyimpanan file yang tidak tersedia di deployment serverless. Gunakan versi lokal untuk fitur ${feature}.`,
      serverless: true,
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Wrap a Next.js API route handler with serverless detection.
 * If running on serverless, returns a graceful 501 error.
 * Otherwise, runs the original handler.
 */
export function withServerlessCheck(
  handler: (...args: any[]) => Promise<Response>,
  featureName?: string
) {
  return async (...args: any[]) => {
    if (isServerless()) {
      return serverlessErrorResponse(featureName);
    }
    return handler(...args);
  };
}

/**
 * Safe wrapper for fs operations that returns null on serverless
 * instead of throwing an error.
 */
export function safeFs<T>(operation: () => T, fallback: T): T {
  if (isServerless()) return fallback;
  try {
    return operation();
  } catch {
    return fallback;
  }
}
