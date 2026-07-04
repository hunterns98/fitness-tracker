'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

function Stepper({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div className="flex-1">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, value - step)) }}>−</button>
        <span className="flex-1 text-center font-bold text-xl tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(value + step) }}>+</button>
      </div>
    </div>
  )
}

export default function OtherWorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [name, setName] = useState('Other Workout')
  const [form, setForm] = useState({ hours: 0, minutes: 45, seconds: 0, avg_hr: 130, max_hr: 160, calories: 300, feeling_note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`).then(r => r.json()).then(({ session }) => {
      if (session.name_override) setName(session.name_override)
      if (session.duration_seconds) {
        const h = Math.floor(session.duration_seconds / 3600)
        const m = Math.floor((session.duration_seconds % 3600) / 60)
        const s = session.duration_seconds % 60
        setForm(f => ({ ...f, hours: h, minutes: m, seconds: s, avg_hr: session.avg_hr ?? f.avg_hr, max_hr: session.max_hr ?? f.max_hr, calories: session.calories ?? f.calories, feeling_note: session.feeling_note ?? '' }))
      }
    })
  }, [sessionId])

  async function save() {
    setSaving(true); setError('')
    const duration = form.hours * 3600 + form.minutes * 60 + form.seconds
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: duration, avg_hr: form.avg_hr, max_hr: form.max_hr, calories: form.calories, feeling_note: form.feeling_note || null, name_override: name }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Lưu thất bại'); setSaving(false); return }
      router.push(`/summary/${sessionId}`)
    } catch { setError('Lỗi kết nối'); setSaving(false) }
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <p className="font-bold" style={{ color: 'var(--text)' }}>⭐ {name}</p>
      </div>

      <div className="px-4 pt-4 space-y-3 fade-in">
        <div className="card p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>TÊN HOẠT ĐỘNG</p>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Tên hoạt động..." />
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>THỜI GIAN</p>
          <div className="flex gap-3">
            <Stepper label="Giờ" value={form.hours} onChange={v => setForm(f => ({ ...f, hours: v }))} />
            <Stepper label="Phút" value={form.minutes} onChange={v => setForm(f => ({ ...f, minutes: v }))} />
            <Stepper label="Giây" value={form.seconds} step={5} onChange={v => setForm(f => ({ ...f, seconds: v }))} />
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>NHỊP TIM</p>
          <div className="flex gap-3">
            <Stepper label="HR trung bình" value={form.avg_hr} onChange={v => setForm(f => ({ ...f, avg_hr: v }))} />
            <Stepper label="HR tối đa" value={form.max_hr} onChange={v => setForm(f => ({ ...f, max_hr: v }))} />
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>CALORIES</p>
          <Stepper label="kcal" value={form.calories} step={10} onChange={v => setForm(f => ({ ...f, calories: v }))} />
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>CẢM GIÁC</p>
          <textarea value={form.feeling_note} onChange={e => setForm(f => ({ ...f, feeling_note: e.target.value }))} rows={2}
            placeholder="Cảm giác hôm nay..." className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
        </div>

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu hoạt động ✓'}</button>
      </div>
    </div>
  )
}
