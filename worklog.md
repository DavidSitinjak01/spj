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

---
Task ID: 2
Agent: main
Task: Build comprehensive KOP Sekolah editor with logo dimensions, text rows, font customization, and reordering

Work Log:
- Added `KopRow` Prisma model with fields: id, dataSekolahId, urutan, teks, fontFamily, fontSize, bold, italic, uppercase
- Added logo dimension fields to DataSekolah: logoKiriLebar, logoKiriTinggi, logoKananLebar, logoKananTinggi (Float, default 2.5cm/3.0cm)
- Created `/api/master/sekolah/kop-row` API route with GET (list), POST (create), PUT (update), DELETE (remove), PATCH (reorder)
- Optimized kop-row API to use `select: { id: true }` when querying DataSekolah to avoid loading large base64 logo data
- Updated sekolah POST API to handle logo dimension fields
- Updated sekolah default data to include logo dimension defaults
- Built KOP Sekolah editor UI in Data Sekolah tab with:
  - Logo upload section with dimension inputs (width/height in cm)
  - KOP text rows section with add/delete/reorder (up/down arrows)
  - Each row has: text input, font family dropdown (13 fonts), font size (pt), bold/italic/uppercase toggles
  - Live preview of KOP at the bottom of the card
- Added debounced save for KOP row updates (600ms debounce with accumulated updates)
- Updated kopSurat rendering in document print area to use dynamic KOP rows and logo dimensions (mm units)
- Fallback: when no KOP rows exist, document print still uses the old namaSekolah/npsn/alamat format
- Added new imports: ArrowUp, ArrowDown, Bold, Italic, Type, GripVertical, AlignCenter
- Added KopRowData interface and kopRows/kopRowLoading/kopRowSaving states

Stage Summary:
- KOP Sekolah editor fully functional with logo sizing, text row CRUD, font customization, and reordering
- Logo dimensions stored in cm, rendered in mm for print accuracy
- Debounced API updates prevent excessive server requests
- API endpoints: GET/POST/PUT/DELETE/PATCH /api/master/sekolah/kop-row
- Document KOP rendering uses dynamic rows when available, falls back to static fields

---
Task ID: 3
Agent: main
Task: Add line height (jarak antar baris) control to KOP rows with increment/decrement buttons

Work Log:
- Added `lineHeight` Float field to KopRow Prisma model (default 1.3, range 0.5-3.0)
- Pushed schema change to SQLite database
- Updated kop-row API POST handler to include lineHeight in creation
- Updated kop-row API PUT handler to accept lineHeight updates
- Added lineHeight to KopRowData interface
- Added lineHeight to addKopRow default values (1.3)
- Added "Jarak:" control in KOP row editor with ↓/↑ increment/decrement buttons (step 0.1)
- NOT a slider — uses button controls as user requested
- Range: 0.5 (very tight) to 3.0 (very loose), default 1.3
- Updated KOP preview rendering to use row.lineHeight
- Updated kopSurat document print rendering to use row.lineHeight

Stage Summary:
- Line height control added per-row with ↓/↑ buttons (not slider)
- Each KOP row can have its own line height (0.5 - 3.0, step 0.1)
- Default lineHeight = 1.3 for new rows
- Both preview and document print rendering respect lineHeight
