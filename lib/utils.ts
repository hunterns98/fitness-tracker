/** Chuyển giây thành MM:SS */
export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Chuyển giây thành "Xh Ym" hoặc "Ym Zs" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Ngày dạng "T2, 28/6" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`
}

/** Check điều kiện tăng tạ:
 *  - Set cuối đạt rep mục tiêu tối đa
 *  - RPE trung bình ≤ 8
 */
export function shouldIncreaseWeight(
  sets: { reps: number | null; rpe: number | null }[],
  targetRepsMax: number
): boolean {
  if (!sets.length) return false
  const lastSet = sets[sets.length - 1]
  if (!lastSet.reps || lastSet.reps < targetRepsMax) return false
  const rpus = sets.filter(s => s.rpe !== null).map(s => s.rpe as number)
  if (!rpus.length) return false
  const avgRpe = rpus.reduce((a, b) => a + b, 0) / rpus.length
  return avgRpe <= 8
}
