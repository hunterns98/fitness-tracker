'use client'
import { getMuscleIllustration } from '@/lib/muscleIllustrations'

/**
 * Sprint 5.2 — Exercise Detail Bottom Sheet
 *
 * Mở từ Exercise Strip trong lúc tập (app/workout/[sessionId]/page.tsx).
 * KHÔNG phải trang mới, KHÔNG navigate — overlay trên Workout Screen,
 * đóng bằng backdrop tap hoặc kéo xuống, giữ nguyên state phía sau
 * (đúng UX Design đã khóa: "không rời khỏi buổi tập").
 *
 * Thứ tự hiển thị (đã khóa, không tự ý đổi):
 *   1. Hero Image
 *   2. Muscle Highlight
 *   3. Technique
 *   4. Common Mistakes
 *   5. Previous Performance
 *
 * KHÔNG hiển thị: Difficulty, Equipment, Movement Pattern — không nằm
 * trong scope Sprint 5.2 (khác với trang /exercises/[id] đầy đủ).
 *
 * Kiến trúc ảnh (Architecture Review Sprint 5 — đã chốt "2 biến rời"):
 * heroImageSrc và highlightImageSrc được tính riêng biệt tại đây, KHÔNG
 * gói vào 1 type ExercisePackage dùng chung. Ở Sprint 5, cả 2 trỏ cùng
 * giá trị (illustration theo muscle_group); Sprint 7 có thể đổi RIÊNG
 * heroImageSrc sang ảnh thật của từng exercise mà không đụng gì ở đây.
 */

type PrevSet = { set_number: number; reps: number; weight_kg: number }

export type ExerciseDetailData = {
  name: string
  muscle_group: string | null
  technique_cue: string | null
  common_mistakes: string | null
}

export function ExerciseDetailSheet({
  exercise,
  prevSets,
  onClose,
}: {
  exercise: ExerciseDetailData
  prevSets: PrevSet[]
  onClose: () => void
}) {
  // 2 biến rời — không gộp thành 1 object/type chung (quyết định kiến trúc đã khóa)
  const heroImageSrc = getMuscleIllustration(exercise.muscle_group)
  const highlightImageSrc = getMuscleIllustration(exercise.muscle_group)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="slide-up rounded-t-3xl overflow-y-auto"
        style={{ background: 'var(--surface)', maxHeight: '85vh' }}
      >
        {/* Kéo xuống để đóng — handle */}
        <div className="pt-3 pb-1 flex justify-center sticky top-0 z-10" style={{ background: 'var(--surface)' }}>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="w-10 h-1.5 rounded-full"
            style={{ background: 'var(--border-strong)' }}
          />
        </div>

        <div className="px-5 pb-8 space-y-5">
          {/* 1. Hero Image */}
          <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--brand-light)', aspectRatio: '16/9' }}>
            <img src={heroImageSrc} alt={exercise.muscle_group ?? exercise.name} className="w-24 h-24" />
          </div>

          <div>
            <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{exercise.name}</p>
            {exercise.muscle_group && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{exercise.muscle_group}</p>
            )}
          </div>

          {/* 2. Muscle Highlight */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--surface-2)' }}>
            <img src={highlightImageSrc} alt="Muscle highlight" className="w-14 h-14 shrink-0" />
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>NHÓM CƠ TÁC ĐỘNG</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text)' }}>
                {exercise.muscle_group ?? 'Không xác định'}
              </p>
            </div>
          </div>

          {/* 3. Technique */}
          {exercise.technique_cue && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>KỸ THUẬT</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {exercise.technique_cue}
              </p>
            </div>
          )}

          {/* 4. Common Mistakes */}
          {exercise.common_mistakes && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>LỖI THƯỜNG GẶP</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {exercise.common_mistakes}
              </p>
            </div>
          )}

          {/* 5. Previous Performance — compact, không table (quyết định UX #6) */}
          {prevSets.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>BUỔI TRƯỚC</p>
              <div className="flex flex-wrap gap-2">
                {prevSets.map(ps => (
                  <span key={ps.set_number}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                    {ps.weight_kg}kg×{ps.reps}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
