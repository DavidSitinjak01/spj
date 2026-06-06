/**
 * DEPRECATED: This file is kept for backward compatibility.
 * All parsing logic has been moved to @/lib/services/pdf-parser.ts
 * 
 * This file now re-exports from the service so existing imports still work.
 */

export {
  parseBKUFromText,
  parseBKUPajakFromText,
  parseRKASFromText,
} from './services/pdf-parser';

// Re-export types for backward compatibility
export type {
  BKUTransaction,
  BKUMonth as BKUMonthData,
  BKUPajakTransaction,
  BKUPajakMonth as BKUPajakMonthData,
  RKASItem,
  RKASMonth as RKASMonthData,
} from './types';
