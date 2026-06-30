'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string; name: string; muscle_group: string
  current_weight_kg: number | null; target_reps: string | null
  target_sets: number | null; technique_cue: string | null
}

const GROUPS = ['Ngực', 'Lưng', 'Vai', 'Vai sau', 'Tay trước', 'Tay sau', 'Cẳng tay', 'Chân', 'Core']

export default function ExercisesPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Exercise>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(setExercises)
  }, [])

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editValues),
    })
    const updated = await res.json()
    setExercises(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))
    setEditing(null)
    setSaving(false)
  }

  const displayed = filter ? exercises.filter(e => e.muscle_group === filter) : exercises

  return (
    <div className="px-4 pt-6 pb-20 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cơ sở dữ liệu bài tập</h1>
        <button onClick={() => router.push('/')} className="text-sm text-gray-500">← Trang chủ</button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === null ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          Tất cả
        </button>
        {GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setFilter(f => f === g ? null : g)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === g ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
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
              {/* Name + group */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-100">{ex.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{ex.muscle_group}</p>
                </div>
                <button
                  onClick={() => {
                    if (isEditing) {
                      setEditing(null)
                    } else {
                      setEditing(ex.id)
                      setEditValues({
                        current_weight_kg: ex.current_weight_kg,
                        target_reps: ex.target_reps,
                        target_sets: ex.target_sets,
                        technique_cue: ex.technique_cue,
                      })
                    }
                  }}
                  className="text-xs text-gray-500 px-2 py-1 rounded-lg border border-gray-800"
                >
                  {isEditing ? 'Huỷ' : 'Sửa'}
                </button>
              </div>

              {/* View mode */}
              {!isEditing && (
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>Tạ: {ex.current_weight_kg ?? '—'} kg</span>
                  <span>Reps: {ex.target_reps ?? '—'}</span>
                  <span>Sets: {ex.target_sets ?? '—'}</span>
                </div>
              )}
              {!isEditing && ex.technique_cue && (
                <p className="text-xs text-sky-700 leading-relaxed">{ex.technique_cue}</p>
              )}

              {/* Edit mode */}
              {isEditing && (
                <div className="space-y-3 pt-1">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Tạ (kg)</p>
                      <input
                        type="number"
                        step="0.5"
                        value={editValues.current_weight_kg ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, current_weight_kg: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0
                                   text-sm text-gray-200 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Rep mục tiêu</p>
                      <input
                        type="text"
                        value={editValues.target_reps ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, target_reps: e.target.value }))}
                        placeholder="vd: 8-12"
                        className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0
                                   text-sm text-gray-200 outline-none"
                      />
                    </div>
                    <div className="w-16">
                      <p className="text-xs text-gray-500 mb-1">Sets</p>
                      <input
                        type="number"
                        value={editValues.target_sets ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, target_sets: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0
                                   text-sm text-gray-200 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cue kỹ thuật</p>
                    <textarea
                      value={editValues.technique_cue ?? ''}
                      onChange={e => setEditValues(v => ({ ...v, technique_cue: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border-0
                                 text-sm text-gray-200 outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={() => saveEdit(ex.id)}
                    disabled={saving}
                    className="btn-primary py-2.5 text-sm"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
