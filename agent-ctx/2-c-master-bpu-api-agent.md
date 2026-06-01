# Task 2-c: Master BPU CRUD API Route

## Agent: master-bpu-api-agent

## Task
Create Master BPU CRUD API route with sync from BKU

## Work Completed

### File Created
- `/home/z/my-project/src/app/api/master/bpu/route.ts`

### Endpoints Implemented

1. **GET** - Lists all BPUs with items, toko relation, and auto-computed nomor surat fields
   - `nomorSuratPesanan`: `421.3/{noPesanan(3-digit)}/P/DB/SMANSATLD/{romanMonth}/{year}`
   - `nomorSuratBAST`: `421.3/{noPesanan(3-digit)}/BAST/SMANSA-TD/{romanMonth}/{year}`
   - `nomorSuratSHP`: `421.3/{noPesanan(3-digit)}/PB/SMANSA-TD/{romanMonth}/{year}`
   - Returns empty strings if noPesanan or tglPesan is empty

2. **POST** - Creates a new BPU with optional items
   - Validates noBukti is provided and unique (409 on duplicate)
   - Creates items inline

3. **PUT** - Updates a BPU
   - When items are provided, deletes all existing items and creates new ones
   - Preserves user-edited fields (noPesanan, tokoId, etc.)

4. **DELETE** - Deletes a BPU and cascade-deletes items

5. **PATCH** (sync) - Syncs BPU data from BKU cache files
   - Reads `.pdf-cache/*.bku.json` files
   - Extracts transactions where pengeluaran > 0 and noBukti starts with "BPU"
   - Groups by noBukti and creates/updates BPU records
   - Preserves user-edited fields (hargaToko2, volume, satuan, tarifHarga) on update by matching uraian
   - Handles missing cache directory, missing files, parse errors gracefully
   - Returns summary with created/updated/error counts

### Test Results
- GET: Returns 32 BPUs with items and toko relations
- POST: Creates BPU with items, duplicate detection works (409)
- PUT: Updates BPU, nomor surat generates correctly (e.g., `421.3/001-P/DB/SMANSATLD/III/2026`)
- DELETE: Deletes BPU and cascade-deletes items
- PATCH (sync): Successfully synced 32 BPU records from BKU cache files

## Stage Summary
- Master BPU API ready with full CRUD, auto nomor surat generation, and BKU sync
