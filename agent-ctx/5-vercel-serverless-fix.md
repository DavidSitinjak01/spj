# Task: Fix Vercel Deploy Errors for PDF APIs

## Summary

Fixed Vercel serverless deployment crashes by adding graceful error handling for PDF-related API routes that use the local file system (fs), Python scripts (execSync), and local upload directories — all of which are unavailable on Vercel's read-only serverless environment.

## Changes Made

### 1. Created `/src/lib/serverless.ts` (NEW FILE)
- `isServerless()`: Detects Vercel environment via `process.env.VERCEL`, `process.env.AWS_LAMBDA_FUNCTION_NAME`, `process.env.NETLIFY`, or by checking if the upload directory is writable
- `serverlessErrorResponse()`: Returns a 501 (Not Implemented) JSON response with `{ error, serverless: true }` and a helpful Indonesian message
- `withServerlessCheck()`: Higher-order function wrapper for API handlers
- `safeFs()`: Safe wrapper for fs operations that returns fallback on serverless

### 2. Modified `/src/lib/pdf-processor.ts`
- Wrapped top-level `fs.mkdirSync()` calls in `try/catch` with `isServerless()` guard
- Added `isServerless()` checks to all exported functions (`processPDF`, `renderPDFPages`, `getPDFFiles`, `getExtractedText`)
- On serverless: functions return empty arrays/results or throw descriptive errors instead of crashing

### 3. Modified PDF API Routes (10 files)
Each route now imports `isServerless` and `serverlessErrorResponse` from `@/lib/serverless` and checks at the top of every handler (GET, POST, DELETE):

- `/src/app/api/pdf/upload/route.ts` - POST handler
- `/src/app/api/pdf/info/route.ts` - GET handler
- `/src/app/api/pdf/rkas/route.ts` - GET, POST, DELETE handlers; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/budget/route.ts` - POST handler; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/bku/route.ts` - GET, POST, DELETE handlers; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/bku-pajak/route.ts` - GET, POST, DELETE handlers; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/chat/route.ts` - POST handler
- `/src/app/api/pdf/spj/route.ts` - GET handler; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/spj-docs/route.ts` - GET, POST, DELETE handlers; also wrapped top-level `fs.mkdirSync` in try/catch
- `/src/app/api/pdf/summarize/route.ts` - POST handler

### 4. Modified Master API Routes (3 files)
- `/src/app/api/master/sekolah/route.ts` - Added early return in `readSchoolFromBKUCache()` on serverless (reads from `.pdf-cache`)
- `/src/app/api/master/bpu/route.ts` - Added serverless check to PATCH (sync) handler
- `/src/app/api/master/bnu/route.ts` - Added serverless check to `handleSync()` function

### 5. Modified Frontend `/src/app/page.tsx`
- Added `serverlessMode` state variable
- Added `checkServerlessResponse()` helper that detects 501 status and sets `serverlessMode`
- Updated API call functions to check for serverless responses:
  - `loadAvailablePDF`, `handleUpload`
  - `loadBKU`, `handleBKUUpload`
  - `loadRKAS`, `handleRKASUpload`
  - `loadBKUPajak`, `handleBKUPajakUpload`
  - `loadSPJ`
  - `syncBPU`, `syncBNU`
- Added serverless mode warning banner after the header:
  - Amber-colored banner with AlertCircle icon
  - Message: "Mode Serverless: Fitur PDF (upload, parsing, RKAS, BKU, SPJ) tidak tersedia di deployment ini. Gunakan versi lokal untuk fitur lengkap."

## Strategy
- On Vercel: returns graceful 501 error responses instead of crashing with 500
- On local dev: all existing functionality works as-is (isServerless() returns false)
- Frontend detects serverless mode via 501 status and shows user-friendly banner
- All top-level `fs.mkdirSync()` calls wrapped in try/catch to prevent build-time crashes

## Verification
- `bun run lint` passes with 0 errors
- Dev server compiles and runs successfully
