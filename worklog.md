---
Task ID: 1-4
Agent: main
Task: Implement Master Toko, Data Sekolah, Master BPU, Master BNU features

Work Log:
- Updated Prisma schema with 6 new models: Toko, DataSekolah, BPU, BPItem, BNU, BNUItem
- Ran db:push successfully
- Created API routes for Master Toko (GET/POST/PUT/DELETE) at /api/master/toko
- Created API routes for Data Sekolah (GET/POST) at /api/master/sekolah
- Created API routes for Master BPU (GET/POST/PUT/DELETE/PATCH sync) at /api/master/bpu
- Created API routes for Master BNU (GET/POST/PUT/DELETE + sync) at /api/master/bnu
- Auto nomor surat generation verified: 421.3/001-P/DB/SMANSATLD/III/2026
- Updated page.tsx frontend with 4 new sub-tabs under SPJ
- Fixed runtime error where new sub-tab keys were being cast as SPJDocType
- Tested all APIs: BPU sync (32 records), BNU sync (20 records), Toko CRUD, Sekolah save
- Lint passes clean

Stage Summary:
- Master Toko: Full CRUD with search, add/edit dialog, delete with usage check
- Data Sekolah: Edit form for school info, auto-save from BKU Pajak
- Master BPU: Sync from BKU, assign No Pesanan + Tgl Pesan + Toko, auto-generate 3 nomor surat types, editable Harga Toko 2 per item
- Master BNU: Same features as BPU for honor/gaji transactions
- Nomor surat format confirmed: 421.3/{NoPesanan}-{Kode}/{BulanRomawi}/{Tahun}
