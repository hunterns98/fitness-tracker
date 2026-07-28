'use client'
import { useEffect, useState } from 'react'

type PickerExercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  archived_at?: string | null
}

const GROUPS = ['Ngực', 'Lưng', 'Vai', 'Vai sau', 'Tay trước', 'Tay sau', 'Cẳng tay', 'Chân', 'Core']

// ExercisePicker — chỉ làm UI + client-side search/filter (đã khóa ở UX Design).
// Không chứa business logic tạo session_exercises — cha (Workout Editor) tự quyết định
// gọi POST /api/session-exercises trong onSelect.
export function ExercisePicker({
  allowArchived = false,
  allowSearch = true,
  allowFilter = true,
  excludeIds = [],
  onSelect,
}: {
  allowArchived?: boolean
  allowSearch?: boolean
  allowFilter?: boolean
  excludeIds?: string[]
  onSelect: (exercise: PickerExercise) => void
}) {
  const [all, setAll] = useState<PickerExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/exercises')
      .then(r => r.json())
      .then(data => { setAll(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = all.filter(ex => {
    if (!allowArchived && ex.archived_at) return false
    if (excludeIds.includes(ex.id)) return false
    if (group && ex.muscle_group !== group) return false
    if (allowSearch && query.trim() && !ex.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-3">
      {allowSearch && (
        <input
          className="input"
          placeholder="🔍 Tìm bài tập..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      )}

      {allowFilter && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setGroup(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: group === null ? 'var(--brand)' : 'var(--surface-2)',
              color: group === null ? 'white' : 'var(--text-2)',
              border: `1px solid ${group === null ? 'var(--brand)' : 'var(--border)'}`,
            }}>
            Tất cả
          </button>
          {GROUPS.map(g => (
            <button key={g} onClick={() => setGroup(gr => gr === g ? null : g)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: group === g ? 'var(--brand)' : 'var(--surface-2)',
                color: group === g ? 'white' : 'var(--text-2)',
                border: `1px solid ${group === g ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
        {loading && <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Đang tải...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>Không tìm thấy bài tập nào</p>
        )}
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => onSelect(ex)}
            className="w-full px-4 py-3 rounded-xl flex items-center justify-between text-left transition-all"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
            </div>
            <span className="text-lg shrink-0 ml-2" style={{ color: 'var(--brand)' }}>+</span>
          </button>
        ))}
      </div>
    </div>
  )
}
