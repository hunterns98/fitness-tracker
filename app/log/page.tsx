'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Tab = 'body' | 'sleep' | 'nutrition'

function Stepper({ label, value, onChange, step = 1, min = 0, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; unit?: string
}) {
  return (
    <div className="flex-1">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      <div className="flex items-center gap-2">
        <button className="step-btn" onPointerDown={e => { e.preventDefault(); onChange(Math.max(min, Math.round((value - step) * 100) / 100)) }}>−</button>
        <span className="flex-1 text-center font-bold text-lg tabular-nums" style={{ color: 'var(--text)' }}>{value}{unit}</span>
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
  const [error, setError] = useState('')

  // Body form
  const [body, setBody] = useState({ weight_kg: 62.0, body_fat_pct: 17.0, waist_cm: 79, note: '' })

  // Sleep form
  const [sleep, setSleep] = useState({
    resting_hr: 60, sleep_score: 85,
    sleep_hours: 7, sleep_minutes: 0,
    wake_count: 1, energy_level: 'Tốt', note: '',
  })

  // Nutrition form
  const [nutrition, setNutrition] = useState({
    calories: 1950, protein_g: 155, carbs_g: 175, fat_g: 65, fiber_g: 10,
    water_adequate: true, note: '',
  })

  // Load today's existing data
  useEffect(() => {
    fetch('/api/body-metrics').then(r => r.json()).then((rows: any[]) => {
      const row = rows?.find(r => r.date === today)
      if (row) setBody({ weight_kg: row.weight_kg ?? 62, body_fat_pct: row.body_fat_pct ?? 17, waist_cm: row.waist_cm ?? 79, note: row.note ?? '' })
    })
    fetch('/api/nutrition?limit=7').then(r => r.json()).then((rows: any[]) => {
      const row = rows?.find(r => r.date === today)
      if (row) setNutrition({ calories: row.calories ?? 1950, protein_g: row.protein_g ?? 155, carbs_g: row.carbs_g ?? 175, fat_g: row.fat_g ?? 65, fiber_g: row.fiber_g ?? 10, water_adequate: row.water_adequate ?? true, note: row.note ?? '' })
    })
  }, [today])

  const sleepLabel = `${sleep.sleep_hours}h${sleep.sleep_minutes > 0 ? ` ${sleep.sleep_minutes}m` : ''}`

  // Tính % macro
  const totalCal = nutrition.protein_g * 4 + nutrition.carbs_g * 4 + nutrition.fat_g * 9
  const proteinPct = totalCal > 0 ? Math.round(nutrition.protein_g * 4 / totalCal * 100) : 0
  const carbsPct = totalCal > 0 ? Math.round(nutrition.carbs_g * 4 / totalCal * 100) : 0
  const fatPct = totalCal > 0 ? Math.round(nutrition.fat_g * 9 / totalCal * 100) : 0

  // Protein target check (1.8g/kg lean mass ≈ ~93g; 2.2g/kg body weight ≈ 137g)
  const proteinTarget = Math.round(nutrition.protein_g > 0 ? body.weight_kg * 2.0 : 0)
  const proteinOk = nutrition.protein_g >= body.weight_kg * 1.8

  async function saveBody() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/body-metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, ...body }) })
      if (!res.ok) { const d = await res.json(); setError(d.error); setSaving(false); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { setError('Lỗi kết nối') }
    setSaving(false)
  }

  async function saveSleep() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/sleep-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, resting_hr: sleep.resting_hr, sleep_score: sleep.sleep_score, sleep_duration_min: sleep.sleep_hours * 60 + sleep.sleep_minutes, wake_count: sleep.wake_count, energy_level: sleep.energy_level, note: sleep.note }) })
      if (!res.ok) { const d = await res.json(); setError(d.error); setSaving(false); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { setError('Lỗi kết nối') }
    setSaving(false)
  }

  async function saveNutrition() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/nutrition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, calories: nutrition.calories, protein_g: nutrition.protein_g, carbs_g: nutrition.carbs_g, fat_g: nutrition.fat_g, fiber_g: nutrition.fiber_g, water_adequate: nutrition.water_adequate, note: nutrition.note || null }) })
      if (!res.ok) { const d = await res.json(); setError(d.error); setSaving(false); return }
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch { setError('Lỗi kết nối') }
    setSaving(false)
  }

  const TABS = [
    { id: 'body' as Tab, icon: '⚖️', label: 'Cơ thể' },
    { id: 'sleep' as Tab, icon: '😴', label: 'Giấc ngủ' },
    { id: 'nutrition' as Tab, icon: '🥗', label: 'Dinh dưỡng' },
  ]

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <div>
          <h1 className="font-bold" style={{ color: 'var(--text)' }}>Ghi chép hôm nay</h1>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{today}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSaved(false); setError('') }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: tab === t.id ? 'var(--brand)' : 'transparent', color: tab === t.id ? 'white' : 'var(--text-3)' }}>
              <span className="block text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body Tab ── */}
        {tab === 'body' && (
          <div className="space-y-3 fade-in">
            <div className="card p-4 space-y-4">
              <Stepper label="Cân nặng (kg)" value={body.weight_kg} step={0.1} onChange={v => setBody(b => ({ ...b, weight_kg: v }))} />
              <Stepper label="Body fat (%)" value={body.body_fat_pct} step={0.1} onChange={v => setBody(b => ({ ...b, body_fat_pct: v }))} />
              <Stepper label="Vòng eo (cm)" value={body.waist_cm} step={0.5} onChange={v => setBody(b => ({ ...b, waist_cm: v }))} />
            </div>
            <div className="card p-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Ghi chú</p>
              <textarea value={body.note} onChange={e => setBody(b => ({ ...b, note: e.target.value }))} rows={2} placeholder="Ví dụ: sau ăn sáng, mặc đồ nhẹ..." className="w-full bg-transparent text-sm outline-none resize-none" style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
            </div>
            {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
            {saved && <p className="text-sm text-center" style={{ color: 'var(--success)' }}>✓ Đã lưu — về Dashboard để xem</p>}
            <button onClick={saveBody} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu số liệu cơ thể'}</button>
            <button onClick={() => router.push('/dashboard')} className="btn-ghost w-full text-center">📊 Xem Dashboard</button>
          </div>
        )}

        {/* ── Sleep Tab ── */}
        {tab === 'sleep' && (
          <div className="space-y-3 fade-in">
            <div className="card p-4 space-y-4">
              <Stepper label="Resting HR (bpm)" value={sleep.resting_hr} onChange={v => setSleep(s => ({ ...s, resting_hr: v }))} />
              <Stepper label="Điểm ngủ /100" value={sleep.sleep_score} onChange={v => setSleep(s => ({ ...s, sleep_score: Math.min(100, Math.max(0, v)) }))} />
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Thời gian ngủ — <span style={{ color: 'var(--brand)' }}>{sleepLabel}</span></p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs mb-1 text-center" style={{ color: 'var(--text-3)' }}>Giờ</p>
                    <div className="flex items-center gap-1.5">
                      <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_hours: Math.max(0, s.sleep_hours - 1) })) }}>−</button>
                      <span className="flex-1 text-center font-bold">{sleep.sleep_hours}</span>
                      <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_hours: Math.min(12, s.sleep_hours + 1) })) }}>+</button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs mb-1 text-center" style={{ color: 'var(--text-3)' }}>Phút</p>
                    <div className="flex items-center gap-1.5">
                      <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_minutes: Math.max(0, s.sleep_minutes - 1) })) }}>−</button>
                      <span className="flex-1 text-center font-bold">{sleep.sleep_minutes.toString().padStart(2,'0')}</span>
                      <button className="step-btn !w-8 !h-8" onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, sleep_minutes: Math.min(59, s.sleep_minutes + 1) })) }}>+</button>
                    </div>
                  </div>
                </div>
              </div>
              <Stepper label="Số lần thức giữa đêm" value={sleep.wake_count} min={0} onChange={v => setSleep(s => ({ ...s, wake_count: v }))} />
            </div>
            <div className="card p-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Năng lượng</p>
              <div className="flex gap-2">
                {['Thấp', 'Bình thường', 'Tốt'].map(level => (
                  <button key={level} onPointerDown={e => { e.preventDefault(); setSleep(s => ({ ...s, energy_level: level })) }}
                    className="flex-1 py-2 rounded-xl text-sm transition-all"
                    style={{ background: sleep.energy_level === level ? 'var(--brand)' : 'var(--surface-2)', color: sleep.energy_level === level ? 'white' : 'var(--text-2)' }}>
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Ghi chú</p>
              <textarea value={sleep.note} onChange={e => setSleep(s => ({ ...s, note: e.target.value }))} rows={2} placeholder="Ngủ muộn 0:30, ngủ sâu tốt..." className="w-full bg-transparent text-sm outline-none resize-none" style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
            </div>
            {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
            {saved && <p className="text-sm text-center" style={{ color: 'var(--success)' }}>✓ Đã lưu</p>}
            <button onClick={saveSleep} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu giấc ngủ'}</button>
          </div>
        )}

        {/* ── Nutrition Tab ── */}
        {tab === 'nutrition' && (
          <div className="space-y-3 fade-in">
            {/* Protein check */}
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: proteinOk ? 'var(--success-bg)' : 'var(--warning-bg)' }}>
              <span className="text-2xl">{proteinOk ? '✅' : '⚠️'}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: proteinOk ? 'var(--success)' : 'var(--warning)' }}>
                  Protein: {nutrition.protein_g}g {proteinOk ? '— Đủ để tăng cơ' : `— Cần ≥${Math.round(body.weight_kg * 1.8)}g`}
                </p>
                <p className="text-xs" style={{ color: proteinOk ? 'var(--success)' : 'var(--warning)' }}>
                  Mục tiêu: {Math.round(body.weight_kg * 1.8)}–{Math.round(body.weight_kg * 2.2)}g/ngày (1.8–2.2g × {body.weight_kg}kg)
                </p>
              </div>
            </div>

            {/* Macros */}
            <div className="card p-4 space-y-4">
              <Stepper label="Calo (kcal)" value={nutrition.calories} step={50} onChange={v => setNutrition(n => ({ ...n, calories: v }))} />
              <Stepper label="Protein (g)" value={nutrition.protein_g} step={5} onChange={v => setNutrition(n => ({ ...n, protein_g: v }))} />
              <Stepper label="Carbs (g)" value={nutrition.carbs_g} step={5} onChange={v => setNutrition(n => ({ ...n, carbs_g: v }))} />
              <Stepper label="Chất béo (g)" value={nutrition.fat_g} step={5} onChange={v => setNutrition(n => ({ ...n, fat_g: v }))} />
              <Stepper label="Chất xơ (g)" value={nutrition.fiber_g} step={1} onChange={v => setNutrition(n => ({ ...n, fiber_g: v }))} />
            </div>

            {/* Macro breakdown */}
            {totalCal > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>PHÂN BỔ MACRO</p>
                <div className="flex gap-2 mb-3">
                  {[
                    { label: 'Protein', pct: proteinPct, color: 'var(--brand)' },
                    { label: 'Carbs', pct: carbsPct, color: 'var(--warning)' },
                    { label: 'Fat', pct: fatPct, color: 'var(--danger)' },
                  ].map(m => (
                    <div key={m.label} className="flex-1 text-center">
                      <div className="h-2 rounded-full mb-1.5" style={{ background: m.color, opacity: 0.3 }}>
                        <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
                      </div>
                      <p className="text-xs font-bold" style={{ color: m.color }}>{m.pct}%</p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                  Tổng tính từ macro: ~{totalCal} kcal
                  {Math.abs(totalCal - nutrition.calories) > 100 ? ` (chênh ${Math.abs(totalCal - nutrition.calories)} kcal so với nhập)` : ''}
                </p>
              </div>
            )}

            {/* Water */}
            <div className="card p-4">
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>NƯỚC</p>
              <div className="flex gap-2">
                {[true, false].map(val => (
                  <button key={String(val)}
                    onPointerDown={e => { e.preventDefault(); setNutrition(n => ({ ...n, water_adequate: val })) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: nutrition.water_adequate === val ? (val ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--surface-2)', color: nutrition.water_adequate === val ? (val ? 'var(--success)' : 'var(--danger)') : 'var(--text-3)' }}>
                    {val ? '💧 Đủ nước' : '❌ Thiếu nước'}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Ghi chú</p>
              <textarea value={nutrition.note} onChange={e => setNutrition(n => ({ ...n, note: e.target.value }))} rows={2} placeholder="Ăn ngoài, ăn buffet, ăn sạch..." className="w-full bg-transparent text-sm outline-none resize-none" style={{ color: 'var(--text)', caretColor: 'var(--brand)' }} />
            </div>

            {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
            {saved && <p className="text-sm text-center" style={{ color: 'var(--success)' }}>✓ Đã lưu</p>}
            <button onClick={saveNutrition} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu dinh dưỡng hôm nay'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
