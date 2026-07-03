'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────
type BodyPoint = { date: string; weight_kg: number | null; body_fat_pct: number | null; lean_mass_kg: number | null; waist_cm: number | null }
type StrengthPoint = { date: string; maxWeight: number; totalVolume: number; avgRpe: number | null; sets: { set_number: number; reps: number; weight_kg: number; rpe: number | null }[] }
type RunWeek = { week: string; weekLabel: string; totalKm: number; sessions: number; easy: number; tempo: number; interval: number; avgPace: number | null }
type RecoveryPoint = { date: string; resting_hr: number | null; sleep_score: number | null; sleep_duration_min: number | null; energy_level: string | null }
type Exercise = { id: string; name: string; muscle_group: string }

type Tab = 'body' | 'strength' | 'running' | 'recovery'

// ─── Helpers ──────────────────────────────────────────────────
function shortDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getDate()}/${dt.getMonth() + 1}`
}
function paceStr(secs: number | null) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
function sleepStr(min: number | null) {
  if (!min) return '—'
  return `${Math.floor(min / 60)}h${(min % 60) > 0 ? (min % 60) + 'm' : ''}`
}

// ─── Chart theme ──────────────────────────────────────────────
const COLORS = { weight: '#38bdf8', fat: '#f59e0b', lean: '#34d399', waist: '#a78bfa', volume: '#60a5fa', weight2: '#f472b6', hr: '#f87171', sleep: '#a78bfa', km: '#34d399' }
const tooltipStyle = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }
const axisStyle = { fill: '#6b7280', fontSize: 11 }

// ─── Shared empty state ───────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center py-16 text-gray-600 text-sm space-y-2"><span className="text-3xl">📊</span><p>{text}</p></div>
}

// ─── Body Tab ─────────────────────────────────────────────────
function BodyTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<BodyPoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    fetch('/api/dashboard/body')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(Array.isArray(d) ? d : [])
      })
      .catch(() => setError('Không thể tải dữ liệu'))
  }, [refreshKey])

  if (error) return <div className="card px-4 py-3 border-red-900 text-red-400 text-sm">{error}</div>
  if (!data.length) return <EmptyState text="Chưa có dữ liệu cơ thể. Nhấn '+ Ghi chép' để nhập." />

  const latest = data[data.length - 1]
  const first = data[0]
  const weightDiff = latest.weight_kg != null && first.weight_kg != null ? Math.round((latest.weight_kg - first.weight_kg) * 10) / 10 : null
  const fatDiff = latest.body_fat_pct != null && first.body_fat_pct != null ? Math.round((latest.body_fat_pct - first.body_fat_pct) * 10) / 10 : null

  const chartData = data.map(d => ({ ...d, date: shortDate(d.date) }))

  return (
    <div className="space-y-5">
      {/* Current stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Cân nặng" value={`${latest.weight_kg ?? '—'} kg`} sub={weightDiff != null ? `${weightDiff > 0 ? '+' : ''}${weightDiff} kg so với đầu` : ''} subColor={weightDiff != null && weightDiff < 0 ? 'text-green-400' : 'text-gray-500'} />
        <StatCard label="Body fat" value={`${latest.body_fat_pct ?? '—'} %`} sub={fatDiff != null ? `${fatDiff > 0 ? '+' : ''}${fatDiff}% so với đầu` : ''} subColor={fatDiff != null && fatDiff < 0 ? 'text-green-400' : 'text-gray-500'} />
        <StatCard label="Lean mass" value={`${latest.lean_mass_kg ?? '—'} kg`} sub="" subColor="" />
        <StatCard label="Vòng eo" value={`${latest.waist_cm ?? '—'} cm`} sub="" subColor="" />
      </div>

      {/* Recomp indicator */}
      {weightDiff != null && fatDiff != null && (
        <div className={`card px-4 py-3 text-sm ${weightDiff <= 0 && fatDiff <= 0 ? 'border-green-800 text-green-400' : 'border-gray-800 text-gray-400'}`}>
          {weightDiff <= 0 && fatDiff <= 0
            ? '✅ Body recomp đang diễn ra tốt — cân giảm, mỡ giảm'
            : '📈 Đang theo dõi xu hướng — tiếp tục ghi chép đều'}
        </div>
      )}

      {/* Weight + fat chart */}
      <ChartCard title="Cân nặng & Body fat">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis yAxisId="w" domain={['dataMin - 1', 'dataMax + 1']} tick={axisStyle} />
            <YAxis yAxisId="f" orientation="right" domain={[10, 30]} tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Line yAxisId="w" type="monotone" dataKey="weight_kg" name="Cân (kg)" stroke={COLORS.weight} dot={{ r: 3 }} strokeWidth={2} connectNulls />
            <Line yAxisId="f" type="monotone" dataKey="body_fat_pct" name="Mỡ (%)" stroke={COLORS.fat} dot={{ r: 3 }} strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Lean mass chart */}
      {data.some(d => d.lean_mass_kg != null) && (
        <ChartCard title="Lean mass (kg)">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="lean_mass_kg" name="Lean mass" stroke={COLORS.lean} dot={{ r: 3 }} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ─── Strength Tab ─────────────────────────────────────────────
function StrengthTab() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [history, setHistory] = useState<StrengthPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/strength').then(r => r.json()).then((data: Exercise[]) => {
      setExercises(data ?? [])
      if (data?.length) setSelectedId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    fetch(`/api/dashboard/strength?exercise_id=${selectedId}`)
      .then(r => r.json())
      .then(d => { setHistory(d ?? []); setLoading(false) })
  }, [selectedId])

  if (!exercises.length) return <EmptyState text="Chưa có dữ liệu tập. Hoàn thành vài buổi tập để xem tiến trình." />

  const chartData = history.map(h => ({ date: shortDate(h.date), tạ: h.maxWeight, volume: h.totalVolume, rpe: h.avgRpe }))
  const latest = history[history.length - 1]
  const prev = history[history.length - 2]
  const weightUp = latest && prev && latest.maxWeight > prev.maxWeight
  const volumeUp = latest && prev && latest.totalVolume > prev.totalVolume

  // Group by muscle_group for selector
  const grouped: Record<string, Exercise[]> = {}
  for (const ex of exercises) {
    if (!grouped[ex.muscle_group]) grouped[ex.muscle_group] = []
    grouped[ex.muscle_group].push(ex)
  }

  return (
    <div className="space-y-5">
      {/* Exercise selector */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Chọn bài tập</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => setSelectedId(ex.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedId === ex.id ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm text-center py-8">Đang tải...</p>}

      {!loading && history.length === 0 && <EmptyState text="Chưa có dữ liệu cho bài này." />}

      {!loading && history.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Tạ hiện tại" value={`${latest.maxWeight} kg`}
              sub={prev ? (weightUp ? `↑ từ ${prev.maxWeight}kg` : `= ${prev.maxWeight}kg`) : 'Buổi đầu'}
              subColor={weightUp ? 'text-green-400' : 'text-gray-500'} />
            <StatCard label="Volume" value={`${latest.totalVolume}`}
              sub={prev ? (volumeUp ? `↑ từ ${prev.totalVolume}` : `↓ từ ${prev.totalVolume}`) : 'kg tổng'}
              subColor={volumeUp ? 'text-green-400' : 'text-yellow-500'} />
            <StatCard label="RPE TB" value={latest.avgRpe != null ? `${latest.avgRpe}` : '—'}
              sub="buổi vừa rồi" subColor="text-gray-500" />
          </div>

          {/* Progressive overload status */}
          {prev && (
            <div className={`card px-4 py-3 text-sm ${weightUp ? 'border-green-800 text-green-400' : volumeUp ? 'border-sky-800 text-sky-400' : 'border-gray-800 text-gray-500'}`}>
              {weightUp
                ? `✅ Đã tăng tạ ${prev.maxWeight}kg → ${latest.maxWeight}kg`
                : volumeUp
                ? `📈 Volume tăng — đang build capacity trước khi tăng tạ`
                : `⏸ Giữ nguyên — tiếp tục cải thiện rep quality`}
            </div>
          )}

          {/* Weight progression chart */}
          <ChartCard title="Tạ tối đa mỗi buổi (kg)">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={axisStyle} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="tạ" stroke={COLORS.weight2} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Volume chart */}
          <ChartCard title="Volume mỗi buổi (kg tổng)">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="volume" fill={COLORS.volume} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Recent session detail */}
          {latest.sets.length > 0 && (
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-2">Buổi gần nhất — {shortDate(history[history.length - 1].date)}</p>
              <div className="space-y-1">
                {latest.sets.map(s => (
                  <div key={s.set_number} className="flex gap-4 text-xs text-gray-400">
                    <span className="text-gray-600 w-10">Set {s.set_number}</span>
                    <span className="font-medium text-gray-300">{s.weight_kg}kg × {s.reps}</span>
                    {s.rpe != null && <span className="text-gray-600">RPE {s.rpe}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Running Tab ──────────────────────────────────────────────
function RunningTab() {
  const [data, setData] = useState<RunWeek[]>([])
  useEffect(() => { fetch('/api/dashboard/running').then(r => r.json()).then(setData) }, [])

  if (!data.length) return <EmptyState text="Chưa có dữ liệu chạy bộ." />

  const latest = data[data.length - 1]
  const prev = data[data.length - 2]

  return (
    <div className="space-y-5">
      {/* This week */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Tuần này" value={`${latest.totalKm} km`}
          sub={prev ? `Tuần trước ${prev.totalKm}km` : `${latest.sessions} buổi`}
          subColor={latest.totalKm >= (prev?.totalKm ?? 0) ? 'text-green-400' : 'text-yellow-500'} />
        <StatCard label="Số buổi" value={`${latest.sessions}`} sub="buổi/tuần" subColor="text-gray-500" />
        <StatCard label="Pace TB" value={paceStr(latest.avgPace)} sub="/km" subColor="text-gray-500" />
      </div>

      {/* Run type breakdown */}
      <div className="card p-4">
        <p className="text-xs text-gray-500 mb-3">Phân bổ buổi chạy tuần này</p>
        <div className="flex gap-3">
          <RunTypeBadge label="Easy" count={latest.easy} color="bg-green-800 text-green-400" />
          <RunTypeBadge label="Tempo" count={latest.tempo} color="bg-yellow-800 text-yellow-400" />
          <RunTypeBadge label="Interval" count={latest.interval} color="bg-red-800 text-red-400" />
        </div>
        {latest.easy >= 1 && latest.tempo >= 1 && (
          <p className="text-xs text-gray-500 mt-3">
            {latest.interval === 0
              ? '💡 Không có interval tuần này — ổn nếu đang tập trung hồi phục'
              : '✅ Phân bổ Easy/Tempo/Interval cân bằng'}
          </p>
        )}
      </div>

      {/* Weekly km chart */}
      <ChartCard title="Tổng km mỗi tuần">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.map(w => ({ ...w, date: w.weekLabel }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} km`]} />
            <Bar dataKey="totalKm" name="km" fill={COLORS.km} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Pace trend */}
      {data.some(w => w.avgPace != null) && (
        <ChartCard title="Pace trung bình (giây/km — thấp hơn = nhanh hơn)">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.map(w => ({ date: w.weekLabel, pace: w.avgPace }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={axisStyle} tickFormatter={v => paceStr(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [paceStr(v), 'Pace TB']} />
              <Line type="monotone" dataKey="pace" stroke={COLORS.weight} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ─── Recovery Tab ─────────────────────────────────────────────
function RecoveryTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<RecoveryPoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    fetch('/api/dashboard/recovery')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(Array.isArray(d) ? d : [])
      })
      .catch(() => setError('Không thể tải dữ liệu'))
  }, [refreshKey])

  if (error) return <div className="card px-4 py-3 border-red-900 text-red-400 text-sm">{error}</div>
  if (!data.length) return <EmptyState text="Chưa có dữ liệu phục hồi. Nhấn '+ Ghi chép' để nhập." />

  const latest = data[data.length - 1]
  const hrData = data.filter(d => d.resting_hr != null)
  const sleepData = data.filter(d => d.sleep_score != null)
  const avgHr = hrData.length ? Math.round(hrData.reduce((a, b) => a + (b.resting_hr ?? 0), 0) / hrData.length) : null
  const avgSleep = sleepData.length ? Math.round(sleepData.reduce((a, b) => a + (b.sleep_score ?? 0), 0) / sleepData.length) : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Resting HR hôm nay" value={`${latest.resting_hr ?? '—'} bpm`}
          sub={avgHr ? `TB: ${avgHr} bpm` : ''} subColor="text-gray-500" />
        <StatCard label="Điểm ngủ" value={`${latest.sleep_score ?? '—'}`}
          sub={avgSleep ? `TB: ${avgSleep}/100` : ''} subColor={latest.sleep_score != null && latest.sleep_score >= 80 ? 'text-green-400' : 'text-yellow-500'} />
        <StatCard label="Thời gian ngủ" value={sleepStr(latest.sleep_duration_min)} sub="hôm nay" subColor="text-gray-500" />
        <StatCard label="Năng lượng" value={latest.energy_level ?? '—'} sub="" subColor="text-gray-500" />
      </div>

      {/* HR trend */}
      {hrData.length > 1 && (
        <ChartCard title="Resting HR theo ngày (thấp hơn = hồi phục tốt hơn)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.map(d => ({ date: shortDate(d.date), hr: d.resting_hr }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} bpm`]} />
              {avgHr && <ReferenceLine y={avgHr} stroke="#374151" strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="hr" name="Resting HR" stroke={COLORS.hr} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Sleep score trend */}
      {sleepData.length > 1 && (
        <ChartCard title="Điểm ngủ theo ngày">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.map(d => ({ date: shortDate(d.date), score: d.sleep_score, dur: d.sleep_duration_min ? Math.round(d.sleep_duration_min / 60 * 10) / 10 : null }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis yAxisId="s" domain={[50, 100]} tick={axisStyle} />
              <YAxis yAxisId="h" orientation="right" domain={[0, 12]} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine yAxisId="s" y={80} stroke="#374151" strokeDasharray="3 3" />
              <Line yAxisId="s" type="monotone" dataKey="score" name="Điểm ngủ" stroke={COLORS.sleep} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="h" type="monotone" dataKey="dur" name="Giờ ngủ" stroke={COLORS.km} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────
function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-semibold text-gray-100 mt-0.5">{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500 mb-3">{title}</p>
      {children}
    </div>
  )
}

function RunTypeBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex-1 rounded-xl px-3 py-2 text-center ${color}`}>
      <p className="text-lg font-semibold">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('body')
  const [refreshKey, setRefreshKey] = useState(0)

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'body', label: 'Cơ thể', icon: '⚖️' },
    { id: 'strength', label: 'Sức mạnh', icon: '🏋️' },
    { id: 'running', label: 'Chạy bộ', icon: '🏃' },
    { id: 'recovery', label: 'Phục hồi', icon: '😴' },
  ]

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400">
            ↻ Tải lại
          </button>
          <button onClick={() => router.push('/log')}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400">
            + Ghi chép
          </button>
          <button onClick={() => router.push('/')} className="text-xs text-gray-500">← Trang chủ</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-900 rounded-xl mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${tab === t.id ? 'bg-gray-700 text-gray-100' : 'text-gray-500'}`}>
            <span className="block">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'body' && <BodyTab refreshKey={refreshKey} />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'running' && <RunningTab />}
      {tab === 'recovery' && <RecoveryTab refreshKey={refreshKey} />}
    </div>
  )
}
