'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'body' | 'sleep'

function Stepper({ label, value, onChange, step = 1, min = 0, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 100) / 100)) }}>−</button>
        <span className="flex-1 text-center font-semibold text-lg tabular-nums">{value}{unit}</span>
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.round((value + step) * 100) / 100) }}>+</button>
      </div>
    </div>
  )
}

export default function LogPage() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [tab, setTab] = useState<Tab>('body')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Body form
  const [body, setBody] = useState({
    weight_kg: 62.0,
    body_fat_pct: 17.0,
    waist_cm: 79,
    note: '',
  })

  // Sleep form
  const [sleep, setSleep] = useState({
    resting_hr: 60,
    sleep_score: 85,
    sleep_duration_min: 450,
    wake_count: 1,
    energy_level: 'Tốt',
    note: '',
  })

  function sleepDurationLabel(min: number) {
    const h = Math.floor(min / 60), m = min % 60
    return `${h}h${m > 0 ? ` ${m}m` : ''}`
  }

  async function saveBody() {
    setSaving(true)
    await fetch('/api/body-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, ...body, lean_mass_kg: null }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveSleep() {
    setSaving(true)
    await fetch('/api/sleep-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, ...sleep }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Ghi chép hôm nay</h1>
        <button onClick={() => router.back()} className="text-sm text-gray-500">← Quay lại</button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 p-1 bg-gray-900 rounded-xl">
        {(['body', 'sleep'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-sky-600 text-white' : 'text-gray-500'}`}>
            {t === 'body' ? '⚖️ Cơ thể' : '😴 Giấc ngủ'}
          </button>
        ))}
      </div>

      {tab === 'body' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <Stepper label="Cân nặng (kg)" value={body.weight_kg} step={0.1}
              onChange={v => setBody(b => ({ ...b, weight_kg: v }))} />
            <Stepper label="Body fat (%)" value={body.body_fat_pct} step={0.1}
              onChange={v => setBody(b => ({ ...b, body_fat_pct: v }))} />
            <Stepper label="Vòng eo (cm)" value={body.waist_cm} step={0.5}
              onChange={v => setBody(b => ({ ...b, waist_cm: v }))} />
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-2">Ghi chú</p>
            <textarea value={body.note} onChange={e => setBody(b => ({ ...b, note: e.target.value }))} rows={2}
              placeholder="Ví dụ: sau ăn sáng, mặc đồ nhẹ..."
              className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700 outline-none resize-none" />
          </div>
          {saved && <p className="text-xs text-green-500 text-center">Đã lưu ✓</p>}
          <button onClick={saveBody} disabled={saving} className="btn-primary">
            {saving ? 'Đang lưu...' : 'Lưu số liệu cơ thể'}
          </button>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <Stepper label="Resting HR (bpm)" value={sleep.resting_hr}
              onChange={v => setSleep(s => ({ ...s, resting_hr: v }))} />
            <Stepper label="Điểm ngủ" value={sleep.sleep_score}
              onChange={v => setSleep(s => ({ ...s, sleep_score: Math.min(100, v) }))} />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Thời gian ngủ</p>
              <div className="flex items-center gap-2">
                <button className="step-btn" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_duration_min: Math.max(0, s.sleep_duration_min - 15) })) }}>−</button>
                <span className="flex-1 text-center font-semibold text-lg">{sleepDurationLabel(sleep.sleep_duration_min)}</span>
                <button className="step-btn" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_duration_min: s.sleep_duration_min + 15 })) }}>+</button>
              </div>
            </div>
            <Stepper label="Số lần thức giữa đêm" value={sleep.wake_count} min={0}
              onChange={v => setSleep(s => ({ ...s, wake_count: v }))} />
          </div>

          {/* Energy level */}
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-2">Năng lượng</p>
            <div className="flex gap-2">
              {['Thấp', 'Bình thường', 'Tốt'].map(level => (
                <button key={level} onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, energy_level: level })) }}
                  className={`flex-1 py-2 rounded-xl text-sm transition-colors ${sleep.energy_level === level ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-2">Ghi chú</p>
            <textarea value={sleep.note} onChange={e => setSleep(s => ({ ...s, note: e.target.value }))} rows={2}
              placeholder="Ví dụ: ngủ muộn 0:30, ngủ sâu tốt..."
              className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-700 outline-none resize-none" />
          </div>

          {saved && <p className="text-xs text-green-500 text-center">Đã lưu ✓</p>}
          <button onClick={saveSleep} disabled={saving} className="btn-primary">
            {saving ? 'Đang lưu...' : 'Lưu giấc ngủ'}
          </button>
        </div>
      )}
    </div>
  )
}
