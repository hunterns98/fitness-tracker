'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatDuration, shouldIncreaseWeight } from '@/lib/utils'

type Session = {
  id: string; date: string; type: string; duration_seconds: number | null
  distance_km: number | null; avg_pace_seconds: number | null
  avg_hr: number | null; max_hr: number | null; calories: number | null
  feeling_note: string | null; name_override: string | null
  workout_templates?: { name: string }
}

type SetRow = {
  exercise_id: string; set_number: number; reps: number
  weight_kg: number; rpe: number | null; note: string | null
  exercise: { name: string; target_reps: string | null; current_weight_kg: number | null }
}

type ExGroup = {
  exercise_id: string; name: string
  sets: SetRow[]
  target_reps: string | null
  current_weight_kg: number | null
}

export default function SummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [groups, setGroups] = useState<ExGroup[]>([])
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(({ session: s, sets }) => {
        setSession(s)
        setNote(s.feeling_note ?? '')

        // Group sets by exercise
        const byEx: Record<string, ExGroup> = {}
        for (const row of (sets as SetRow[])) {
          if (!byEx[row.exercise_id]) {
            byEx[row.exercise_id] = {
              exercise_id: row.exercise_id,
              name: row.exercise?.name ?? '—',
              sets: [],
              target_reps: row.exercise?.target_reps ?? null,
              current_weight_kg: row.exercise?.current_weight_kg ?? null,
            }
          }
          byEx[row.exercise_id].sets.push(row)
        }
        setGroups(Object.values(byEx))
        setLoading(false)
      })
  }, [sessionId])

  async function saveNote() {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feeling_note: note }),
    })
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  function paceLabel(secs: number | null) {
    if (!secs) return '—'
    const m = Math.floor(secs / 60), s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')} /km`
  }

  function parseMaxReps(target: string | null): number {
    if (!target) return 12
    const nums = target.match(/\d+/g)
    return nums ? parseInt(nums[nums.length - 1]) : 12
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500 text-sm">Đang tải...</p>
    </div>
  )

  if (!session) return null

  const isRun = session.type === 'run'
  const sessionName = session.name_override
    ?? (session as any).workout_templates?.name
    ?? 'Buổi tập'

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold">{sessionName}</h1>
          <span className="text-xs text-gray-600">{formatDate(session.date)}</span>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
          {session.duration_seconds ? (
            <StatChip label="Thời gian" value={formatDuration(session.duration_seconds)} />
          ) : null}
          {session.calories ? (
            <StatChip label="Calo" value={`${session.calories} kcal`} />
          ) : null}
          {isRun && session.distance_km ? (
            <StatChip label="Quãng đường" value={`${session.distance_km} km`} />
          ) : null}
          {isRun && session.avg_pace_seconds ? (
            <StatChip label="Pace TB" value={paceLabel(session.avg_pace_seconds)} />
          ) : null}
          {session.avg_hr ? (
            <StatChip label="HR TB" value={`${session.avg_hr} bpm`} />
          ) : null}
          {session.max_hr ? (
            <StatChip label="HR max" value={`${session.max_hr} bpm`} />
          ) : null}
        </div>
      </div>

      {/* Exercise performance (kháng lực) */}
      {!isRun && groups.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Kết quả từng bài
          </p>
          {groups.map(g => {
            const maxReps = parseMaxReps(g.target_reps)
            const canUp = shouldIncreaseWeight(g.sets, maxReps)

            return (
              <div key={g.exercise_id} className="card p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-gray-100">{g.name}</p>
                  {canUp && (
                    <span className="text-xs badge-done ml-2 shrink-0">
                      Tăng tạ →
                    </span>
                  )}
                </div>

                {/* Set summary */}
                <div className="space-y-1">
                  {g.sets.map(s => (
                    <div key={s.set_number} className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="w-10 text-gray-600">Set {s.set_number}</span>
                      <span className="font-medium text-gray-300">
                        {s.weight_kg}kg × {s.reps}
                      </span>
                      {s.rpe && (
                        <span className="text-gray-600">RPE {s.rpe}</span>
                      )}
                      {s.note && (
                        <span className="text-gray-600 truncate">{s.note}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Volume tổng */}
                {g.sets.length > 0 && (() => {
                  const vol = g.sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
                  return (
                    <p className="text-xs text-gray-600">
                      Volume: {Math.round(vol)} kg · {g.sets.length} sets
                    </p>
                  )
                })()}
              </div>
            )
          })}
        </section>
      )}

      {/* Cảm giác / ghi chú */}
      <section className="card p-4 space-y-2">
        <p className="text-xs font-medium text-gray-500">Cảm giác / ghi chú</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={saveNote}
          rows={3}
          placeholder="Ghi lại cảm giác buổi tập..."
          className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700
                     outline-none resize-none"
        />
        {noteSaved && <p className="text-xs text-green-500">Đã lưu ✓</p>}
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex-1 btn-primary"
        >
          Về trang chủ
        </button>
        <button
          onClick={() => router.push('/exercises')}
          className="btn-ghost"
        >
          Bài tập
        </button>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 card px-3 py-2 text-center min-w-[72px]">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-sm font-semibold text-gray-100 mt-0.5">{value}</p>
    </div>
  )
}
