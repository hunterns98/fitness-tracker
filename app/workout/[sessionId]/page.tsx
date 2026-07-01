'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDuration } from '@/lib/utils'

type Exercise = {
  id: string; name: string; muscle_group: string
  current_weight_kg: number | null; target_reps: string | null
  target_sets: number | null; technique_cue: string | null
}

type SetEntry = {
  id?: string; set_number: number
  reps: number; weight_kg: number; rpe: number | null; note: string
  saved: boolean; editing: boolean
}

type PrevSet = { set_number: number; reps: number; weight_kg: number }

function Stepper({ label, value, onChange, step = 1, min = 0, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }} aria-label={`Giảm ${label}`}>−</button>
        <span className="flex-1 text-center font-semibold text-xl tabular-nums">{value}{unit}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }} aria-label={`Tăng ${label}`}>+</button>
      </div>
    </div>
  )
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exIdx, setExIdx] = useState(0)
  const [allSets, setAllSets] = useState<Record<string, SetEntry[]>>({})
  const [prevSets, setPrevSets] = useState<PrevSet[]>([])
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime])

  useEffect(() => {
    async function load() {
      const { session } = await fetch(`/api/sessions/${sessionId}`).then(r => r.json())
      if (session.type === 'run') { router.replace(`/workout/${sessionId}/run`); return }
      if (!session.template_id) { setLoading(false); return }

      const exData: Exercise[] = await fetch(`/api/exercises?template_id=${session.template_id}`).then(r => r.json())
      setExercises(exData)

      const initSets: Record<string, SetEntry[]> = {}
      for (const ex of exData) {
        const count = ex.target_sets ?? 4
        initSets[ex.id] = Array.from({ length: count }, (_, i) => ({
          set_number: i + 1,
          reps: parseMin(ex.target_reps),
          weight_kg: ex.current_weight_kg ?? 0,
          rpe: null, note: '', saved: false, editing: false,
        }))
      }
      setAllSets(initSets)
      setLoading(false)
    }
    load()
  }, [sessionId, router])

  const ex = exercises[exIdx]
  useEffect(() => {
    if (!ex) return
    fetch(`/api/sets?exercise_id=${ex.id}&session_id=${sessionId}`).then(r => r.json()).then(setPrevSets)
  }, [ex, sessionId])

  function parseMin(t: string | null) { const m = t?.match(/\d+/); return m ? parseInt(m[0]) : 10 }
  function parseMax(t: string | null) { const m = t?.match(/\d+/g); return m ? parseInt(m[m.length - 1]) : 12 }

  const sets = ex ? allSets[ex.id] ?? [] : []
  const activeSetIdx = sets.findIndex(s => !s.saved && !s.editing)

  function updateSet(idx: number, patch: Partial<SetEntry>) {
    setAllSets(prev => ({ ...prev, [ex.id]: prev[ex.id].map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }

  async function saveSet(idx: number) {
    const s = sets[idx]
    setSaving(true)
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, exercise_id: ex.id, set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null }),
    })
    const saved = await res.json()
    updateSet(idx, { id: saved.id, saved: true, editing: false })
    setSaving(false)
  }

  async function updateSavedSet(idx: number) {
    const s = sets[idx]
    if (!s.id) return
    setSaving(true)
    await fetch(`/api/sets?id=${s.id}`, { method: 'DELETE' })
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, exercise_id: ex.id, set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note || null }),
    })
    const saved = await res.json()
    updateSet(idx, { id: saved.id, saved: true, editing: false })
    setSaving(false)
  }

  async function finishWorkout() {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: elapsed }),
    })
    router.push(`/summary/${sessionId}`)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><p className="text-gray-500 text-sm">Đang tải...</p></div>
  if (!ex) return <div className="px-4 pt-6 space-y-4"><p className="text-gray-400">Không tìm thấy bài tập.</p><button className="btn-primary" onClick={() => router.push('/')}>Về trang chủ</button></div>

  const allDone = sets.every(s => s.saved)
  const maxTarget = parseMax(ex.target_reps)

  // Render set input form (dùng cho cả new set và edit set)
  function SetInputForm({ idx, isEdit }: { idx: number; isEdit: boolean }) {
    const s = sets[idx]
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <Stepper label="Tạ (kg)" value={s.weight_kg} step={0.5} onChange={v => updateSet(idx, { weight_kg: v })} />
          <Stepper label="Reps" value={s.reps} min={1} onChange={v => updateSet(idx, { reps: v })} />
        </div>
        {/* RPE stepper bước 0.5 */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">RPE <span className="text-gray-600">(6–10, bước 0.5)</span></p>
          <div className="flex items-center gap-2">
            <button className="step-btn" onPointerDown={e => { e.preventDefault(); if (s.rpe !== null) updateSet(idx, { rpe: Math.max(6, Math.round((s.rpe - 0.5) * 10) / 10) }) }}>−</button>
            <button
              className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium text-center"
              onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: s.rpe === null ? 7 : null }) }}
            >
              {s.rpe !== null ? s.rpe : <span className="text-gray-600">Chưa chọn</span>}
            </button>
            <button className="step-btn" onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: Math.min(10, Math.round(((s.rpe ?? 6.5) + 0.5) * 10) / 10) }) }}>+</button>
          </div>
        </div>
        <input type="text" placeholder="Ghi chú (tuỳ chọn)" value={s.note} onChange={e => updateSet(idx, { note: e.target.value })}
          className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0 text-sm text-gray-300 placeholder-gray-700 outline-none" />
        <div className="flex gap-2">
          <button onClick={() => isEdit ? updateSavedSet(idx) : saveSet(idx)} disabled={saving} className="flex-1 btn-primary py-3">
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : `Xong set ${s.set_number}`}
          </button>
          {isEdit && (
            <button onClick={() => updateSet(idx, { editing: false })} className="btn-ghost px-4">Huỷ</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-900 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="text-gray-400 text-sm">← Thoát</button>
        <span className="text-sm font-mono text-gray-400">{formatDuration(elapsed)}</span>
        <button onClick={finishWorkout} className="text-sm text-sky-400 font-medium">Xong</button>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto">
        {exercises.map((e, i) => {
          const eSets = allSets[e.id] ?? []
          const done = eSets.every(s => s.saved) && eSets.length > 0
          const partial = eSets.some(s => s.saved) && !done
          return (
            <button key={e.id} onClick={() => setExIdx(i)}
              className={`shrink-0 h-2 rounded-full transition-all ${i === exIdx ? 'w-5 bg-sky-400' : done ? 'w-2 bg-green-500' : partial ? 'w-2 bg-yellow-500' : 'w-2 bg-gray-700'}`}
              aria-label={e.name} />
          )
        })}
      </div>

      <div className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{ex.name}</h2>
            <span className="text-xs text-gray-600">{exIdx + 1}/{exercises.length}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Mục tiêu: {ex.current_weight_kg ?? '?'}kg · {ex.target_sets ?? 4} sets · {ex.target_reps ?? '?'} reps</p>
          {ex.technique_cue && <p className="text-xs text-sky-600 mt-1 leading-relaxed">{ex.technique_cue}</p>}
        </div>

        {prevSets.length > 0 && (
          <div className="card px-3 py-2.5">
            <p className="text-xs text-gray-600 mb-1.5">Buổi trước</p>
            <div className="flex gap-3 flex-wrap">
              {prevSets.map(ps => <span key={ps.set_number} className="text-xs text-gray-400">Set {ps.set_number}: {ps.weight_kg}kg × {ps.reps}</span>)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {sets.map((set, idx) => {
            const isActive = idx === activeSetIdx && !set.saved && !set.editing
            const isDone = set.saved && !set.editing
            const isEditing = set.editing

            return (
              <div key={idx} className={`card p-4 transition-all ${isDone ? 'opacity-70' : isActive || isEditing ? 'border-sky-800' : 'opacity-40'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-medium ${isDone ? 'text-green-400' : isActive || isEditing ? 'text-sky-400' : 'text-gray-600'}`}>
                    Set {set.set_number}
                    {isDone && <span className="ml-2 text-xs font-normal text-gray-500">{set.weight_kg}kg × {set.reps}{set.rpe ? ` · RPE ${set.rpe}` : ''}</span>}
                  </span>
                  {isDone && (
                    <button onClick={() => updateSet(idx, { editing: true })} className="text-xs text-gray-600 border border-gray-700 px-2 py-0.5 rounded-lg">Sửa</button>
                  )}
                  {!isDone && !isEditing && !isActive && <span className="text-gray-700 text-xs">—</span>}
                </div>
                {(isActive || isEditing) && <SetInputForm idx={idx} isEdit={isEditing} />}
              </div>
            )
          })}
        </div>

        {allDone && sets.length > 0 && (() => {
          const lastSet = sets[sets.length - 1]
          const rpus = sets.filter(s => s.rpe !== null).map(s => s.rpe as number)
          const avgRpe = rpus.length ? rpus.reduce((a, b) => a + b, 0) / rpus.length : null
          const canIncrease = lastSet.reps >= maxTarget && avgRpe !== null && avgRpe <= 8
          return (
            <div className={`card px-4 py-3 text-sm ${canIncrease ? 'border-green-800 text-green-400' : 'border-gray-800 text-gray-500'}`}>
              {canIncrease ? `✅ Đủ điều kiện tăng tạ! (${lastSet.weight_kg}kg → ${lastSet.weight_kg + 0.5}kg)` : `Giữ tạ ${lastSet.weight_kg}kg, tiếp tục hoàn thiện`}
            </div>
          )
        })()}
      </div>

      <div className="sticky bottom-0 border-t border-gray-900 bg-gray-950 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setExIdx(i => Math.max(0, i - 1))} disabled={exIdx === 0} className="btn-ghost w-12 flex items-center justify-center" aria-label="Bài trước">←</button>
        {exIdx < exercises.length - 1
          ? <button onClick={() => setExIdx(i => i + 1)} className="flex-1 btn-primary py-3">Bài tiếp: {exercises[exIdx + 1]?.name}</button>
          : <button onClick={finishWorkout} className="flex-1 btn-primary py-3">Hoàn thành 🎉</button>
        }
      </div>
    </div>
  )
}
