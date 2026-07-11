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

  useEffect(() => {
    async function load() {
      const { session } = await fetch(`/api/sessions/${sessionId}`).then(r => r.json())
      if (session.type === 'run') { router.replace(`/workout/${sessionId}/run`); return }
      if (!session.template_id) { setLoading(false); return }
      const exData: Exercise[] = await fetch(`/api/session-exercises?session_id=${sessionId}`).then(r => r.json())
      setExercises(exData)
      const initSets: Record<string, SetEntry[]> = {}
      for (const ex of exData) {
        const count = ex.target_sets ?? 4
        initSets[ex.id] = Array.from({ length: count }, (_, i) => ({
          set_number: i + 1, reps: parseMin(ex.target_reps),
          weight_kg: ex.current_weight_kg ?? 0, rpe: null, note: '', saved: false, editing: false,
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

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--text-3)' }}>Đang tải...</p></div>
  if (!ex) return <div className="px-4 pt-6 space-y-4"><p style={{ color: 'var(--text-2)' }}>Không tìm thấy bài tập.</p><button className="btn-primary" onClick={() => router.push('/')}>Về trang chủ</button></div>

  const allDone = sets.every(s => s.saved)
  const maxTarget = parseMax(ex.target_reps)

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
        <button onClick={() => setShowFinish(true)} className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>Xong</button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Exercise header */}
        <div className="card p-4">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{ex.name}</h2>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{exIdx + 1}/{exercises.length}</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            Mục tiêu: {ex.current_weight_kg ?? '?'}kg · {ex.target_sets ?? 4} sets · {ex.target_reps ?? '?'} reps
          </p>
          {ex.technique_cue && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--brand-dark)' }}>{ex.technique_cue}</p>
          )}
        </div>

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

      {/* Bottom nav */}
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

      {/* Finish modal - nhập thời gian thủ công */}
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
    </div>
  )
}
