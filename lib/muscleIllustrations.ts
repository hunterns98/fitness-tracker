/**
 * Sprint 5.1 — Illustration theo muscle_group, đóng gói cùng source code
 * (public/muscle-illustrations/), không qua database, không qua storage.
 *
 * Dùng chung cho Hero Image (Exercise Strip) và Muscle Highlight
 * (Exercise Detail Bottom Sheet — Sprint 5.2), nhưng qua 2 BIẾN RỜI ở
 * nơi gọi (heroImageSrc / highlightImageSrc), không gói vào 1 type
 * ExercisePackage — quyết định Architecture Review đã chốt: không tạo
 * abstraction cho nhu cầu Sprint 7 chưa xảy ra.
 *
 * Danh sách 9 nhóm cơ khớp CHÍNH XÁC với GROUPS trong
 * components/ExercisePicker.tsx — nếu taxonomy đổi ở đó, cập nhật
 * đồng thời ở đây.
 */

const MUSCLE_ILLUSTRATION_MAP: Record<string, string> = {
  'Ngực': '/muscle-illustrations/nguc.svg',
  'Lưng': '/muscle-illustrations/lung.svg',
  'Vai': '/muscle-illustrations/vai.svg',
  'Vai sau': '/muscle-illustrations/vai-sau.svg',
  'Tay trước': '/muscle-illustrations/tay-truoc.svg',
  'Tay sau': '/muscle-illustrations/tay-sau.svg',
  'Cẳng tay': '/muscle-illustrations/can-tay.svg',
  'Chân': '/muscle-illustrations/chan.svg',
  'Core': '/muscle-illustrations/core.svg',
}

// Fallback khi muscle_group không khớp bất kỳ key nào (dữ liệu cũ/lạ) —
// không để layout vỡ hay thiếu ảnh, luôn có 1 giá trị hợp lệ trả về.
const DEFAULT_ILLUSTRATION = '/muscle-illustrations/core.svg'

export function getMuscleIllustration(muscleGroup: string | null | undefined): string {
  if (!muscleGroup) return DEFAULT_ILLUSTRATION
  return MUSCLE_ILLUSTRATION_MAP[muscleGroup] ?? DEFAULT_ILLUSTRATION
}
