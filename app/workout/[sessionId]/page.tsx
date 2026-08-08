'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDuration } from '@/lib/utils'
import { ExercisePicker } from '@/components/ExercisePicker'
import { getMuscleIllustration } from '@/lib/muscleIllustrations'
import { ExerciseDetailSheet } from '@/components/ExerciseDetailSheet'

type Exercise = {
  id: string; name: string; muscle_group: string
  current_weight_kg: number | null; target_reps: string | null
  target_sets: number | null; technique_cue: string | null
  common_mistakes?: string | null // Sprint 5.2 (additive)
  session_exercise_id?: string
  has_logged_sets?: boolean
  _source?: 'session_exercises' | 'template_fallback'
}

type SetEntry = {
  id?: string; set_number: number; reps: number; weight_kg: number
  rpe: number | null; note: string; saved: boolean; editing: boolean
}

type PrevSet = { set_number: number; reps: number; weight_kg: number }

function Stepper({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div className="flex-1">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}>−</button>
        <span className="flex-1 text-center font-bold text-xl tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}>+</button>
      </div>
    </div>
  )
}

// ── Exercise Strip (Sprint 5.1) ─────────────────────────────────
// Thay thế header cũ (card lớn: tên + mục tiêu + technique_cue dạng
// đoạn văn). Nguyên tắc: Logging là nhân vật chính, Strip không được
// đẩy vùng nhập set xuống quá nhiều — chiều cao giới hạn ~64-72px,
// text 1 dòng, không wrap.
//
// Toàn bộ Strip là MỘT vùng bấm duy nhất (quyết định UX #3/#4) — trừ
// nút ✏️ Sửa bài tập, vốn là 1 hành động khác biệt đã tồn tại từ
// trước (Workout Editor), dùng stopPropagation để không kích hoạt
// tap-target chính khi bấm riêng nút này.
//
// onClick chính (Sprint 5.2): mở Exercise Detail Bottom Sheet.
function ExerciseStrip({
  exercise, index, total, usesFallback, onOpenEditor, onOpenDetail,
}: {
  exercise: Exercise; index: number; total: number; usesFallback: boolean
  onOpenEditor: () => void; onOpenDetail: () => void
}) {
  const illustrationSrc = getMuscleIllustration(exercise.muscle_group)

  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="card w-full p-3 flex items-center gap-3 text-left transition-all"
      style={{ minHeight: 64, maxHeight: 72 }}
    >
      <img
        src={illustrationSrc}
        alt={exercise.muscle_group}
        className="w-12 h-12 rounded-xl shrink-0"
        style={{ background: 'var(--brand-light)' }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
          {exercise.name}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
          {exercise.current_weight_kg ?? '?'}kg · {exercise.target_sets ?? 4} sets · {exercise.target_reps ?? '?'} reps
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>{index + 1}/{total}</span>
        {!usesFallback && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onOpenEditor() }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onOpenEditor() } }}
            title="Sửa bài tập"
            className="text-sm px-1"
            style={{ color: 'var(--brand)' }}
          >
            ✏️
          </span>
        )}
        <span style={{ color: 'var(--text-3)' }}>›</span>
      </div>
    </button>
  )
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exIdx, setExIdx] = useState(0)
  const [allSets, setAllSets] = useState<Record<string, SetEntry[]>>({})
  const [prevSets, setPrevSets] = useState<PrevSet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [finishHours, setFinishHours] = useState(1)
  const [finishMins, setFinishMins] = useState(0)

  // ── Exercise Detail Bottom Sheet state (Sprint 5.2) ─────────
  const [showDetailSheet, setShowDetailSheet] = useState(false)

  // ── Workout Editor state ──────────────────────────────────
  const [showEditor, setShowEditor] = useState(false)
  const [editorView, setEditorView] = useState<'list' | 'picker'>('list')
  const [editorBusy, setEditorBusy] = useState(false)
  const [editorError, setEditorError] = useState('')

  function parseMin(t: string | null) { const m = t?.match(/\d+/); return m ? parseInt(m[0]) : 10 }
  function parseMax(t: string | null) { const m = t?.match(/\d+/g); return m ? parseInt(m[m.length - 1]) : 12 }

  // Re-fetch session_exercises và đồng bộ lại state.
  // - Giữ tiến trình set của bài còn tồn tại (key theo exercise_id, không đổi khi reorder)
  // - Khởi tạo set cho bài vừa thêm
  // - Theo dõi bài đang xem theo IDENTITY (exercise_id), không theo index — để reorder không
  //   làm nhảy sang bài khác, và remove/add không làm lệch vị trí đang xem.
  async function reloadExercises() {
    const currentId = exercises[exIdx]?.id
    const exData: Exercise[] = await fetch(`/api/session-exercises?session_id=${sessionId}`).then(r => r.json())
    setExercises(exData)
    setAllSets(prev => {
      const next: Record<string, SetEntry[]> = {}
      for (const ex of exData) {
        if (prev[ex.id]) { next[ex.id] = prev[ex.id]; continue }
        const count = ex.target_sets ?? 4
        next[ex.id] = Array.from({ length: count }, (_, i) => ({
          set_number: i + 1, reps: parseMin(ex.target_reps),
          weight_kg: ex.current_weight_kg ?? 0, rpe: null, note: '', saved: false, editing: false,
        }))
      }
      return next
    })
    if (currentId) {
      const newIdx = exData.findIndex(e => e.id === currentId)
      setExIdx(newIdx !== -1 ? newIdx : Math.min(exIdx, Math.max(0, exData.length - 1)))
    } else {
      setExIdx(i => Math.min(i, Math.max(0, exData.length - 1)))
    }
  }

  useEffect(() => {
    async function load() {
      const { session } = await fetch(`/api/sessions/${sessionId}`).then(r => r.json())
      if (session.type === 'run') { router.replace(`/workout/${sessionId}/run`); return }
      await reloadExercises()
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, router])

  const ex = exercises[exIdx]
  useEffect(() => {
    if (!ex) { setPrevSets([]); return }
    fetch(`/api/sets?exercise_id=${ex.id}&session_id=${sessionId}`).then(r => r.json()).then(setPrevSets)
  }, [ex, sessionId])

  // Đổi bài trong lúc sheet đang mở (hiếm khi xảy ra vì sheet che phủ Strip,
  // nhưng phòng hờ nếu đổi bài bằng dot ở top bar trong khi sheet mở) → đóng
  // sheet để tránh hiển thị sai nội dung bài cũ.
  useEffect(() => {
    setShowDetailSheet(false)
  }, [exIdx])

  const sets = ex ? allSets[ex.id] ?? [] : []
  const activeSetIdx = sets.findIndex(s => !s.saved && !s.editing)

  function updateSet(idx: number, patch: Partial<SetEntry>) {
    setAllSets(prev => ({ ...prev, [ex.id]: prev[ex.id].map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }

  async function saveSet(idx: number) {
    const s = sets[idx]; setSaving(true)
    const res = await fetch('/api/sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, exercise_id: ex.id, set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null }) })
    const saved = await res.json()
    updateSet(idx, { id: saved.id, saved: true, editing: false })
    setSaving(false)
  }

  async function updateSavedSet(idx: number) {
    const s = sets[idx]; if (!s.id) return; setSaving(true)
    await fetch(`/api/sets?id=${s.id}`, { method: 'DELETE' })
    const res = await fetch('/api/sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, exercise_id: ex.id, set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null }) })
    const saved = await res.json()
    updateSet(idx, { id: saved.id, saved: true, editing: false })
    setSaving(false)
  }

  async function finishWorkout() {
    const duration = finishHours * 3600 + finishMins * 60
    await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration_seconds: duration }) })
    router.push(`/summary/${sessionId}`)
  }

  // ── Workout Editor actions — ĐÃ ĐỐI CHIẾU với code thật của 3 API ───────

  // POST /api/session-exercises chỉ nhận { session_id, exercise_id }.
  // Server tự tính display_order và tự snapshot target_sets/target_reps (ADR-004).
  // Có thể trả 409 nếu exercise đã archived, hoặc đã có trong session.
  async function addExerciseToSession(pickedEx: { id: string }) {
    if (editorBusy) return
    setEditorBusy(true)
    setEditorError('')
    try {
      const res = await fetch('/api/session-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, exercise_id: pickedEx.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setEditorError(
          d.error === 'Exercise is archived' ? 'Bài tập này đã được lưu trữ, không thể thêm.'
          : d.error === 'Exercise already in this session' ? 'Bài tập này đã có trong buổi tập.'
          : d.error ?? 'Không thêm được bài tập. Thử lại.'
        )
        return
      }
      await reloadExercises()
      setEditorView('list')
    } finally {
      setEditorBusy(false)
    }
  }

  // DELETE /api/session-exercises/:id — server CHẶN xóa (409) nếu bài đã có workout_sets
  // đã log trong session này ("Exercise already has logged sets"). UI giờ disable nút 🗑
  // ngay từ đầu dựa trên has_logged_sets (field mới, additive) nên confirm/DELETE sẽ không
  // được gọi cho trường hợp này qua luồng bình thường. Guard lại đây chỉ để phòng hờ
  // (defense-in-depth) — server 409 vẫn là chốt chặn cuối cùng bảo vệ dữ liệu.
  async function removeExerciseFromSession(sessionExerciseId: string, name: string, hasLoggedSets?: boolean) {
    if (editorBusy) return
    if (hasLoggedSets) return
    const ok = confirm(`Xóa ${name} khỏi buổi tập này?\nCác set đã ghi sẽ vẫn được giữ lại.`)
    if (!ok) return
    setEditorBusy(true)
    setEditorError('')
    try {
      const res = await fetch(`/api/session-exercises/${sessionExerciseId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        if (d.error === 'Exercise already has logged sets') {
          alert(`Không thể xóa "${name}" vì buổi tập này đã ghi set cho bài này.\nSet đã ghi được giữ nguyên — bài tập vẫn ở trong danh sách.`)
        } else {
          setEditorError(d.error ?? 'Không xóa được bài tập. Thử lại.')
        }
        return
      }
      await reloadExercises()
    } finally {
      setEditorBusy(false)
    }
  }

  // PATCH /api/session-exercises/:id/move — body { direction }, khớp đúng.
  // API trả về full list đã cập nhật, nhưng để đơn giản và tránh trùng logic mapping,
  // vẫn dùng reloadExercises() (1 GET riêng) thay vì dùng trực tiếp response body.
  async function moveExerciseInSession(sessionExerciseId: string, direction: 'up' | 'down') {
    if (editorBusy) return
    setEditorBusy(true)
    setEditorError('')
    try {
      const res = await fetch(`/api/session-exercises/${sessionExerciseId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setEditorError(d.error ?? 'Không đổi được thứ tự. Thử lại.')
        return
      }
      await reloadExercises()
    } finally {
      setEditorBusy(false)
    }
  }

  function openEditor() { setEditorError(''); setShowEditor(true) }
  function closeEditor() { setShowEditor(false); setEditorView('list'); setEditorError('') }

  // Session dùng fallback (chưa có session_exercises thật — session cũ trước Sprint 2) →
  // không cho chỉnh sửa trực tiếp, giữ đúng ADR-001 (không phá lịch sử cũ).
  const usesFallback = exercises.length > 0 && exercises.some(e => e._source === 'template_fallback')

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--text-3)' }}>Đang tải...</p></div>

  const allDone = sets.length > 0 && sets.every(s => s.saved)
  const maxTarget = ex ? parseMax(ex.target_reps) : 12

  function SetForm({ idx, isEdit }: { idx: number; isEdit: boolean }) {
    const s = sets[idx]
    return (
      <div className="space-y-3 pt-1">
        <div className="flex gap-3">
          <Stepper label="Tạ (kg)" value={s.weight_kg} step={0.5} onChange={v => updateSet(idx, { weight_kg: v })} />
          <Stepper label="Reps" value={s.reps} min={1} onChange={v => updateSet(idx, { reps: v })} />
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>RPE (bước 0.5)</p>
          <div className="flex items-center gap-2">
            <button className="step-btn" onPointerDown={e => { e.preventDefault(); if (s.rpe != null) updateSet(idx, { rpe: Math.max(6, Math.round((s.rpe - 0.5) * 10) / 10) }) }}>−</button>
            <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: s.rpe != null ? 'var(--brand-light)' : 'var(--surface-2)', color: s.rpe != null ? 'var(--brand-dark)' : 'var(--text-3)', border: '1.5px solid var(--border)' }}
              onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: s.rpe === null ? 7 : null }) }}>
              {s.rpe != null ? `RPE ${s.rpe}` : 'Chưa chọn'}
            </button>
            <button className="step-btn" onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: Math.min(10, Math.round(((s.rpe ?? 6.5) + 0.5) * 10) / 10) }) }}>+</button>
          </div>
        </div>
        <input type="text" placeholder="Ghi chú (tuỳ chọn)" value={s.note}
          onChange={e => updateSet(idx, { note: e.target.value })}
          className="input" style={{ padding: '10px 14px' }} />
        <div className="flex gap-2">
          <button onClick={() => isEdit ? updateSavedSet(idx) : saveSet(idx)} disabled={saving} className="flex-1 btn-primary py-3">
            {saving ? 'Đang lưu...' : isEdit ? '✓ Cập nhật' : `✓ Xong set ${s.set_number}`}
          </button>
          {isEdit && <button onClick={() => updateSet(idx, { editing: false })} className="btn-ghost">Huỷ</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="text-sm" style={{ color: 'var(--text-3)' }}>← Thoát</button>
        {exercises.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {exercises.map((e, i) => {
              const eSets = allSets[e.id] ?? []
              const done = eSets.every(s => s.saved) && eSets.length > 0
              const partial = eSets.some(s => s.saved) && !done
              return <button key={e.id} onClick={() => setExIdx(i)}
                className="h-2 rounded-full transition-all"
                style={{ width: i === exIdx ? 20 : 8, background: i === exIdx ? 'var(--brand)' : done ? '#16A34A' : partial ? '#D97706' : 'var(--border-strong)' }} />
            })}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Chưa có bài tập</p>
        )}
        <button onClick={() => setShowFinish(true)} className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>Xong</button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Empty state — session strength 0 bài (được phép theo UX Design đã duyệt) */}
        {!ex && exercises.length === 0 && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-3xl">📋</p>
            <p className="font-medium" style={{ color: 'var(--text-2)' }}>Chưa có bài tập nào</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Nhấn Sửa bài tập để thêm.</p>
            <button onClick={openEditor} className="btn-primary py-2.5 text-sm">✏️ Sửa bài tập</button>
          </div>
        )}

        {/* key={ex.id} (Sprint 5.3): khi đổi bài, React remount vùng này,
            animation .fade-in (đã có sẵn trong globals.css, dùng chung
            toàn app) tự chạy lại — không cần state/timer riêng. */}
        {ex && (
          <div key={ex.id} className="space-y-4 fade-in">
            {/* Exercise Strip (Sprint 5.1) — thay cho header cũ */}
            <ExerciseStrip
              exercise={ex}
              index={exIdx}
              total={exercises.length}
              usesFallback={usesFallback}
              onOpenEditor={openEditor}
              onOpenDetail={() => setShowDetailSheet(true)}
            />

            {/* Previous performance */}
            {prevSets.length > 0 && (
              <div className="px-4 py-3 rounded-xl flex gap-3 flex-wrap" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xs w-full font-medium" style={{ color: 'var(--text-3)' }}>Buổi trước</p>
                {prevSets.map(ps => (
                  <span key={ps.set_number} className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                    Set {ps.set_number}: {ps.weight_kg}kg×{ps.reps}
                  </span>
                ))}
              </div>
            )}

            {/* Sets */}
            <div className="space-y-2">
              {sets.map((set, idx) => {
                const isActive = idx === activeSetIdx && !set.saved && !set.editing
                const isDone = set.saved && !set.editing
                const isEditing = set.editing
                return (
                  <div key={idx} className="card p-4 transition-all"
                    style={{ opacity: !isDone && !isActive && !isEditing ? 0.4 : 1, border: isActive || isEditing ? `2px solid var(--brand)` : undefined }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold"
                        style={{ color: isDone ? 'var(--success)' : isActive || isEditing ? 'var(--brand)' : 'var(--text-3)' }}>
                        Set {set.set_number}
                        {isDone && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                          {set.weight_kg}kg × {set.reps}{set.rpe ? ` · RPE ${set.rpe}` : ''}
                        </span>}
                      </span>
                      {isDone && (
                        <button onClick={() => updateSet(idx, { editing: true })}
                          className="text-xs px-2 py-0.5 rounded-lg"
                          style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>Sửa</button>
                      )}
                    </div>
                    {(isActive || isEditing) && <SetForm idx={idx} isEdit={isEditing} />}
                  </div>
                )
              })}
            </div>

            {/* Progressive overload hint */}
            {allDone && sets.length > 0 && (() => {
              const last = sets[sets.length - 1]
              const rpus = sets.filter(s => s.rpe != null).map(s => s.rpe as number)
              const avg = rpus.length ? rpus.reduce((a, b) => a + b, 0) / rpus.length : null
              const canUp = last.reps >= maxTarget && avg != null && avg <= 8
              return (
                <div className="rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ background: canUp ? 'var(--success-bg)' : 'var(--surface-2)', color: canUp ? 'var(--success)' : 'var(--text-3)' }}>
                  {canUp ? `✅ Đủ điều kiện tăng tạ! ${last.weight_kg}kg → ${last.weight_kg + 0.5}kg` : `Giữ tạ ${last.weight_kg}kg, cải thiện thêm`}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Bottom nav — chỉ hiện khi có bài tập */}
      {ex && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          className="sticky bottom-0 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setExIdx(i => Math.max(0, i - 1))} disabled={exIdx === 0}
            className="btn-ghost w-12 flex items-center justify-center">←</button>
          {exIdx < exercises.length - 1
            ? <button onClick={() => setExIdx(i => i + 1)} className="flex-1 btn-primary py-3">
                Bài tiếp: {exercises[exIdx + 1]?.name}
              </button>
            : <button onClick={() => setShowFinish(true)} className="flex-1 btn-primary py-3">Hoàn thành 🎉</button>
          }
        </div>
      )}

      {/* Exercise Detail Bottom Sheet (Sprint 5.2) */}
      {showDetailSheet && ex && (
        <ExerciseDetailSheet
          exercise={{
            name: ex.name,
            muscle_group: ex.muscle_group,
            technique_cue: ex.technique_cue,
            common_mistakes: ex.common_mistakes ?? null,
          }}
          prevSets={prevSets}
          onClose={() => setShowDetailSheet(false)}
        />
      )}

      {/* Finish modal */}
      {showFinish && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="slide-up rounded-t-3xl p-6 space-y-5" style={{ background: 'var(--surface)' }}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-strong)' }} />
            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Hoàn thành buổi tập 💪</h3>
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>THỜI GIAN TẬP</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs mb-1.5 text-center" style={{ color: 'var(--text-3)' }}>Giờ</p>
                  <div className="flex items-center gap-2">
                    <button className="step-btn" onPointerDown={e => { e.preventDefault(); setFinishHours(h => Math.max(0, h - 1)) }}>−</button>
                    <span className="flex-1 text-center font-bold text-xl">{finishHours}</span>
                    <button className="step-btn" onPointerDown={e => { e.preventDefault(); setFinishHours(h => h + 1) }}>+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs mb-1.5 text-center" style={{ color: 'var(--text-3)' }}>Phút</p>
                  <div className="flex items-center gap-2">
                    <button className="step-btn" onPointerDown={e => { e.preventDefault(); setFinishMins(m => Math.max(0, m - 5)) }}>−</button>
                    <span className="flex-1 text-center font-bold text-xl">{finishMins}</span>
                    <button className="step-btn" onPointerDown={e => { e.preventDefault(); setFinishMins(m => Math.min(59, m + 5)) }}>+</button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={finishWorkout} className="btn-primary">Lưu và xem tổng kết</button>
            <button onClick={() => setShowFinish(false)} className="btn-ghost w-full text-center">Tiếp tục tập</button>
          </div>
        </div>
      )}

      {/* Workout Editor — nhúng trong trang, không route riêng (đã khóa ở UX Design) */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={e => { if (e.target === e.currentTarget) closeEditor() }}>
          <div className="slide-up rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-strong)' }} />

            {editorView === 'list' ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Sửa danh sách bài tập</p>
                  <button onClick={closeEditor} style={{ color: 'var(--text-3)' }}>✕</button>
                </div>

                {editorError && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{editorError}</p>
                )}

                <div className="space-y-2">
                  {exercises.map((e, i) => (
                    <div key={e.id} className="card-sm p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{e.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{e.muscle_group}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button disabled={i === 0 || editorBusy || !e.session_exercise_id}
                          onPointerDown={ev => { ev.preventDefault(); e.session_exercise_id && moveExerciseInSession(e.session_exercise_id, 'up') }}
                          className="step-btn !w-8 !h-8 text-sm" style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                        <button disabled={i === exercises.length - 1 || editorBusy || !e.session_exercise_id}
                          onPointerDown={ev => { ev.preventDefault(); e.session_exercise_id && moveExerciseInSession(e.session_exercise_id, 'down') }}
                          className="step-btn !w-8 !h-8 text-sm" style={{ opacity: i === exercises.length - 1 ? 0.3 : 1 }}>↓</button>
                        <button disabled={editorBusy || !e.session_exercise_id || e.has_logged_sets}
                          title={e.has_logged_sets ? 'Không thể xóa vì bài tập đã có dữ liệu đã ghi.' : undefined}
                          onPointerDown={ev => { ev.preventDefault(); e.session_exercise_id && removeExerciseFromSession(e.session_exercise_id, e.name, e.has_logged_sets) }}
                          className="step-btn !w-8 !h-8 text-sm"
                          style={{ color: e.has_logged_sets ? 'var(--text-3)' : 'var(--danger)', opacity: e.has_logged_sets ? 0.5 : 1 }}>🗑</button>
                      </div>
                    </div>
                  ))}
                  {exercises.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>Chưa có bài tập nào</p>
                  )}
                </div>

                <button onClick={() => { setEditorError(''); setEditorView('picker') }} disabled={editorBusy} className="btn-primary">
                  + Thêm bài tập
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditorError(''); setEditorView('list') }} style={{ color: 'var(--text-3)' }}>←</button>
                  <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Chọn bài tập</p>
                  <button onClick={closeEditor} className="ml-auto" style={{ color: 'var(--text-3)' }}>✕</button>
                </div>
                {editorError && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{editorError}</p>
                )}
                <ExercisePicker
                  allowArchived={false}
                  allowSearch
                  allowFilter
                  excludeIds={exercises.map(e => e.id)}
                  onSelect={addExerciseToSession}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
