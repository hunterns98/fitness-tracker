'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────
type SessionExercise = {
  id: string // exercise_id (đúng shape trả về từ GET /api/session-exercises)
  name: string
  muscle_group: string | null
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
}

type SavedSetRow = {
  id: string
  exercise_id: string
  set_number: number
  reps: number
  weight_kg: number
  rpe: number | null
  note: string | null
}

type PrevSet = { set_number: number; reps: number; weight_kg: number }

type SetEntry = {
  id?: string
  set_number: number
  reps: number
  weight_kg: number
  rpe: number | null
  note: string
  saved: boolean
  editing: boolean
}

function parseMin(t: string | null) { const m = t?.match(/\d+/); return m ? parseInt(m[0]) : 10 }

// ── Local Stepper — 48px touch target, number input typeable trên desktop.
// KHÔNG dùng chung với Stepper của V1 (khác yêu cầu kích thước/behavior),
// và KHÔNG sửa .step-btn trong globals.css (dùng chung với V1 nhiều nơi khác).
function Stepper({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div className="flex-1">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="step-btn shrink-0"
          style={{ width: 48, height: 48 }}
          onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
          className="flex-1 text-center font-bold text-xl tabular-nums bg-transparent outline-none"
          style={{ color: 'var(--text)', height: 48 }}
        />
        <button
          type="button"
          className="step-btn shrink-0"
          style={{ width: 48, height: 48 }}
          onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function V2WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [unsupportedType, setUnsupportedType] = useState(false)

  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [exIdx, setExIdx] = useState(0)
  const [allSets, setAllSets] = useState<Record<string, SetEntry[]>>({})
  const [prevSets, setPrevSets] = useState<PrevSet[]>([])
  const [saving, setSaving] = useState(false)

  const [showFinish, setShowFinish] = useState(false)
  const [finishHours, setFinishHours] = useState(1)
  const [finishMins, setFinishMins] = useState(0)
  const [finishing, setFinishing] = useState(false)

  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')

      const sessionRes = await fetch(`/api/sessions/${sessionId}`)
      if (!sessionRes.ok) {
        setLoadError('Không tìm thấy buổi tập.')
        setLoading(false)
        return
      }
      const { session, sets: existingSets }: { session: { type: string }; sets: SavedSetRow[] } = await sessionRes.json()

      if (session.type !== 'strength') {
        setUnsupportedType(true)
        setLoading(false)
        return
      }

      // Reuse GET /api/session-exercises nguyên trạng — bao gồm cả fallback
      // template_exercises cho legacy session, không cần xử lý riêng ở đây.
      const exData: SessionExercise[] = await fetch(`/api/session-exercises?session_id=${sessionId}`).then(r => r.json())
      setExercises(exData)

      // Với mỗi bài, dựng sẵn allSets: ưu tiên set đã lưu thật của CHÍNH
      // session này (reload/continue), nếu chưa có thì prefill từ session
      // trước theo ĐÚNG set_number, RPE luôn để trống khi prefill.
      const next: Record<string, SetEntry[]> = {}
      for (const ex of exData) {
        const count = ex.target_sets ?? 4
        const savedForEx = existingSets.filter(s => s.exercise_id === ex.id)

        const prevRes: PrevSet[] = await fetch(`/api/sets?exercise_id=${ex.id}&session_id=${sessionId}`).then(r => r.json())

        const rows: SetEntry[] = []
        for (let i = 0; i < count; i++) {
          const setNumber = i + 1
          const already = savedForEx.find(s => s.set_number === setNumber)
          if (already) {
            rows.push({
              id: already.id, set_number: setNumber, reps: already.reps, weight_kg: already.weight_kg,
              rpe: already.rpe, note: already.note ?? '', saved: true, editing: false,
            })
            continue
          }
          const prevMatch = prevRes.find(p => p.set_number === setNumber)
          rows.push({
            set_number: setNumber,
            reps: prevMatch ? prevMatch.reps : parseMin(ex.target_reps),
            weight_kg: prevMatch ? prevMatch.weight_kg : (ex.current_weight_kg ?? 0),
            rpe: null, // KHÔNG prefill RPE, luôn để trống cho set mới
            note: '', saved: false, editing: false,
          })
        }
        next[ex.id] = rows
      }
      setAllSets(next)
      setLoading(false)
    }
    load()
  }, [sessionId])

  const ex = exercises[exIdx]

  useEffect(() => {
    if (!ex) { setPrevSets([]); return }
    fetch(`/api/sets?exercise_id=${ex.id}&session_id=${sessionId}`).then(r => r.json()).then(setPrevSets)
  }, [ex, sessionId])

  const sets = ex ? allSets[ex.id] ?? [] : []
  const activeSetIdx = sets.findIndex(s => !s.saved && !s.editing)
  const allCurrentSaved = sets.length > 0 && sets.every(s => s.saved)

  function updateSet(idx: number, patch: Partial<SetEntry>) {
    setAllSets(prev => ({ ...prev, [ex.id]: prev[ex.id].map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }

  async function saveSet(idx: number) {
    const s = sets[idx]
    setSaving(true)
    try {
      const res = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId, exercise_id: ex.id, set_number: s.set_number,
          reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null,
        }),
      })
      const saved = await res.json()
      updateSet(idx, { id: saved.id, saved: true, editing: false })
    } finally {
      setSaving(false)
    }
  }

  async function updateSavedSet(idx: number) {
    const s = sets[idx]
    if (!s.id) return
    setSaving(true)
    try {
      await fetch(`/api/sets?id=${s.id}`, { method: 'DELETE' })
      const res = await fetch('/api/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId, exercise_id: ex.id, set_number: s.set_number,
          reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null,
        }),
      })
      const saved = await res.json()
      updateSet(idx, { id: saved.id, saved: true, editing: false })
    } finally {
      setSaving(false)
    }
  }

  function addExtraSet() {
    if (!ex) return
    const nextNumber = sets.length + 1
    const prevMatch = prevSets.find(p => p.set_number === nextNumber)
    const last = sets[sets.length - 1]
    setAllSets(prev => ({
      ...prev,
      [ex.id]: [
        ...prev[ex.id],
        {
          set_number: nextNumber,
          reps: prevMatch ? prevMatch.reps : (last?.reps ?? parseMin(ex.target_reps)),
          weight_kg: prevMatch ? prevMatch.weight_kg : (last?.weight_kg ?? ex.current_weight_kg ?? 0),
          rpe: null,
          note: '', saved: false, editing: false,
        },
      ],
    }))
  }

  function goPrev() { setExIdx(i => Math.max(0, i - 1)) }
  function goNext() { setExIdx(i => Math.min(exercises.length - 1, i + 1)) }

  function onHeaderTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onHeaderTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    const THRESHOLD = 50
    if (deltaX > THRESHOLD) goPrev()
    else if (deltaX < -THRESHOLD) goNext()
  }

  async function finishWorkout() {
    if (finishing) return
    setFinishing(true)
    try {
      const duration = finishHours * 3600 + finishMins * 60
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: duration }),
      })
      router.push('/today')
    } finally {
      setFinishing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-3)' }}>Đang tải...</p>
    </div>
  }

  if (loadError) {
    return <div className="flex flex-col items-center justify-center h-screen gap-4 px-6" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--danger)' }}>{loadError}</p>
      <button onClick={() => router.push('/today')} className="btn-primary" style={{ minHeight: 48, width: 200 }}>Về Today</button>
    </div>
  }

  if (unsupportedType) {
    return <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-2)' }}>Buổi tập này không phải kháng lực — V2 hiện chỉ hỗ trợ Workout Logging cho buổi kháng lực.</p>
      <button onClick={() => router.push('/today')} className="btn-primary" style={{ minHeight: 48, width: 200 }}>Về Today</button>
    </div>
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/today')} className="text-sm" style={{ color: 'var(--text-3)', minHeight: 48 }}>← Today</button>
        {exercises.length > 0 && (
          <div className="flex items-center gap-1.5">
            {exercises.map((e, i) => {
              const eSets = allSets[e.id] ?? []
              const done = eSets.length > 0 && eSets.every(s => s.saved)
              const partial = eSets.some(s => s.saved) && !done
              return <span key={e.id}
                className="h-2 rounded-full transition-all"
                style={{ width: i === exIdx ? 20 : 8, background: i === exIdx ? 'var(--brand)' : done ? '#16A34A' : partial ? '#D97706' : 'var(--border-strong)' }} />
            })}
          </div>
        )}
        <button onClick={() => setShowFinish(true)} className="text-sm font-semibold" style={{ color: 'var(--brand)', minHeight: 48 }}>Xong</button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {exercises.length === 0 && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-3xl">📋</p>
            <p className="font-medium" style={{ color: 'var(--text-2)' }}>Buổi tập này chưa có bài tập nào.</p>
            <button onClick={() => router.push('/today')} className="btn-primary py-2.5 text-sm" style={{ minHeight: 48 }}>Về Today</button>
          </div>
        )}

        {ex && (
          <div key={ex.id} className="space-y-4 fade-in">
            {/* Exercise header — swipe left/right để chuyển bài */}
            <div
              className="card w-full p-3 flex items-center gap-3"
              onTouchStart={onHeaderTouchStart}
              onTouchEnd={onHeaderTouchEnd}
              style={{ minHeight: 64 }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>{exIdx + 1}/{exercises.length}</span>
            </div>

            {/* Previous performance — luôn hiển thị ngay trên, không mở sheet riêng */}
            <div className="px-4 py-3 rounded-xl flex gap-3 flex-wrap" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xs w-full font-medium" style={{ color: 'var(--text-3)' }}>Buổi trước</p>
              {prevSets.length === 0 && <p className="text-xs" style={{ color: 'var(--text-3)' }}>Chưa có dữ liệu</p>}
              {prevSets.map(ps => (
                <span key={ps.set_number} className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                  Set {ps.set_number}: {ps.weight_kg}kg×{ps.reps}
                </span>
              ))}
            </div>

            {/* Sets */}
            <div className="space-y-2">
              {sets.map((set, idx) => {
                const isActive = idx === activeSetIdx && !set.saved && !set.editing
                const isDone = set.saved && !set.editing
                const isEditing = set.editing
                return (
                  <div key={idx} className="card p-4 transition-all"
                    style={{ opacity: !isDone && !isActive && !isEditing ? 0.4 : 1, border: isActive || isEditing ? '2px solid var(--brand)' : undefined }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{ color: isDone ? 'var(--success)' : isActive || isEditing ? 'var(--brand)' : 'var(--text-3)' }}>
                        Set {set.set_number}
                        {isDone && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                          {set.weight_kg}kg × {set.reps}{set.rpe ? ` · RPE ${set.rpe}` : ''}
                        </span>}
                      </span>
                      {isDone && (
                        <button onClick={() => updateSet(idx, { editing: true })}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ color: 'var(--text-3)', border: '1px solid var(--border)', minHeight: 32 }}>
                          Sửa
                        </button>
                      )}
                    </div>

                    {(isActive || isEditing) && (
                      <div className="space-y-3 pt-1">
                        <div className="flex gap-3">
                          <Stepper label="Tạ (kg)" value={set.weight_kg} step={0.5} onChange={v => updateSet(idx, { weight_kg: v })} />
                          <Stepper label="Reps" value={set.reps} min={1} onChange={v => updateSet(idx, { reps: v })} />
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>RPE (tùy chọn)</p>
                          <div className="flex items-center gap-2">
                            <button type="button" className="step-btn" style={{ width: 48, height: 48 }}
                              onPointerDown={e => { e.preventDefault(); if (set.rpe != null) updateSet(idx, { rpe: Math.max(6, Math.round((set.rpe - 0.5) * 10) / 10) }) }}>−</button>
                            <button type="button" className="flex-1 rounded-xl text-sm font-semibold transition-all"
                              style={{ height: 48, background: set.rpe != null ? 'var(--brand-light)' : 'var(--surface-2)', color: set.rpe != null ? 'var(--brand-dark)' : 'var(--text-3)', border: '1.5px solid var(--border)' }}
                              onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: set.rpe === null ? 7 : null }) }}>
                              {set.rpe != null ? `RPE ${set.rpe}` : 'Chưa chọn'}
                            </button>
                            <button type="button" className="step-btn" style={{ width: 48, height: 48 }}
                              onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: Math.min(10, Math.round(((set.rpe ?? 6.5) + 0.5) * 10) / 10) }) }}>+</button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => isEditing ? updateSavedSet(idx) : saveSet(idx)}
                            disabled={saving}
                            className="flex-1 btn-primary"
                            style={{ minHeight: 48 }}
                          >
                            {saving ? 'Đang lưu...' : isEditing ? '✓ Cập nhật' : `✓ Xong set ${set.set_number}`}
                          </button>
                          {isEditing && <button onClick={() => updateSet(idx, { editing: false })} className="btn-ghost" style={{ minHeight: 48 }}>Huỷ</button>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Không tự tạo set khi đạt target_sets — chỉ tạo khi user chủ động bấm */}
              {allCurrentSaved && (
                <button onClick={addExtraSet} className="btn-ghost w-full text-center" style={{ minHeight: 48 }}>
                  + Add extra set
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav — Prev/Next, chỉ hiện khi có bài tập */}
      {ex && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          className="sticky bottom-0 px-4 py-3 flex items-center gap-3">
          <button onClick={goPrev} disabled={exIdx === 0}
            className="btn-ghost flex items-center justify-center" style={{ width: 56, minHeight: 48 }}>←</button>
          {exIdx < exercises.length - 1
            ? <button onClick={goNext} className="flex-1 btn-primary" style={{ minHeight: 48 }}>
                Bài tiếp: {exercises[exIdx + 1]?.name}
              </button>
            : <button onClick={() => setShowFinish(true)} className="flex-1 btn-primary" style={{ minHeight: 48 }}>Hoàn thành 🎉</button>
          }
          <button onClick={goNext} disabled={exIdx === exercises.length - 1}
            className="btn-ghost flex items-center justify-center" style={{ width: 56, minHeight: 48 }}>→</button>
        </div>
      )}

      {/* Finish modal — luôn cần confirm, không finish bằng 1 tap vô tình */}
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
                    <button className="step-btn" style={{ width: 48, height: 48 }} onPointerDown={e => { e.preventDefault(); setFinishHours(h => Math.max(0, h - 1)) }}>−</button>
                    <span className="flex-1 text-center font-bold text-xl">{finishHours}</span>
                    <button className="step-btn" style={{ width: 48, height: 48 }} onPointerDown={e => { e.preventDefault(); setFinishHours(h => h + 1) }}>+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs mb-1.5 text-center" style={{ color: 'var(--text-3)' }}>Phút</p>
                  <div className="flex items-center gap-2">
                    <button className="step-btn" style={{ width: 48, height: 48 }} onPointerDown={e => { e.preventDefault(); setFinishMins(m => Math.max(0, m - 5)) }}>−</button>
                    <span className="flex-1 text-center font-bold text-xl">{finishMins}</span>
                    <button className="step-btn" style={{ width: 48, height: 48 }} onPointerDown={e => { e.preventDefault(); setFinishMins(m => Math.min(59, m + 5)) }}>+</button>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={finishWorkout} disabled={finishing} className="btn-primary" style={{ minHeight: 48 }}>
              {finishing ? 'Đang lưu...' : 'Xác nhận hoàn thành'}
            </button>
            <button onClick={() => setShowFinish(false)} className="btn-ghost w-full text-center" style={{ minHeight: 48 }}>Tiếp tục tập</button>
          </div>
        </div>
      )}
    </div>
  )
}
