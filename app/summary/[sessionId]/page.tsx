'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { shouldIncreaseWeight } from '@/lib/utils'

type Session = {
  id: string; date: string; type: string; duration_seconds: number | null
  distance_km: number | null; avg_pace_seconds: number | null
  avg_hr: number | null; max_hr: number | null; calories: number | null
  feeling_note: string | null; name_override: string | null
  workout_templates?: { name: string } | null
}
type SetRow = { id: string; exercise_id: string; set_number: number; reps: number; weight_kg: number; rpe: number | null; note: string | null; exercise: { name: string; target_reps: string | null } }
type ExGroup = { exercise_id: string; name: string; sets: SetRow[]; target_reps: string | null }
type EditSet = { reps: number; weight_kg: number; rpe: number | null; note: string }

function Stepper({ label, value, onChange, step = 1, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <div className="flex-1">
      <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-1.5">
        <button className="step-btn !w-8 !h-8 text-base" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}>−</button>
        <span className="flex-1 text-center font-semibold tabular-nums text-sm" style={{ color: 'var(--text)' }}>{value}</span>
        <button className="step-btn !w-8 !h-8 text-base" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}>+</button>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 card-sm px-3 py-2.5 text-center min-w-[76px]">
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text)' }}>{value}</p>
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
  const [deleting, setDeleting] = useState(false)
  const [savingSet, setSavingSet] = useState(false)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditSet>({ reps: 0, weight_kg: 0, rpe: null, note: '' })
  const [editingRun, setEditingRun] = useState(false)
  const [runForm, setRunForm] = useState({ hours: 0, minutes: 0, seconds: 0, distance: 0, avg_hr: 0, max_hr: 0, calories: 0 })

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`).then(r => r.json()).then(({ session: s, sets }) => {
      setSession(s); setNote(s.feeling_note ?? '')
      if ((s.type === 'run' || s.type === 'other') && s.duration_seconds) {
        const h = Math.floor(s.duration_seconds / 3600), m = Math.floor((s.duration_seconds % 3600) / 60), sec = s.duration_seconds % 60
        setRunForm({ hours: h, minutes: m, seconds: sec, distance: s.distance_km ?? 0, avg_hr: s.avg_hr ?? 0, max_hr: s.max_hr ?? 0, calories: s.calories ?? 0 })
      }
      const byEx: Record<string, ExGroup> = {}
      for (const row of (sets as SetRow[])) {
        if (!byEx[row.exercise_id]) byEx[row.exercise_id] = { exercise_id: row.exercise_id, name: row.exercise?.name ?? '—', sets: [], target_reps: row.exercise?.target_reps ?? null }
        byEx[row.exercise_id].sets.push(row)
      }
      setGroups(Object.values(byEx)); setLoading(false)
    })
  }, [sessionId])

  async function saveNote() {
    await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feeling_note: note }) })
    setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2000)
  }
  async function deleteSession() {
    if (!confirm('Xoá buổi tập này?')) return
    setDeleting(true)
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    router.push('/')
  }
  function startEditSet(s: SetRow) { setEditingSetId(s.id); setEditValues({ reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, note: s.note ?? '' }) }
  async function saveEditSet(s: SetRow, gi: number) {
    setSavingSet(true)
    await fetch(`/api/sets?id=${s.id}`, { method: 'DELETE' })
    const res = await fetch('/api/sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, exercise_id: s.exercise_id, set_number: s.set_number, reps: editValues.reps, weight_kg: editValues.weight_kg, rpe: editValues.rpe, note: editValues.note || null }) })
    const updated = await res.json()
    setGroups(prev => prev.map((g, idx) => idx !== gi ? g : { ...g, sets: g.sets.map(row => row.id === s.id ? { ...row, ...updated } : row) }))
    setEditingSetId(null); setSavingSet(false)
  }
  async function saveRunEdit() {
    const duration = runForm.hours * 3600 + runForm.minutes * 60 + runForm.seconds
    const pace = runForm.distance > 0 ? Math.round(duration / runForm.distance) : null
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration_seconds: duration, distance_km: runForm.distance, avg_pace_seconds: pace, avg_hr: runForm.avg_hr, max_hr: runForm.max_hr, calories: runForm.calories }) })
    const updated = await res.json()
    setSession(prev => prev ? { ...prev, ...updated } : prev); setEditingRun(false)
  }

  function paceLabel(s: number | null) { if (!s) return '—'; const m = Math.floor(s / 60), sec = s % 60; return `${m}:${sec.toString().padStart(2,'0')} /km` }
  function durLabel(s: number | null) { if (!s) return '—'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}h${m}m` : `${m}m` }
  function parseMax(t: string | null) { const m = t?.match(/\d+/g); return m ? parseInt(m[m.length-1]) : 12 }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--text-3)' }}>Đang tải...</p></div>
  if (!session) return null

  const isRun = session.type === 'run'
  const isOther = session.type === 'other'
  const sessionName = session.name_override ?? session.workout_templates?.name ?? '—'
  const typeIcon = isRun ? '🏃' : isOther ? '⭐' : '💪'

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" style={{ color: 'var(--text)' }}>{typeIcon} {sessionName}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {new Date(session.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        {/* Stats row */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {session.duration_seconds ? <StatChip label="Thời gian" value={durLabel(session.duration_seconds)} /> : null}
          {session.calories ? <StatChip label="Calories" value={`${session.calories}`} /> : null}
          {(isRun || isOther) && session.distance_km ? <StatChip label="Quãng đường" value={`${session.distance_km}km`} /> : null}
          {isRun && session.avg_pace_seconds ? <StatChip label="Pace TB" value={paceLabel(session.avg_pace_seconds)} /> : null}
          {session.avg_hr ? <StatChip label="HR TB" value={`${session.avg_hr}`} /> : null}
          {session.max_hr ? <StatChip label="HR max" value={`${session.max_hr}`} /> : null}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 fade-in">
        {/* Edit run/other */}
        {(isRun || isOther) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label">Số liệu</p>
              <button onClick={() => setEditingRun(e => !e)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
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
                {isRun && <Stepper label="Quãng đường (km)" value={runForm.distance} step={0.1} onChange={v => setRunForm(f => ({ ...f, distance: Math.round(v*10)/10 }))} />}
                <div className="flex gap-2">
                  <Stepper label="HR TB" value={runForm.avg_hr} onChange={v => setRunForm(f => ({ ...f, avg_hr: v }))} />
                  <Stepper label="HR max" value={runForm.max_hr} onChange={v => setRunForm(f => ({ ...f, max_hr: v }))} />
                </div>
                <Stepper label="Calories" value={runForm.calories} step={10} onChange={v => setRunForm(f => ({ ...f, calories: v }))} />
                <button onClick={saveRunEdit} className="btn-primary py-2.5 text-sm">Lưu</button>
              </div>
            )}
          </div>
        )}

        {/* Strength sets */}
        {!isRun && !isOther && groups.length > 0 && (
          <div className="space-y-3">
            <p className="section-label">Kết quả từng bài</p>
            {groups.map((g, gi) => {
              const canUp = shouldIncreaseWeight(g.sets, parseMax(g.target_reps))
              return (
                <div key={g.exercise_id} className="card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{g.name}</p>
                    {canUp && <span className="badge-done shrink-0 ml-2">Tăng tạ →</span>}
                  </div>
                  <div className="space-y-2">
                    {g.sets.map(s => {
                      const isEditThis = editingSetId === s.id
                      return (
                        <div key={s.id}>
                          {!isEditThis ? (
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                              <span className="w-10" style={{ color: 'var(--text-3)' }}>Set {s.set_number}</span>
                              <span className="font-semibold" style={{ color: 'var(--text)' }}>{s.weight_kg}kg × {s.reps}</span>
                              {s.rpe != null && <span style={{ color: 'var(--text-3)' }}>RPE {s.rpe}</span>}
                              {s.note && <span className="truncate" style={{ color: 'var(--text-3)' }}>{s.note}</span>}
                              <button onClick={() => startEditSet(s)} className="ml-auto px-2 py-0.5 rounded-lg text-xs"
                                style={{ border: '1px solid var(--border)', color: 'var(--text-3)' }}>Sửa</button>
                            </div>
                          ) : (
                            <div className="rounded-xl p-3 space-y-2.5 mt-1" style={{ background: 'var(--brand-light)' }}>
                              <p className="text-xs font-semibold" style={{ color: 'var(--brand-dark)' }}>Set {s.set_number} — đang sửa</p>
                              <div className="flex gap-2">
                                <Stepper label="Tạ (kg)" value={editValues.weight_kg} step={0.5} onChange={v => setEditValues(e => ({ ...e, weight_kg: v }))} />
                                <Stepper label="Reps" value={editValues.reps} min={1} onChange={v => setEditValues(e => ({ ...e, reps: v }))} />
                              </div>
                              <div>
                                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>RPE (bước 0.5)</p>
                                <div className="flex items-center gap-2">
                                  <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setEditValues(ev => ({ ...ev, rpe: Math.max(6, Math.round(((ev.rpe ?? 7) - 0.5)*10)/10) })) }}>−</button>
                                  <button className="flex-1 py-2 rounded-xl text-sm text-center font-medium" style={{ background: 'white', color: 'var(--text)' }}
                                    onPointerDown={e => { e.preventDefault(); setEditValues(ev => ({ ...ev, rpe: ev.rpe === null ? 7 : null })) }}>
                                    {editValues.rpe ?? '—'}
                                  </button>
                                  <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setEditValues(ev => ({ ...ev, rpe: Math.min(10, Math.round(((ev.rpe ?? 6.5)+0.5)*10)/10) })) }}>+</button>
                                </div>
                              </div>
                              <input value={editValues.note} onChange={e => setEditValues(ev => ({ ...ev, note: e.target.value }))}
                                placeholder="Ghi chú..." className="input" style={{ padding: '8px 12px', background: 'white' }} />
                              <div className="flex gap-2">
                                <button onClick={() => saveEditSet(s, gi)} disabled={savingSet} className="flex-1 btn-primary py-2 text-sm">{savingSet ? '...' : 'Lưu'}</button>
                                <button onClick={() => setEditingSetId(null)} className="btn-ghost">Huỷ</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {g.sets.length > 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      Volume: {Math.round(g.sets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0))} kg · {g.sets.length} sets
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Note */}
        <div className="card p-4 space-y-2">
          <p className="section-label">Cảm giác / ghi chú</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={saveNote} rows={3}
            placeholder="Ghi lại cảm giác buổi tập..."
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
          {noteSaved && <p className="text-xs" style={{ color: 'var(--success)' }}>Đã lưu ✓</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => router.push('/')} className="flex-1 btn-primary">Về trang chủ</button>
          <button onClick={() => router.push('/exercises')} className="btn-ghost">Bài tập</button>
          <button onClick={deleteSession} disabled={deleting}
            className="px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)', background: 'var(--surface)' }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
