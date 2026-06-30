'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDuration } from '@/lib/utils'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  technique_cue: string | null
}

type SetEntry = {
  id?: string
  set_number: number
  reps: number
  weight_kg: number
  rpe: number | null
  note: string
  saved: boolean
}

type Session = {
  id: string
  type: string
  template_id: string | null
  name_override: string | null
  date: string
}

type PrevSet = { set_number: number; reps: number; weight_kg: number }

// Stepper: tăng/giảm số bằng nút +/-
function Stepper({
  label, value, onChange, step = 1, min = 0, unit = '',
}: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <button
          className="step-btn"
          onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, value - step)) }}
          aria-label={`Giảm ${label}`}
        >−</button>
        <span className="flex-1 text-center font-semibold text-xl tabular-nums">
          {value}{unit}
        </span>
        <button
          className="step-btn"
          onPointerDown={e => { e.preventDefault(); onChange(value + step) }}
          aria-label={`Tăng ${label}`}
        >+</button>
      </div>
    </div>
  )
}

export default function WorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exIdx, setExIdx] = useState(0) // bài tập đang active
  const [allSets, setAllSets] = useState<Record<string, SetEntry[]>>({})
  const [prevSets, setPrevSets] = useState<PrevSet[]>([])
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [startTime])

  // Load session + exercises
  useEffect(() => {
    async function load() {
      const [sessRes, exRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
        fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
      ])
      const s: Session = sessRes.session
      setSession(s)

      if (s.type === 'run') {
        router.replace(`/workout/${sessionId}/run`)
        return
      }

      if (s.template_id) {
        const exData: Exercise[] = await fetch(
          `/api/exercises?template_id=${s.template_id}`
        ).then(r => r.json())
        setExercises(exData)

        // Init sets từ target
        const initSets: Record<string, SetEntry[]> = {}
        for (const ex of exData) {
          const count = ex.target_sets ?? 4
          initSets[ex.id] = Array.from({ length: count }, (_, i) => ({
            set_number: i + 1,
            reps: parseTargetRepsMin(ex.target_reps),
            weight_kg: ex.current_weight_kg ?? 0,
            rpe: null,
            note: '',
            saved: false,
          }))
        }
        setAllSets(initSets)
      }
      setLoading(false)
    }
    load()
  }, [sessionId, router])

  // Load previous sets khi chuyển exercise
  const ex = exercises[exIdx]
  useEffect(() => {
    if (!ex) return
    fetch(`/api/sets?exercise_id=${ex.id}&session_id=${sessionId}`)
      .then(r => r.json())
      .then(setPrevSets)
  }, [ex, sessionId])

  function parseTargetRepsMin(target: string | null): number {
    if (!target) return 10
    const match = target.match(/\d+/)
    return match ? parseInt(match[0]) : 10
  }

  function parseTargetRepsMax(target: string | null): number {
    if (!target) return 12
    const nums = target.match(/\d+/g)
    if (!nums) return 12
    return parseInt(nums[nums.length - 1])
  }

  const sets = ex ? allSets[ex.id] ?? [] : []
  const activeSetIdx = sets.findIndex(s => !s.saved)

  function updateSet(idx: number, patch: Partial<SetEntry>) {
    setAllSets(prev => {
      const copy = { ...prev }
      copy[ex.id] = copy[ex.id].map((s, i) => i === idx ? { ...s, ...patch } : s)
      return copy
    })
  }

  async function saveSet(idx: number) {
    const s = sets[idx]
    setSaving(true)
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        exercise_id: ex.id,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        rpe: s.rpe,
        note: s.note || null,
      }),
    })
    const saved = await res.json()
    setAllSets(prev => {
      const copy = { ...prev }
      copy[ex.id] = copy[ex.id].map((set, i) =>
        i === idx ? { ...set, id: saved.id, saved: true } : set
      )
      return copy
    })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-sm">Đang tải...</p>
      </div>
    )
  }

  if (!ex) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <p className="text-gray-400">Không tìm thấy bài tập trong buổi này.</p>
        <button className="btn-primary" onClick={() => router.push('/')}>Về trang chủ</button>
      </div>
    )
  }

  const allDone = sets.every(s => s.saved)
  const maxTarget = parseTargetRepsMax(ex.target_reps)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-900
                      px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 text-sm"
        >
          ← Thoát
        </button>
        <span className="text-sm font-mono text-gray-400">{formatDuration(elapsed)}</span>
        <button
          onClick={finishWorkout}
          className="text-sm text-sky-400 font-medium"
        >
          Xong
        </button>
      </div>

      {/* Exercise nav dots */}
      <div className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto">
        {exercises.map((e, i) => {
          const eSets = allSets[e.id] ?? []
          const done = eSets.every(s => s.saved) && eSets.length > 0
          const partial = eSets.some(s => s.saved) && !done
          return (
            <button
              key={e.id}
              onClick={() => setExIdx(i)}
              className={`shrink-0 w-2 h-2 rounded-full transition-all ${
                i === exIdx
                  ? 'w-5 bg-sky-400'
                  : done
                  ? 'bg-green-500'
                  : partial
                  ? 'bg-yellow-500'
                  : 'bg-gray-700'
              }`}
              aria-label={e.name}
            />
          )
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto">
        {/* Exercise header */}
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{ex.name}</h2>
            <span className="text-xs text-gray-600">
              {exIdx + 1}/{exercises.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Mục tiêu: {ex.current_weight_kg ?? '?'}kg ·{' '}
            {ex.target_sets ?? 4} sets · {ex.target_reps ?? '?'} reps
          </p>
          {ex.technique_cue && (
            <p className="text-xs text-sky-600 mt-1 leading-relaxed">{ex.technique_cue}</p>
          )}
        </div>

        {/* Previous performance */}
        {prevSets.length > 0 && (
          <div className="card px-3 py-2.5">
            <p className="text-xs text-gray-600 mb-1.5">Buổi trước</p>
            <div className="flex gap-3 flex-wrap">
              {prevSets.map(ps => (
                <span key={ps.set_number} className="text-xs text-gray-400">
                  Set {ps.set_number}: {ps.weight_kg}kg × {ps.reps}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sets */}
        <div className="space-y-2">
          {sets.map((set, idx) => {
            const isActive = idx === activeSetIdx
            const isDone = set.saved

            return (
              <div
                key={idx}
                className={`card p-4 transition-all ${
                  isDone
                    ? 'opacity-60'
                    : isActive
                    ? 'border-sky-800 bg-gray-900'
                    : 'opacity-40'
                }`}
              >
                {/* Set header */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-medium ${
                    isDone ? 'text-green-400' : isActive ? 'text-sky-400' : 'text-gray-600'
                  }`}>
                    Set {set.set_number}
                    {isDone && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {set.weight_kg}kg × {set.reps}
                        {set.rpe ? ` · RPE ${set.rpe}` : ''}
                      </span>
                    )}
                  </span>
                  {isDone && <span className="text-green-500 text-base">✓</span>}
                </div>

                {/* Input area - chỉ hiện khi active */}
                {isActive && !isDone && (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Stepper
                        label="Tạ (kg)"
                        value={set.weight_kg}
                        step={0.5}
                        onChange={v => updateSet(idx, { weight_kg: v })}
                        unit=""
                      />
                      <Stepper
                        label="Reps"
                        value={set.reps}
                        onChange={v => updateSet(idx, { reps: v })}
                        min={1}
                      />
                    </div>

                    {/* RPE buttons */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">RPE</p>
                      <div className="flex gap-1.5">
                        {[6, 7, 8, 9, 10].map(r => (
                          <button
                            key={r}
                            onPointerDown={e => { e.preventDefault(); updateSet(idx, { rpe: r }) }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                              ${set.rpe === r
                                ? 'bg-sky-600 text-white'
                                : 'bg-gray-800 text-gray-400'
                              }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note (optional) */}
                    <input
                      type="text"
                      placeholder="Ghi chú (tuỳ chọn)"
                      value={set.note}
                      onChange={e => updateSet(idx, { note: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0
                                 text-sm text-gray-300 placeholder-gray-700 outline-none"
                    />

                    <button
                      onClick={() => saveSet(idx)}
                      disabled={saving}
                      className="btn-primary py-3"
                    >
                      {saving ? 'Đang lưu...' : `Xong set ${set.set_number}`}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progressive overload hint */}
        {allDone && sets.length > 0 && (() => {
          const lastSet = sets[sets.length - 1]
          const rpus = sets.filter(s => s.rpe !== null).map(s => s.rpe as number)
          const avgRpe = rpus.length ? rpus.reduce((a, b) => a + b, 0) / rpus.length : null
          const canIncrease = lastSet.reps >= maxTarget && avgRpe !== null && avgRpe <= 8

          return (
            <div className={`card px-4 py-3 text-sm ${
              canIncrease
                ? 'border-green-800 text-green-400'
                : 'border-gray-800 text-gray-500'
            }`}>
              {canIncrease
                ? `✅ Đủ điều kiện tăng tạ buổi sau! (${lastSet.weight_kg}kg → ${lastSet.weight_kg + 0.5}kg)`
                : `Giữ tạ ${lastSet.weight_kg}kg, tiếp tục hoàn thiện form`
              }
            </div>
          )
        })()}
      </div>

      {/* Bottom nav: bài trước / bài sau */}
      <div className="sticky bottom-0 border-t border-gray-900 bg-gray-950 px-4 py-3
                      flex items-center gap-3">
        <button
          onClick={() => setExIdx(i => Math.max(0, i - 1))}
          disabled={exIdx === 0}
          className="btn-ghost w-12 flex items-center justify-center"
          aria-label="Bài trước"
        >
          ←
        </button>

        {exIdx < exercises.length - 1 ? (
          <button
            onClick={() => setExIdx(i => i + 1)}
            className="flex-1 btn-primary py-3"
          >
            Bài tiếp: {exercises[exIdx + 1]?.name}
          </button>
        ) : (
          <button onClick={finishWorkout} className="flex-1 btn-primary py-3">
            Hoàn thành buổi tập 🎉
          </button>
        )}
      </div>
    </div>
  )
}
