'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  technique_cue: string | null
  difficulty: string | null
  archived_at: string | null
}

export default function ExercisesPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    setLoading(true)
    const status = showArchived ? 'all' : 'active'
    fetch(`/api/exercises?status=${status}`)
      .then(r => r.json())
      .then((data: Exercise[]) => { setExercises(Array.isArray(data) ? data : []); setLoading(false) })
  }, [showArchived])

  // Filter chip derive trực tiếp từ dữ liệu DB, không hardcode
  const groups = useMemo(() => {
    const set = new Set(exercises.map(e => e.muscle_group).filter(Boolean))
    return Array.from(set).sort()
  }, [exercises])

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      if (filter && e.muscle_group !== filter) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscle_group.toLowerCase().includes(q) ||
        (e.technique_cue ?? '').toLowerCase().includes(q)
      )
    })
  }, [exercises, search, filter])

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <h1 className="font-bold" style={{ color: 'var(--text)' }}>Bài tập</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <input
          className="input"
          placeholder="Tìm theo tên, nhóm cơ, kỹ thuật..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilter(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: filter === null ? 'var(--brand)' : 'var(--surface)', color: filter === null ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
            Tất cả
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setFilter(f => f === g ? null : g)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === g ? 'var(--brand)' : 'var(--surface)', color: filter === g ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
              {g}
            </button>
          ))}
        </div>

        {/* Toggle archived */}
        <button onClick={() => setShowArchived(s => !s)}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          <span>{showArchived ? '☑' : '☐'}</span>
          Hiện đã lưu trữ
        </button>

        {/* List */}
        {loading && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>Đang tải...</p>}

        {!loading && displayed.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Không tìm thấy bài tập nào.</p>
          </div>
        )}

        <div className="space-y-2">
          {displayed.map(ex => {
            const isArchived = !!ex.archived_at
            return (
              <button key={ex.id}
                onClick={() => router.push(`/exercises/${ex.id}`)}
                className="card w-full p-4 flex items-center justify-between text-left transition-all"
                style={{ opacity: isArchived ? 0.5 : 1 }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
                    {isArchived && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                        Đã lưu trữ
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.difficulty && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
                      {ex.difficulty}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-3)' }}>›</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
