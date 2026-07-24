'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  technique_cue: string | null
  notes: string | null
  archived_at: string | null
  secondary_muscle_groups: string[] | null
  stabilizer_muscle_groups: string[] | null
  equipment: string[] | null
  difficulty: string | null
  movement_pattern: string | null
  common_mistakes: string | null
}

function ChipRow({ label, values }: { label: string; values: string[] | null }) {
  if (!values || values.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map(v => (
          <span key={v} className="text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{value}</p>
    </div>
  )
}

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ex, setEx] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/exercises/${id}`)
      .then(r => r.json())
      .then(data => { setEx(data); setLoading(false) })
      .catch(() => { setError('Không thể tải dữ liệu'); setLoading(false) })
  }, [id])

  async function toggleArchive() {
    if (!ex) return
    setArchiving(true)
    setError('')
    const newValue = ex.archived_at ? null : new Date().toISOString()
    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived_at: newValue }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Lỗi khi lưu'); setArchiving(false); return }
      const updated = await res.json()
      setEx(updated)
    } catch {
      setError('Lỗi kết nối')
    }
    setArchiving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--text-3)' }}>Đang tải...</p></div>
  if (!ex) return <div className="px-4 pt-6 space-y-4"><p style={{ color: 'var(--text-2)' }}>Không tìm thấy bài tập.</p><button className="btn-primary" onClick={() => router.push('/exercises')}>Về danh sách</button></div>

  const isArchived = !!ex.archived_at

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/exercises')} className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>← Bài tập</button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
        </div>
        <button onClick={() => router.push(`/exercises/${id}/edit`)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
          Sửa
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 fade-in">
        {isArchived && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
            📦 Bài tập này đã được lưu trữ — không hiện trong Picker hoặc Library mặc định.
          </div>
        )}

        {/* Badges: difficulty + movement pattern */}
        {(ex.difficulty || ex.movement_pattern) && (
          <div className="flex gap-2 flex-wrap">
            {ex.difficulty && (
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
                {ex.difficulty}
              </span>
            )}
            {ex.movement_pattern && (
              <span className="text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {ex.movement_pattern}
              </span>
            )}
          </div>
        )}

        {/* Current working stats */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>SỐ LIỆU HIỆN TẠI</p>
          <div className="flex gap-4">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Tạ</p>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{ex.current_weight_kg ?? '—'} kg</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Sets</p>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{ex.target_sets ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Reps</p>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{ex.target_reps ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Muscle groups + equipment */}
        {(ex.secondary_muscle_groups?.length || ex.stabilizer_muscle_groups?.length || ex.equipment?.length) ? (
          <div className="card p-4 space-y-4">
            <ChipRow label="CƠ PHỤ (SECONDARY)" values={ex.secondary_muscle_groups} />
            <ChipRow label="CƠ ỔN ĐỊNH (STABILIZER)" values={ex.stabilizer_muscle_groups} />
            <ChipRow label="DỤNG CỤ" values={ex.equipment} />
          </div>
        ) : null}

        {/* Technique cue + common mistakes + notes */}
        {(ex.technique_cue || ex.common_mistakes || ex.notes) && (
          <div className="card p-4 space-y-4">
            <TextBlock label="KỸ THUẬT" value={ex.technique_cue} />
            <TextBlock label="LỖI THƯỜNG GẶP" value={ex.common_mistakes} />
            <TextBlock label="GHI CHÚ" value={ex.notes} />
          </div>
        )}

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button onClick={toggleArchive} disabled={archiving}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition-all"
          style={{
            background: isArchived ? 'var(--success-bg)' : 'var(--surface-2)',
            color: isArchived ? 'var(--success)' : 'var(--text-2)',
            border: `1px solid ${isArchived ? 'var(--success)' : 'var(--border)'}`,
          }}>
          {archiving ? 'Đang lưu...' : isArchived ? '↩ Bỏ lưu trữ' : '📦 Lưu trữ bài tập này'}
        </button>
      </div>
    </div>
  )
}
