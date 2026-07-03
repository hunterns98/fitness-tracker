'use client'
import { useEffect, useState } from 'react'
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
        <button className="step-btn" onPointerDown={e => {
          e.preventDefault()
          onChange(Math.max(min, Math.round((value - step) * 100) / 100))
        }}>−</button>
        <span className="flex-1 text-center font-semibold text-lg tabular-nums">{value}{unit}</span>
        <button className="step-btn" onPointerDown={e => {
          e.preventDefault()
          onChange(Math.round((value + step) * 100) / 100)
        }}>+</button>
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
  const [error, setError] = useState('')

  // Body form
  const [body, setBody] = useState({ weight_kg: 62.0, body_fat_pct: 17.0, waist_cm: 79, note: '' })

  // Sleep form — giờ và phút riêng biệt
  const [sleep, setSleep] = useState({
    resting_hr: 60,
    sleep_score: 85,
    sleep_hours: 7,
    sleep_minutes: 0,
    wake_count: 1,
    energy_level: 'Tốt',
    note: '',
  })

  // Load giá trị hiện tại nếu đã có hôm nay
  useEffect(() => {
    fetch('/api/body-metrics').then(r => r.json()).then((rows: any[]) => {
      const todayRow = rows?.find(r => r.date === today)
      if (todayRow) {
        setBody({
          weight_kg: todayRow.weight_kg ?? 62.0,
          body_fat_pct: todayRow.body_fat_pct ?? 17.0,
          waist_cm: todayRow.waist_cm ?? 79,
          note: todayRow.note ?? '',
        })
      }
    })
  }, [today])

  async function saveBody() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/body-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, ...body }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Lỗi khi lưu'); setSaving(false); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setError('Lỗi kết nối') }
    setSaving(false)
  }

  async function saveSleep() {
    setSaving(true)
    setError('')
    try {
      const sleep_duration_min = sleep.sleep_hours * 60 + sleep.sleep_minutes
      const res = await fetch('/api/sleep-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          resting_hr: sleep.resting_hr,
          sleep_score: sleep.sleep_score,
          sleep_duration_min,
          wake_count: sleep.wake_count,
          energy_level: sleep.energy_level,
          note: sleep.note,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Lỗi khi lưu'); setSaving(false); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setError('Lỗi kết nối') }
    setSaving(false)
  }

  const sleepLabel = `${sleep.sleep_hours}h${sleep.sleep_minutes > 0 ? ` ${sleep.sleep_minutes}m` : ''}`

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Ghi chép hôm nay</h1>
          <p className="text-xs text-gray-500 mt-0.5">{today}</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500">← Quay lại</button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 p-1 bg-gray-900 rounded-xl">
        {(['body', 'sleep'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setSaved(false); setError('') }}
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
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          {saved && <p className="text-sm text-green-400 text-center">✓ Đã lưu — về Dashboard để xem</p>}
          <button onClick={saveBody} disabled={saving} className="btn-primary">
            {saving ? 'Đang lưu...' : 'Lưu số liệu cơ thể'}
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn-ghost w-full text-center">
            📊 Xem Dashboard
          </button>
        </div>
      )}

      {tab === 'sleep' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <Stepper label="Resting HR (bpm)" value={sleep.resting_hr}
              onChange={v => setSleep(s => ({ ...s, resting_hr: v }))} />
            <Stepper label="Điểm ngủ /100" value={sleep.sleep_score}
              onChange={v => setSleep(s => ({ ...s, sleep_score: Math.min(100, Math.max(0, v)) }))} />

            {/* Giờ ngủ: nhập giờ + phút riêng */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Thời gian ngủ — <span className="text-sky-400">{sleepLabel}</span></p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 mb-1 text-center">Giờ</p>
                  <div className="flex items-center gap-1.5">
                    <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_hours: Math.max(0, s.sleep_hours - 1) })) }}>−</button>
                    <span className="flex-1 text-center font-semibold">{sleep.sleep_hours}</span>
                    <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_hours: Math.min(12, s.sleep_hours + 1) })) }}>+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600 mb-1 text-center">Phút</p>
                  <div className="flex items-center gap-1.5">
                    <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_minutes: Math.max(0, s.sleep_minutes - 1) })) }}>−</button>
                    <span className="flex-1 text-center font-semibold">{sleep.sleep_minutes.toString().padStart(2, '0')}</span>
                    <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_minutes: Math.min(59, s.sleep_minutes + 1) })) }}>+</button>
                  </div>
                </div>
              </div>
            </div>

            <Stepper label="Số lần thức giữa đêm" value={sleep.wake_count} min={0}
              onChange={v => setSleep(s => ({ ...s, wake_count: v }))} />
          </div>

          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-2">Năng lượng</p>
            <div className="flex gap-2">
              {['Thấp', 'Bình thường', 'Tốt'].map(level => (
                <button key={level}
                  onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, energy_level: level })) }}
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

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          {saved && <p className="text-sm text-green-400 text-center">✓ Đã lưu — về Dashboard để xem</p>}
          <button onClick={saveSleep} disabled={saving} className="btn-primary">
            {saving ? 'Đang lưu...' : 'Lưu giấc ngủ'}
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn-ghost w-full text-center">
            📊 Xem Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
