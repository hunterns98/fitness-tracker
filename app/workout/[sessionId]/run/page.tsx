'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Session = {
  id: string
  template_id: string
  workout_templates?: { name: string; run_type: string; target_pace: string; target_hr_range: string }
}

export default function RunWorkoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [form, setForm] = useState({
    hours: 0, minutes: 50, seconds: 0,
    distance: 7.0,
    avg_hr: 140,
    max_hr: 165,
    calories: 450,
    feeling_note: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(d => setSession(d.session))
  }, [sessionId])

  function set(key: string, val: number | string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    setSaving(true)
    const duration = form.hours * 3600 + form.minutes * 60 + form.seconds
    const pace = form.distance > 0 ? Math.round(duration / form.distance) : null

    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration_seconds: duration,
        distance_km: form.distance,
        avg_pace_seconds: pace,
        avg_hr: form.avg_hr,
        max_hr: form.max_hr,
        calories: form.calories,
        feeling_note: form.feeling_note || null,
      }),
    })
    router.push(`/summary/${sessionId}`)
  }

  function NumField({ label, value, onChange, step = 1, unit = '' }: {
    label: string; value: number; onChange: (v: number) => void
    step?: number; unit?: string
  }) {
    return (
      <div className="flex-1">
        <p className="text-xs text-gray-500 mb-1.5">{label}</p>
        <div className="flex items-center gap-2">
          <button
            className="step-btn"
            onPointerDown={e => { e.preventDefault(); onChange(Math.max(0, value - step)) }}
          >−</button>
          <span className="flex-1 text-center font-semibold text-lg tabular-nums">
            {value}{unit}
          </span>
          <button
            className="step-btn"
            onPointerDown={e => { e.preventDefault(); onChange(value + step) }}
          >+</button>
        </div>
      </div>
    )
  }

  const template = (session as any)?.workout_templates

  return (
    <div className="px-4 pt-6 pb-10 space-y-5">
      <div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 mb-3">← Quay lại</button>
        <h1 className="text-lg font-semibold">
          {template?.name ?? 'Chạy bộ'}
        </h1>
        {template?.target_pace && (
          <p className="text-xs text-gray-500 mt-0.5">
            Mục tiêu pace {template.target_pace} · HR {template.target_hr_range}
          </p>
        )}
      </div>

      {/* Thời gian */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Thời gian</p>
        <div className="flex gap-3">
          <NumField label="Giờ" value={form.hours} onChange={v => set('hours', v)} />
          <NumField label="Phút" value={form.minutes} onChange={v => set('minutes', v)} />
          <NumField label="Giây" value={form.seconds} step={5} onChange={v => set('seconds', v)} />
        </div>
      </div>

      {/* Quãng đường */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Quãng đường</p>
        <div className="flex gap-3">
          <NumField label="km" value={form.distance} step={0.1}
            onChange={v => set('distance', Math.round(v * 10) / 10)} />
        </div>
        {/* Pace tự tính */}
        {form.distance > 0 && (() => {
          const secs = form.hours * 3600 + form.minutes * 60 + form.seconds
          const pace = Math.round(secs / form.distance)
          const m = Math.floor(pace / 60), s = pace % 60
          return (
            <p className="text-xs text-sky-400 mt-2">
              Pace: {m}:{s.toString().padStart(2, '0')} /km
            </p>
          )
        })()}
      </div>

      {/* HR */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Nhịp tim</p>
        <div className="flex gap-3">
          <NumField label="HR trung bình" value={form.avg_hr} onChange={v => set('avg_hr', v)} />
          <NumField label="HR tối đa" value={form.max_hr} onChange={v => set('max_hr', v)} />
        </div>
      </div>

      {/* Calo */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">Calo</p>
        <div className="flex gap-3">
          <NumField label="kcal" value={form.calories} step={10} onChange={v => set('calories', v)} />
        </div>
      </div>

      {/* Cảm giác */}
      <div className="card p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Cảm giác</p>
        <textarea
          value={form.feeling_note}
          onChange={e => set('feeling_note', e.target.value)}
          rows={2}
          placeholder="Cảm giác chạy hôm nay..."
          className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700
                     outline-none resize-none"
        />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? 'Đang lưu...' : 'Lưu buổi chạy'}
      </button>
    </div>
  )
}
