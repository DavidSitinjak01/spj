/**
 * Serverless environment detection for Vercel deployment.
 *
 * On Vercel serverless functions:
 * - The file system is read-only (except /tmp)
 * - Python runtime is not available
 * - Local upload directories cannot be created or written to
 *
 * When serverless is detected, we use Vercel Blob for file storage
 * and pdf-parse for text extraction instead of Python scripts.
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
