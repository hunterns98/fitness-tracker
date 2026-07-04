'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = { id: string; name: string; muscle_group: string; current_weight_kg: number | null; target_reps: string | null; target_sets: number | null; technique_cue: string | null }
const GROUPS = ['Ngực', 'Lưng', 'Vai', 'Vai sau', 'Tay trước', 'Tay sau', 'Cẳng tay', 'Chân', 'Core']

export default function ExercisesPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Exercise>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch('/api/exercises').then(r => r.json()).then(setExercises) }, [])

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/exercises/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editValues) })
    const updated = await res.json()
    setExercises(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))
    setEditing(null); setSaving(false)
  }

  const displayed = filter ? exercises.filter(e => e.muscle_group === filter) : exercises

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <h1 className="font-bold" style={{ color: 'var(--text)' }}>Bài tập</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilter(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: filter === null ? 'var(--brand)' : 'var(--surface)', color: filter === null ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
            Tất cả
          </button>
          {GROUPS.map(g => (
            <button key={g} onClick={() => setFilter(f => f === g ? null : g)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === g ? 'var(--brand)' : 'var(--surface)', color: filter === g ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
              {g}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="space-y-2">
          {displayed.map(ex => {
            const isEditing = editing === ex.id
            return (
              <div key={ex.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{ex.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
                  </div>
                  <button onClick={() => { if (isEditing) setEditing(null); else { setEditing(ex.id); setEditValues({ current_weight_kg: ex.current_weight_kg, target_reps: ex.target_reps, target_sets: ex.target_sets, technique_cue: ex.technique_cue }) } }}
                    className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
                    {isEditing ? 'Huỷ' : 'Sửa'}
                  </button>
                </div>

                {!isEditing && (
                  <>
                    <div className="flex gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                      <span>Tạ: <strong style={{ color: 'var(--text)' }}>{ex.current_weight_kg ?? '—'} kg</strong></span>
                      <span>Reps: <strong style={{ color: 'var(--text)' }}>{ex.target_reps ?? '—'}</strong></span>
                      <span>Sets: <strong style={{ color: 'var(--text)' }}>{ex.target_sets ?? '—'}</strong></span>
                    </div>
                    {ex.technique_cue && <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-dark)' }}>{ex.technique_cue}</p>}
                  </>
                )}

                {isEditing && (
                  <div className="space-y-3 pt-1">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Tạ (kg)</p>
                        <input type="number" step="0.5" value={editValues.current_weight_kg ?? ''} className="input"
                          onChange={e => setEditValues(v => ({ ...v, current_weight_kg: parseFloat(e.target.value) }))} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Rep mục tiêu</p>
                        <input type="text" value={editValues.target_reps ?? ''} placeholder="vd: 8-12" className="input"
                          onChange={e => setEditValues(v => ({ ...v, target_reps: e.target.value }))} />
                      </div>
                      <div className="w-16">
                        <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Sets</p>
                        <input type="number" value={editValues.target_sets ?? ''} className="input"
                          onChange={e => setEditValues(v => ({ ...v, target_sets: parseInt(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Cue kỹ thuật</p>
                      <textarea value={editValues.technique_cue ?? ''} rows={2} className="input"
                        style={{ resize: 'none', height: 'auto' }}
                        onChange={e => setEditValues(v => ({ ...v, technique_cue: e.target.value }))} />
                    </div>
                    <button onClick={() => saveEdit(ex.id)} disabled={saving} className="btn-primary py-2.5 text-sm">
                      {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
