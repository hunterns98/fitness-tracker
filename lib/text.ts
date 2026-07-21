/**
 * Shared text/string utilities.
 * Currently: Vietnamese diacritics stripping.
 * Used by: app/data/page.tsx (Excel header normalization).
 * Intended for reuse by: Search, Exercise Library (Sprint 3 Phase 1+),
 * or anywhere else that needs to normalize Vietnamese text for matching.
 */

/**
 * Strips Vietnamese diacritics from a string.
 * Uses Unicode NFD decomposition to separate base characters from
 * combining diacritical marks, then removes the marks. Handles đ/Đ
 * separately because that character does not decompose under NFD
 * (it is a distinct Unicode code point, not a base letter + mark).
 *
 * Examples:
 *   stripDiacritics("Cân nặng (kg)") -> "Can nang (kg)"
 *   stripDiacritics("Điểm ngủ (/100)") -> "Diem ngu (/100)"
 *   stripDiacritics("Ngày (YYYY-MM-DD)") -> "Ngay (YYYY-MM-DD)"
 */
export function stripDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}
