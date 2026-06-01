---
Task ID: 1
Agent: Main
Task: Analyze and improve RKAS import with Bulanan/Tahunan distinction from PDF title

Work Log:
- Analyzed current RKAS API route.ts (621 lines) and Python parser
- Examined actual PDF text from both sample files
- Updated Python parser to extract judul (title) from first page
- Added tipe detection from judul keywords
- Added judul field to RKASMonth interface
- Improved table type detection for better column parsing
- Strengthened dedup keys with prefixes
- Updated frontend to display judul in both Bulanan and Tahunan cards

Stage Summary:
- RKAS API now properly detects Bulanan vs Tahunan from PDF title
- judul field added and displayed in UI
- Duplicate prevention strengthened
