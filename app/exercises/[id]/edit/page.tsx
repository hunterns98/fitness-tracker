'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Các danh sách này PHẢI khớp chính xác với CHECK constraint trong DB.
// Sai lệch dù 1 ký tự sẽ khiến PATCH bị Postgres từ chối.
const MUSCLE_GROUPS = ['Ngực', 'Lưng', 'Vai', 'Vai sau', 'Tay trước', 'Tay sau', 'Cẳng tay', 'Chân', 'Core']

const MUSCLE_GROUP_TAXONOMY = [
  'Ngực', 'Lưng', 'Vai', 'Vai sau', 'Tay trước', 'Tay sau', 'Cẳng tay',
  'Core', 'Lưng dưới', 'Mông', 'Đùi trước', 'Đùi sau', 'Đùi trong', 'Bắp chân',
]

const EQUIPMENT_TAXONOMY = [
  'Bodyweight', 'Dumbbell', 'Barbell', 'EZ Bar', 'Cable', 'Machine',
  'Smith Machine', 'Resistance Band', 'Kettlebell', 'Medicine Ball',
  'TRX', 'Bench', 'Pull-up Bar', 'Dip Bar', 'Box', 'Foam Roller',
]

const DIFFICULTY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced']

const MOVEMENT_PATTERN_OPTIONS = [
  'Push', 'Pull', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Rotation',
  'Anti-Extension', 'Anti-Rotation', 'Anti-Lateral Flexion',
]

type FormState = {
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_sets: number | null
  target_reps: string
  technique_cue: string
  common_mistakes: string
  notes: string
  difficulty: string | null
  movement_pattern: string | null
  secondary_muscle_groups: string[]
  stabilizer_muscle_groups: string[]
  equipment: string[]
}

function Stepper({ label, value, onChange, step = 1, min = 0, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}>−</button>
        <span className="flex-1 text-center font-bold text-lg tabular-nums" style={{ color: 'var(--text)' }}>{value}{unit}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}>+</button>
      </div>
    </div>
  )
}

function SingleSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string | null; onChange: (v: string | null) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(value === opt ? null : opt)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            style={{
              background: value === opt ? 'var(--brand)' : 'var(--surface-2)',
              color: value === opt ? 'white' : 'var(--text-2)',
              border: `1px solid ${value === opt ? 'var(--brand)' : 'var(--border)'}`,
            }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MultiSelect({ label, options, values, onChange }: {
  label: string; options: string[]; values: string[]; onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt])
  }
  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => toggle(opt)}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            style={{
              background: values.includes(opt) ? 'var(--brand-light)' : 'var(--surface-2)',
              color: values.includes(opt) ? 'var(--brand-dark)' : 'var(--text-2)',
              border: `1px solid ${values.includes(opt) ? 'var(--brand)' : 'var(--border)'}`,
            }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ExerciseEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/exercises/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name ?? '',
          muscle_group: data.muscle_group ?? '',
          current_weight_kg: data.current_weight_kg ?? 0,
          target_sets: data.target_sets ?? 3,
          target_reps: data.target_reps ?? '',
          technique_cue: data.technique_cue ?? '',
          common_mistakes: data.common_mistakes ?? '',
          notes: data.notes ?? '',
          difficulty: data.difficulty ?? null,
          movement_pattern: data.movement_pattern ?? null,
          secondary_muscle_groups: data.secondary_muscle_groups ?? [],
          stabilizer_muscle_groups: data.stabilizer_muscle_groups ?? [],
          equipment: data.equipment ?? [],
        })
        setLoading(false)
      })
      .catch(() => { setError('Không thể tải dữ liệu'); setLoading(false) })
  }, [id])

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          muscle_group: form.muscle_group,
          current_weight_kg: form.current_weight_kg,
          target_sets: form.target_sets,
          target_reps: form.target_reps || null,
          technique_cue: form.technique_cue || null,
          common_mistakes: form.common_mistakes || null,
          notes: form.notes || null,
          difficulty: form.difficulty,
          movement_pattern: form.movement_pattern,
          secondary_muscle_groups: form.secondary_muscle_groups.length ? form.secondary_muscle_groups : null,
          stabilizer_muscle_groups: form.stabilizer_muscle_groups.length ? form.stabilizer_muscle_groups : null,
          equipment: form.equipment.length ? form.equipment : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Lưu thất bại')
        setSaving(false)
        return
      }
      router.push(`/exercises/${id}`)
    } catch {
      setError('Lỗi kết nối')
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--text-3)' }}>Đang tải...</p></div>
  if (!form) return <div className="px-4 pt-6"><p style={{ color: 'var(--text-2)' }}>Không tìm thấy bài tập.</p></div>

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push(`/exercises/${id}`)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <p className="font-bold" style={{ color: 'var(--text)' }}>Sửa bài tập</p>
      </div>

      <div className="px-4 pt-4 space-y-4 fade-in">
        <div className="card p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>TÊN BÀI TẬP</p>
            <input className="input" value={form.name} onChange={e => setForm(f => f && { ...f, name: e.target.value })} />
          </div>
          <SingleSelect label="NHÓM CƠ CHÍNH" options={MUSCLE_GROUPS} value={form.muscle_group || null}
            onChange={v => setForm(f => f && { ...f, muscle_group: v ?? '' })} />
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex gap-3">
            <Stepper label="Tạ hiện tại (kg)" value={form.current_weight_kg ?? 0} step={0.5}
              onChange={v => setForm(f => f && { ...f, current_weight_kg: v })} />
            <Stepper label="Sets mục tiêu" value={form.target_sets ?? 3}
              onChange={v => setForm(f => f && { ...f, target_sets: v })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>REPS MỤC TIÊU</p>
            <input className="input" placeholder="vd: 8-12" value={form.target_reps}
              onChange={e => setForm(f => f && { ...f, target_reps: e.target.value })} />
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <SingleSelect label="ĐỘ KHÓ" options={DIFFICULTY_OPTIONS} value={form.difficulty}
            onChange={v => setForm(f => f && { ...f, difficulty: v })} />
          <SingleSelect label="MOVEMENT PATTERN" options={MOVEMENT_PATTERN_OPTIONS} value={form.movement_pattern}
            onChange={v => setForm(f => f && { ...f, movement_pattern: v })} />
        </div>

        <div className="card p-4 space-y-4">
          <MultiSelect label="CƠ PHỤ (SECONDARY)" options={MUSCLE_GROUP_TAXONOMY} values={form.secondary_muscle_groups}
            onChange={v => setForm(f => f && { ...f, secondary_muscle_groups: v })} />
          <MultiSelect label="CƠ ỔN ĐỊNH (STABILIZER)" options={MUSCLE_GROUP_TAXONOMY} values={form.stabilizer_muscle_groups}
            onChange={v => setForm(f => f && { ...f, stabilizer_muscle_groups: v })} />
          <MultiSelect label="DỤNG CỤ" options={EQUIPMENT_TAXONOMY} values={form.equipment}
            onChange={v => setForm(f => f && { ...f, equipment: v })} />
        </div>

        <div className="card p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>KỸ THUẬT</p>
            <textarea className="input" style={{ resize: 'none' }} rows={3} value={form.technique_cue}
              onChange={e => setForm(f => f && { ...f, technique_cue: e.target.value })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>LỖI THƯỜNG GẶP</p>
            <textarea className="input" style={{ resize: 'none' }} rows={2} value={form.common_mistakes}
              onChange={e => setForm(f => f && { ...f, common_mistakes: e.target.value })} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-3)' }}>GHI CHÚ</p>
            <textarea className="input" style={{ resize: 'none' }} rows={2} value={form.notes}
              onChange={e => setForm(f => f && { ...f, notes: e.target.value })} />
          </div>
        </div>

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  )
}
