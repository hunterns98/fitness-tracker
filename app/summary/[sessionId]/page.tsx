'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatDuration, shouldIncreaseWeight } from '@/lib/utils'

type Session = {
  id: string; date: string; type: string; duration_seconds: number | null
  distance_km: number | null; avg_pace_seconds: number | null
  avg_hr: number | null; max_hr: number | null; calories: number | null
  feeling_note: string | null; name_override: string | null
}

type SetRow = {
  id: string; exercise_id: string; set_number: number
  reps: number; weight_kg: number; rpe: number | null; note: string | null
  exercise: { name: string; target_reps: string | null; current_weight_kg: number | null }
}

type ExGroup = { exercise_id: string; name: string; sets: SetRow[]; target_reps: string | null }

type EditingSet = { reps: number; weight_kg: number; rpe: number | null; note: string }

function Stepper({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div className="flex-1">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <button className="step-btn !w-8 !h-8 text-base" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}>−</button>
        <span className="flex-1 text-center font-semibold tabular-nums text-sm">{value}</span>
        <button className="step-btn !w-8 !h-8 text-base" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}>+</button>
      </div>
    </div>
  )
}

export default function SummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [groups, setGroups] = useState<ExGroup[]>([])
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditingSet>({ reps: 0, weight_kg: 0, rpe: null, note: '' })
  const [deleting, setDeleting] = useState(false)

  async function deleteSession() {
    if (!confirm('Xoá buổi tập này?')) return
    setDeleting(true)
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    router.push('/')
  }
  // Chỉnh sửa buổi chạy
  const [editingRun, setEditingRun] = useState(false)
  const [runForm, setRunForm] = useState({ hours: 0, minutes: 0, seconds: 0, distance: 0, avg_hr: 0, max_hr: 0, calories: 0 })

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(({ session: s, sets }) => {
        setSession(s)
        setNote(s.feeling_note ?? '')
        if (s.type === 'run' && s.duration_seconds) {
          const h = Math.floor(s.duration_seconds / 3600)
          const m = Math.floor((s.duration_seconds % 3600) / 60)
          const sec = s.duration_seconds % 60
          setRunForm({ hours: h, minutes: m, seconds: sec, distance: s.distance_km ?? 0, avg_hr: s.avg_hr ?? 0, max_hr: s.max_hr ?? 0, calories: s.calories ?? 0 })
        }
        const byEx: Record<string, ExGroup> = {}
        for (const row of (sets as SetRow[])) {
          if (!byEx[row.exercise_id]) byEx[row.exercise_id] = { exercise_id: row.exercise_id, name: row.exercise?.name ?? '—', sets: [], target_reps: row.exercise?.target_reps ?? null }
          byEx[row.exercise_id].sets.push(row)
        }
        setGroups(Object.values(byEx))
        setLoading(false)
      })
  }, [sessionId])

  async function saveNote() {
    await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feeling_note: note }) })
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2000)
  }

  async function startEditSet(set: SetRow) {
    setEditingSetId(set.id)
    setEditValues({ reps: set.reps, weight_kg: set.weight_kg, rpe: set.rpe, note: set.note ?? '' })
  }

  async function saveEditSet(set: SetRow, groupIdx: number) {
    setSavingSet(true)
    // Delete old, insert new
    await fetch(`/api/sets?id=${set.id}`, { method: 'DELETE' })
    const res = await fetch('/api/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, exercise_id: set.exercise_id, set_number: set.set_number, reps: editValues.reps, weight_kg: editValues.weight_kg, rpe: editValues.rpe, note: editValues.note || null }),
    })
    const updated = await res.json()
    setGroups(prev => prev.map((g, gi) => gi !== groupIdx ? g : {
      ...g, sets: g.sets.map(s => s.id === set.id ? { ...s, ...updated } : s)
    }))
    setEditingSetId(null)
    setSavingSet(false)
  }

  async function saveRunEdit() {
    const duration = runForm.hours * 3600 + runForm.minutes * 60 + runForm.seconds
    const pace = runForm.distance > 0 ? Math.round(duration / runForm.distance) : null
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: duration, distance_km: runForm.distance, avg_pace_seconds: pace, avg_hr: runForm.avg_hr, max_hr: runForm.max_hr, calories: runForm.calories }),
    })
    setSession(prev => prev ? { ...prev, duration_seconds: duration, distance_km: runForm.distance, avg_pace_seconds: pace, avg_hr: runForm.avg_hr, max_hr: runForm.max_hr, calories: runForm.calories } : prev)
    setEditingRun(false)
  }

  function paceLabel(secs: number | null) {
    if (!secs) return '—'
    const m = Math.floor(secs / 60), s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')} /km`
  }
  function parseMaxReps(t: string | null) { const m = t?.match(/\d+/g); return m ? parseInt(m[m.length - 1]) : 12 }

  if (loading) return <div className="flex items-center justify-center h-screen"><p className="text-gray-500 text-sm">Đang tải...</p></div>
  if (!session) return null

  const isRun = session.type === 'run'
  const sessionName = session.name_override ?? (session as any).workout_templates?.name ?? '—'

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold">{sessionName}</h1>
          <span className="text-xs text-gray-600">{formatDate(session.date)}</span>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
          {session.duration_seconds ? <StatChip label="Thời gian" value={formatDuration(session.duration_seconds)} /> : null}
          {session.calories ? <StatChip label="Calo" value={`${session.calories} kcal`} /> : null}
          {isRun && session.distance_km ? <StatChip label="Quãng đường" value={`${session.distance_km} km`} /> : null}
          {isRun && session.avg_pace_seconds ? <StatChip label="Pace TB" value={paceLabel(session.avg_pace_seconds)} /> : null}
          {session.avg_hr ? <StatChip label="HR TB" value={`${session.avg_hr} bpm`} /> : null}
          {session.max_hr ? <StatChip label="HR max" value={`${session.max_hr} bpm`} /> : null}
        </div>
      </div>

      {/* Edit buổi chạy */}
      {isRun && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Số liệu chạy</p>
            <button onClick={() => setEditingRun(e => !e)} className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-lg">
              {editingRun ? 'Huỷ' : 'Sửa'}
            </button>
          </div>
          {editingRun && (
            <div className="card p-4 space-y-4">
              <div className="flex gap-2">
                <Stepper label="Giờ" value={runForm.hours} onChange={v => setRunForm(f => ({ ...f, hours: v }))} />
                <Stepper label="Phút" value={runForm.minutes} onChange={v => setRunForm(f => ({ ...f, minutes: v }))} />
                <Stepper label="Giây" value={runForm.seconds} step={5} onChange={v => setRunForm(f => ({ ...f, seconds: v }))} />
              </div>
              <div className="flex gap-2">
                <Stepper label="km" value={runForm.distance} step={0.1} onChange={v => setRunForm(f => ({ ...f, distance: Math.round(v * 10) / 10 }))} />
                <Stepper label="HR TB" value={runForm.avg_hr} onChange={v => setRunForm(f => ({ ...f, avg_hr: v }))} />
                <Stepper label="HR max" value={runForm.max_hr} onChange={v => setRunForm(f => ({ ...f, max_hr: v }))} />
              </div>
              <button onClick={saveRunEdit} className="btn-primary py-2.5 text-sm">Lưu</button>
            </div>
          )}
        </section>
      )}

      {/* Kết quả kháng lực */}
      {!isRun && groups.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Kết quả từng bài</p>
          {groups.map((g, gi) => {
            const maxReps = parseMaxReps(g.target_reps)
            const canUp = shouldIncreaseWeight(g.sets, maxReps)
            return (
              <div key={g.exercise_id} className="card p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-gray-100">{g.name}</p>
                  {canUp && <span className="text-xs badge-done ml-2 shrink-0">Tăng tạ →</span>}
                </div>
                <div className="space-y-1.5">
                  {g.sets.map(s => {
                    const isEditingThis = editingSetId === s.id
                    return (
                      <div key={s.id}>
                        {!isEditingThis ? (
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="w-10 text-gray-600">Set {s.set_number}</span>
                            <span className="font-medium text-gray-300">{s.weight_kg}kg × {s.reps}</span>
                            {s.rpe && <span className="text-gray-600">RPE {s.rpe}</span>}
                            {s.note && <span className="text-gray-600 truncate">{s.note}</span>}
                            <button onClick={() => startEditSet(s)} className="ml-auto text-gray-700 border border-gray-800 px-1.5 py-0.5 rounded text-xs">Sửa</button>
                          </div>
                        ) : (
                          <div className="bg-gray-800 rounded-xl p-3 space-y-2.5 mt-1">
                            <p className="text-xs text-sky-400 font-medium">Set {s.set_number} — đang sửa</p>
                            <div className="flex gap-2">
                              <Stepper label="Tạ (kg)" value={editValues.weight_kg} step={0.5} onChange={v => setEditValues(e => ({ ...e, weight_kg: v }))} />
                              <Stepper label="Reps" value={editValues.reps} min={1} onChange={v => setEditValues(e => ({ ...e, reps: v }))} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">RPE (bước 0.5)</p>
                              <div className="flex items-center gap-2">
                                <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); if (editValues.rpe !== null) setEditValues(ev => ({ ...ev, rpe: Math.max(6, Math.round(((ev.rpe ?? 7) - 0.5) * 10) / 10) })) }}>−</button>
                                <button className="flex-1 py-2 rounded-xl bg-gray-700 text-sm text-center"
                                  onPointerDown={e => { e.preventDefault(); setEditValues(ev => ({ ...ev, rpe: ev.rpe === null ? 7 : null })) }}>
                                  {editValues.rpe ?? <span className="text-gray-500">—</span>}
                                </button>
                                <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setEditValues(ev => ({ ...ev, rpe: Math.min(10, Math.round(((ev.rpe ?? 6.5) + 0.5) * 10) / 10) })) }}>+</button>
                              </div>
                            </div>
                            <input type="text" value={editValues.note} onChange={e => setEditValues(ev => ({ ...ev, note: e.target.value }))}
                              placeholder="Ghi chú..." className="w-full px-3 py-1.5 rounded-xl bg-gray-700 text-sm text-gray-300 outline-none" />
                            <div className="flex gap-2">
                              <button onClick={() => saveEditSet(s, gi)} disabled={savingSet} className="flex-1 btn-primary py-2 text-sm">{savingSet ? 'Đang lưu...' : 'Lưu'}</button>
                              <button onClick={() => setEditingSetId(null)} className="btn-ghost">Huỷ</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {g.sets.length > 0 && (() => {
                  const vol = g.sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
                  return <p className="text-xs text-gray-600">Volume: {Math.round(vol)} kg · {g.sets.length} sets</p>
                })()}
              </div>
            )
          })}
        </section>
      )}

      {/* Cảm giác */}
      <section className="card p-4 space-y-2">
        <p className="text-xs font-medium text-gray-500">Cảm giác / ghi chú</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote} rows={3}
          placeholder="Ghi lại cảm giác buổi tập..."
          className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700 outline-none resize-none" />
        {noteSaved && <p className="text-xs text-green-500">Đã lưu ✓</p>}
      </section>

      <div className="flex gap-3">
        <button onClick={() => router.push('/')} className="flex-1 btn-primary">Về trang chủ</button>
        <button onClick={() => router.push('/exercises')} className="btn-ghost">Bài tập</button>
        <button onClick={deleteSession} disabled={deleting}
          className="px-3 py-2.5 rounded-xl border border-red-900 text-red-500 text-sm active:bg-red-950 transition-colors">
          🗑
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
