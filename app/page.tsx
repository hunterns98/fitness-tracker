'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────
type CalendarDay = {
  date: string
  types: string[]
  sessions: { id: string; type: string; name: string }[]
}

// ── Constants ─────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = { strength: '💪', run: '🏃', other: '⭐', rest: '😴' }
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

// ── Helpers ───────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().split('T')[0] }
function isoDate(d: Date) { return d.toISOString().split('T')[0] }

// Get Mon-indexed day cells for a month
function buildCalendarCells(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // Mon = 0
  const cells: (string | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function HomePage() {
  const router = useRouter()
  const today = isoToday()
  const [calMonth, setCalMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  const [calData, setCalData] = useState<Record<string, CalendarDay>>({})
  const [loadingCal, setLoadingCal] = useState(true)
  const [streak, setStreak] = useState(0)
  const [daysThisMonth, setDaysThisMonth] = useState(0)

  const loadCalendar = useCallback(async (year: number, month: number) => {
    setLoadingCal(true)
    const data: CalendarDay[] = await fetch(`/api/calendar?year=${year}&month=${month}`).then(r => r.json())
    const map: Record<string, CalendarDay> = {}
    for (const d of (data ?? [])) map[d.date] = d
    setCalData(map)
    setDaysThisMonth(Object.keys(map).length)
    setLoadingCal(false)
  }, [])

  useEffect(() => { loadCalendar(calMonth.year, calMonth.month) }, [calMonth, loadCalendar])

  // Compute streak (consecutive days from today backwards)
  useEffect(() => {
    let s = 0, cur = new Date()
    for (let i = 0; i < 60; i++) {
      const key = isoDate(cur)
      if (calData[key]) s++
      else if (i > 0) break
      cur.setDate(cur.getDate() - 1)
    }
    setStreak(s)
  }, [calData])

  const cells = buildCalendarCells(calMonth.year, calMonth.month)
  const daysInMonth = new Date(calMonth.year, calMonth.month, 0).getDate()

  function prevMonth() {
    setCalMonth(c => c.month === 1 ? { year: c.year - 1, month: 12 } : { ...c, month: c.month - 1 })
  }
  function nextMonth() {
    setCalMonth(c => c.month === 12 ? { year: c.year + 1, month: 1 } : { ...c, month: c.month + 1 })
  }

  async function addRest() {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, type: 'strength', name_override: 'Nghỉ ngơi' }),
    })
    const s = await res.json()
    router.push(`/summary/${s.id}`)
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Fitness Tracker</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto shrink-0" style={{ maxWidth: '60%' }}>
            <button onClick={() => router.push('/dashboard')}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
              📊 Dashboard
            </button>
            <button onClick={() => router.push('/exercises')}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              📚 Bài tập
            </button>
            <button onClick={() => router.push('/log')}
              className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              + Ghi chép
            </button>
          </div>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{ background: 'var(--warning-bg)' }}>
            <span className="text-lg">🔥</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
              {streak} ngày liên tiếp
            </span>
            <span className="text-xs ml-auto" style={{ color: 'var(--warning)' }}>
              {daysThisMonth}/{daysInMonth} ngày tháng này
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Quick action: tap today */}
        <div>
          <p className="section-label mb-2">Hôm nay</p>
          <button onClick={() => router.push(`/day/${today}`)}
            className="card w-full p-4 flex items-center gap-3 text-left"
            style={{ border: '2px solid var(--brand)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'var(--brand-light)' }}>
              ➕
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--brand-dark)' }}>
                Ghi chép buổi tập hôm nay
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {calData[today]
                  ? `Đã có ${calData[today].sessions.length} buổi — nhấn để xem thêm`
                  : 'Chưa có buổi tập nào hôm nay'}
              </p>
            </div>
            <span className="ml-auto" style={{ color: 'var(--brand)' }}>›</span>
          </button>
        </div>

        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">{MONTH_NAMES[calMonth.month - 1]} {calMonth.year}</p>
            <div className="flex gap-1">
              <button onClick={prevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>‹</button>
              <button onClick={nextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>›</button>
            </div>
          </div>

          <div className="card p-3">
            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <div key={d} className="text-center text-xs font-semibold py-1"
                  style={{ color: 'var(--text-3)' }}>{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={i} />
                const dayData = calData[dateStr]
                const isToday = dateStr === today
                const isPast = dateStr < today
                const dayNum = new Date(dateStr + 'T00:00:00').getDate()
                const hasWorkout = !!dayData

                return (
                  <button key={dateStr}
                    onClick={() => router.push(`/day/${dateStr}`)}
                    className="flex flex-col items-center py-1.5 rounded-xl transition-all"
                    style={{
                      background: isToday ? 'var(--brand)' : hasWorkout ? 'var(--surface-2)' : 'transparent',
                      minHeight: 52,
                    }}>
                    <span className="text-xs font-semibold"
                      style={{ color: isToday ? 'white' : isPast && !hasWorkout ? 'var(--text-3)' : 'var(--text)' }}>
                      {dayNum}
                    </span>
                    {dayData && (
                      <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 px-0.5">
                        {dayData.types.slice(0, 2).map((t, ti) => (
                          <span key={ti} className="text-xs leading-none">{TYPE_ICON[t] ?? '📋'}</span>
                        ))}
                        {dayData.types.length > 2 && (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>+</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        {Object.keys(calData).length > 0 && (
          <div>
            <p className="section-label mb-2">Hoạt động gần đây</p>
            <div className="space-y-2">
              {Object.values(calData)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map(day => (
                  <button key={day.date}
                    onClick={() => router.push(`/day/${day.date}`)}
                    className="card-sm w-full px-4 py-3 flex items-center gap-3 text-left">
                    <div className="flex gap-1">
                      {day.types.map((t, i) => (
                        <span key={i} className="text-xl">{TYPE_ICON[t] ?? '📋'}</span>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {day.sessions.map(s => s.name).join(' + ')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                      </p>
                    </div>
                    <span style={{ color: 'var(--text-3)' }}>›</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="pt-4 pb-2 flex justify-center">
          <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }}
            className="text-xs px-4 py-2 rounded-xl"
            style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
