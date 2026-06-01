---
Task ID: 1
Agent: main
Task: Add logo upload feature to Data Sekolah (2 logos, max 4 MB each)

Work Log:
- Added `logoKiriUrl` and `logoKananUrl` fields to DataSekolah Prisma model (storing base64 data URLs directly in DB)
- Created `/api/master/sekolah/logo` API route with POST (upload), DELETE (remove), GET (serve) handlers
- Upload validates: max 4 MB file size, PNG/JPG/WebP/SVG formats only
- Logos stored as base64 data URLs in the database (no file I/O to avoid Next.js dev server restart issues)
- Updated sekolah GET API to return logo data URLs directly from DB
- Added Logo Kop Sekolah card in Data Sekolah UI with 2 upload areas (kiri = Lambang Negara, kanan = Logo Sekolah)
- Each upload area shows preview with Ganti/Hapus buttons, or empty state with upload icon
- Added `logoUploading`, `logoKiriInputRef`, `logoKananInputRef` state/refs
- Added `handleLogoUpload` and `handleLogoDelete` functions
- Updated KOP surat letterhead to include both logos flanking the center text
- Verified: Upload works (200 response), data persists, GET returns logo data URLs

Stage Summary:
- Logo upload feature complete: 2 logo slots (kiri/kanan), max 4 MB each
- Logos stored as base64 data URLs in SQLite database
- KOP surat letterhead updated with logo display
- API endpoints: POST/DELETE/GET /api/master/sekolah/logo
