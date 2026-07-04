'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const RUN_TYPES = [
  { value: 'recovery', label: '🟣 Recovery' },
  { value: 'easy', label: '🟢 Easy Run' },
  { value: 'long', label: '🔵 Long Run' },
  { value: 'tempo', label: '🟡 Tempo' },
  { value: 'interval', label: '🔴 Interval' },
  { value: 'threshold', label: '🟠 Threshold' },
  { value: 'race', label: '🏆 Race' },
  { value: 'trail', label: '🌲 Trail' },
  { value: 'other', label: '⚪ Other' },
]

function Stepper({ label, value, onChange, step = 1, min = 0, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 10) / 10)) }}>−</button>
        <span className="flex-1 text-center font-bold text-xl tabular-nums" style={{ color: 'var(--text)' }}>{value}{unit}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 10) / 10) }}>+</button>
      </div>
    </div>
  )
}

export default function RunWorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [runType, setRunType] = useState('easy')
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [form, setForm] = useState({ hours: 0, minutes: 50, seconds: 0, distance: 7.0, avg_hr: 140, max_hr: 165, calories: 450, feeling_note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`).then(r => r.json()).then(({ session }) => {
      if (session.duration_seconds) {
        const h = Math.floor(session.duration_seconds / 3600)
        const m = Math.floor((session.duration_seconds % 3600) / 60)
        const s = session.duration_seconds % 60
        setForm(f => ({ ...f, hours: h, minutes: m, seconds: s, distance: session.distance_km ?? f.distance, avg_hr: session.avg_hr ?? f.avg_hr, max_hr: session.max_hr ?? f.max_hr, calories: session.calories ?? f.calories, feeling_note: session.feeling_note ?? '' }))
      }
      if (session.name_override) {
        const match = RUN_TYPES.find(rt => session.name_override?.toLowerCase().includes(rt.value))
        if (match) setRunType(match.value)
      }
    })
  }, [sessionId])

  const paceDisplay = (() => {
    const secs = form.hours * 3600 + form.minutes * 60 + form.seconds
    if (!secs || !form.distance) return null
    const pace = Math.round(secs / form.distance)
    return `${Math.floor(pace / 60)}:${(pace % 60).toString().padStart(2, '0')} /km`
  })()

  async function save() {
    setSaving(true); setError('')
    const duration = form.hours * 3600 + form.minutes * 60 + form.seconds
    const pace = form.distance > 0 ? Math.round(duration / form.distance) : null
    const runLabel = RUN_TYPES.find(r => r.value === runType)?.label.replace(/.*? /, '') ?? 'Chạy bộ'
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: duration, distance_km: form.distance, avg_pace_seconds: pace, avg_hr: form.avg_hr, max_hr: form.max_hr, calories: form.calories, feeling_note: form.feeling_note || null, name_override: runLabel }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Lưu thất bại'); setSaving(false); return }
      router.push(`/summary/${sessionId}`)
    } catch { setError('Lỗi kết nối'); setSaving(false) }
  }

  const currentType = RUN_TYPES.find(r => r.value === runType)

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <div>
          <p className="font-bold" style={{ color: 'var(--text)' }}>🏃 Chạy bộ</p>
          <button onClick={() => setShowTypeSelector(true)}
            className="text-xs font-medium" style={{ color: 'var(--brand)' }}>
            {currentType?.label} ›
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 fade-in">
        {/* Run type card */}
        <button onClick={() => setShowTypeSelector(true)}
          className="card w-full p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>Loại chạy</p>
            <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{currentType?.label}</p>
          </div>
          <span className="text-2xl" style={{ color: 'var(--brand)' }}>›</span>
        </button>

        {/* Time */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>THỜI GIAN</p>
          <div className="flex gap-3">
            <Stepper label="Giờ" value={form.hours} onChange={v => setForm(f => ({ ...f, hours: v }))} />
            <Stepper label="Phút" value={form.minutes} onChange={v => setForm(f => ({ ...f, minutes: v }))} />
            <Stepper label="Giây" value={form.seconds} step={5} onChange={v => setForm(f => ({ ...f, seconds: v }))} />
          </div>
        </div>

        {/* Distance + pace */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>QUÃNG ĐƯỜNG</p>
          <Stepper label="km" value={form.distance} step={0.1} onChange={v => setForm(f => ({ ...f, distance: Math.round(v * 10) / 10 }))} />
          {paceDisplay && (
            <div className="mt-3 px-3 py-2 rounded-xl text-center"
              style={{ background: 'var(--brand-light)' }}>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Pace tự tính</p>
              <p className="font-bold text-lg" style={{ color: 'var(--brand-dark)' }}>{paceDisplay}</p>
            </div>
          )}
        </div>

        {/* HR */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>NHỊP TIM</p>
          <div className="flex gap-3">
            <Stepper label="HR trung bình" value={form.avg_hr} onChange={v => setForm(f => ({ ...f, avg_hr: v }))} />
            <Stepper label="HR tối đa" value={form.max_hr} onChange={v => setForm(f => ({ ...f, max_hr: v }))} />
          </div>
        </div>

        {/* Calories */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>CALORIES</p>
          <Stepper label="kcal" value={form.calories} step={10} onChange={v => setForm(f => ({ ...f, calories: v }))} />
        </div>

        {/* Note */}
        <div className="card p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>CẢM GIÁC</p>
          <textarea value={form.feeling_note} onChange={e => setForm(f => ({ ...f, feeling_note: e.target.value }))}
            rows={2} placeholder="Cảm giác chạy hôm nay..."
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
        </div>

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Đang lưu...' : 'Lưu buổi chạy ✓'}
        </button>
      </div>

      {/* Run type bottom sheet */}
      {showTypeSelector && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTypeSelector(false) }}>
          <div className="slide-up rounded-t-3xl p-5 space-y-3" style={{ background: 'var(--surface)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-2" style={{ background: 'var(--border-strong)' }} />
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>Chọn loại chạy</p>
            <div className="space-y-1.5">
              {RUN_TYPES.map(rt => (
                <button key={rt.value}
                  onClick={() => { setRunType(rt.value); setShowTypeSelector(false) }}
                  className="w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all"
                  style={{
                    background: runType === rt.value ? 'var(--brand-light)' : 'var(--surface-2)',
                    color: runType === rt.value ? 'var(--brand-dark)' : 'var(--text)',
                    border: `1.5px solid ${runType === rt.value ? 'var(--brand)' : 'var(--border)'}`,
                  }}>
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
