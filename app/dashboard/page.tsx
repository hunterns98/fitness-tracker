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
type NutritionPoint = { date: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null; water_adequate: boolean | null }
type Exercise = { id: string; name: string; muscle_group: string }

type Tab = 'body' | 'strength' | 'running' | 'recovery' | 'nutrition'

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
const COLORS = { weight: '#0EA5E9', fat: '#F59E0B', lean: '#16A34A', waist: '#8B5CF6', volume: '#6366F1', weight2: '#EC4899', hr: '#EF4444', sleep: '#8B5CF6', km: '#16A34A', warning: '#F59E0B' }
const tooltipStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }
const axisStyle = { fill: '#94A3B8', fontSize: 11 }

// ─── Shared empty state ───────────────────────────────────────
function EmptyState({ text }: { text: string }) {
  return (
    <div className="card p-10 flex flex-col items-center gap-3 text-center">
      <span className="text-4xl">📊</span>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>{text}</p>
    </div>
  )
}

// ─── Body Tab ─────────────────────────────────────────────────
function BodyTab({ refreshKey, days }: { refreshKey: number; days: number }) {
  const [allData, setAllData] = useState<BodyPoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    fetch('/api/dashboard/body')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setAllData(Array.isArray(d) ? d : [])
      })
      .catch(() => setError('Không thể tải dữ liệu'))
  }, [refreshKey])

  // Filter by days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const data = days >= 9999 ? allData : allData.filter(d => d.date >= cutoffStr)

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
        <StatCard label="Cân nặng" value={`${latest.weight_kg ?? '—'} kg`} sub={weightDiff != null ? `${weightDiff > 0 ? '+' : ''}${weightDiff} kg so với đầu` : ''} subColor={weightDiff != null && weightDiff < 0 ? 'text-green-600' : 'text-slate-400'} />
        <StatCard label="Body fat" value={`${latest.body_fat_pct ?? '—'} %`} sub={fatDiff != null ? `${fatDiff > 0 ? '+' : ''}${fatDiff}% so với đầu` : ''} subColor={fatDiff != null && fatDiff < 0 ? 'text-green-600' : 'text-slate-400'} />
        <StatCard label="Lean mass" value={`${latest.lean_mass_kg ?? '—'} kg`} sub="" subColor="" />
        <StatCard label="Vòng eo" value={`${latest.waist_cm ?? '—'} cm`} sub="" subColor="" />
      </div>

      {/* Recomp indicator */}
      {weightDiff != null && fatDiff != null && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: weightDiff <= 0 && fatDiff <= 0 ? 'var(--success-bg)' : 'var(--surface-2)', color: weightDiff <= 0 && fatDiff <= 0 ? 'var(--success)' : 'var(--text-3)' }}>
          {weightDiff <= 0 && fatDiff <= 0
            ? '✅ Body recomp đang diễn ra tốt — cân giảm, mỡ giảm'
            : '📈 Đang theo dõi xu hướng — tiếp tục ghi chép đều'}
        </div>
      )}

      {/* Weight + fat chart */}
      <ChartCard title="Cân nặng & Body fat">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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

  const chartData = history.map(h => {
    const maxReps = h.sets.length > 0 ? Math.max(...h.sets.map(s => s.reps)) : 0
    const totalReps = h.sets.reduce((sum, s) => sum + s.reps, 0)
    return {
      date: shortDate(h.date),
      tạ: h.maxWeight,
      volume: h.totalVolume,
      rpe: h.avgRpe,
      maxReps,
      totalReps,
    }
  })
  const latest = history[history.length - 1]
  const prev = history[history.length - 2]

  // Detect bodyweight exercise: tạ = 0 toàn bộ lịch sử
  const isBodyweight = history.length > 0 && history.every(h => h.maxWeight === 0)

  const latestMaxReps = chartData[chartData.length - 1]?.maxReps ?? 0
  const prevMaxReps = chartData[chartData.length - 2]?.maxReps ?? 0
  const latestTotalReps = chartData[chartData.length - 1]?.totalReps ?? 0
  const prevTotalReps = chartData[chartData.length - 2]?.totalReps ?? 0

  const weightUp = !isBodyweight && latest && prev && latest.maxWeight > prev.maxWeight
  const volumeUp = !isBodyweight && latest && prev && latest.totalVolume > prev.totalVolume
  const repsUp = isBodyweight && latestMaxReps > prevMaxReps

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
        <p className="text-xs mb-2" style={{color:"var(--text-3)"}}>Chọn bài tập</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => setSelectedId(ex.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: selectedId === ex.id ? 'var(--brand)' : 'var(--surface)',
                color: selectedId === ex.id ? 'white' : 'var(--text-2)',
                border: `1px solid ${selectedId === ex.id ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-center py-8" style={{color:"var(--text-3)"}}>Đang tải...</p>}

      {!loading && history.length === 0 && <EmptyState text="Chưa có dữ liệu cho bài này." />}

      {!loading && history.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            {isBodyweight ? (
              <>
                <StatCard label="Reps cao nhất" value={`${latestMaxReps}`}
                  sub={prev ? (repsUp ? `↑ từ ${prevMaxReps}` : `= ${prevMaxReps}`) : 'Buổi đầu'}
                  subColor={repsUp ? 'text-green-600' : 'text-slate-400'} />
                <StatCard label="Tổng reps" value={`${latestTotalReps}`}
                  sub={prev ? (latestTotalReps > prevTotalReps ? `↑ từ ${prevTotalReps}` : `= ${prevTotalReps}`) : 'reps'}
                  subColor={latestTotalReps > prevTotalReps ? 'text-green-600' : 'text-slate-400'} />
              </>
            ) : (
              <>
                <StatCard label="Tạ hiện tại" value={`${latest.maxWeight} kg`}
                  sub={prev ? (weightUp ? `↑ từ ${prev.maxWeight}kg` : `= ${prev.maxWeight}kg`) : 'Buổi đầu'}
                  subColor={weightUp ? 'text-green-600' : 'text-slate-400'} />
                <StatCard label="Volume" value={`${latest.totalVolume}`}
                  sub={prev ? (volumeUp ? `↑ từ ${prev.totalVolume}` : `↓ từ ${prev.totalVolume}`) : 'kg tổng'}
                  subColor={volumeUp ? 'text-green-600' : 'text-amber-500'} />
              </>
            )}
            <StatCard label="RPE TB" value={latest.avgRpe != null ? `${latest.avgRpe}` : '—'}
              sub="buổi vừa rồi" subColor="text-slate-400" />
          </div>

          {/* Progressive overload status */}
          {prev && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: (isBodyweight ? repsUp : weightUp) ? 'var(--success-bg)' : (isBodyweight ? latestTotalReps > prevTotalReps : volumeUp) ? 'var(--brand-light)' : 'var(--surface-2)',
                color: (isBodyweight ? repsUp : weightUp) ? 'var(--success)' : (isBodyweight ? latestTotalReps > prevTotalReps : volumeUp) ? 'var(--brand-dark)' : 'var(--text-3)',
              }}>
              {isBodyweight
                ? repsUp
                  ? `✅ Max reps tăng ${prevMaxReps} → ${latestMaxReps} — tiến bộ tốt!`
                  : latestTotalReps > prevTotalReps
                  ? `📈 Tổng reps tăng — đang build endurance`
                  : `⏸ Giữ nguyên — cải thiện form và tốc độ`
                : weightUp
                ? `✅ Đã tăng tạ ${prev.maxWeight}kg → ${latest.maxWeight}kg`
                : volumeUp
                ? `📈 Volume tăng — đang build capacity trước khi tăng tạ`
                : `⏸ Giữ nguyên — tiếp tục cải thiện rep quality`}
            </div>
          )}

          {/* Chart: bodyweight dùng reps, weighted dùng tạ */}
          {isBodyweight ? (
            <ChartCard title="Reps cao nhất mỗi buổi">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={axisStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="maxReps" name="Max reps" stroke={COLORS.lean} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Tạ tối đa mỗi buổi (kg)">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tick={axisStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="tạ" stroke={COLORS.weight2} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Volume / Total reps chart */}
          <ChartCard title={isBodyweight ? "Tổng reps mỗi buổi" : "Volume mỗi buổi (kg tổng)"}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey={isBodyweight ? "totalReps" : "volume"} name={isBodyweight ? "Tổng reps" : "Volume (kg)"} fill={isBodyweight ? COLORS.lean : COLORS.volume} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Recent session detail */}
          {latest.sets.length > 0 && (
            <div className="card p-4">
              <p className="text-xs mb-2" style={{color:"var(--text-3)"}}>Buổi gần nhất — {shortDate(history[history.length - 1].date)}</p>
              <div className="space-y-1">
                {latest.sets.map(s => (
                  <div key={s.set_number} className="flex gap-4 text-xs" style={{color:'var(--text-2)'}}>
                    <span className="w-10" style={{color:'var(--text-3)'}}>Set {s.set_number}</span>
                    <span className="font-medium" style={{color:'var(--text)'}}>
                      {isBodyweight ? `${s.reps} reps` : `${s.weight_kg}kg × ${s.reps}`}
                    </span>
                    {s.rpe != null && <span style={{color:'var(--text-3)'}}>RPE {s.rpe}</span>}
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
function RunningTab({ days }: { days: number }) {
  const [allData, setAllData] = useState<RunWeek[]>([])
  useEffect(() => { fetch('/api/dashboard/running').then(r => r.json()).then(d => setAllData(Array.isArray(d) ? d : [])) }, [])

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const data = days >= 9999 ? allData : allData.filter(w => w.week >= cutoffStr)

  if (!data.length) return <EmptyState text="Chưa có dữ liệu chạy bộ." />

  const latest = data[data.length - 1]
  const prev = data[data.length - 2]

  return (
    <div className="space-y-5">
      {/* This week */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Tuần này" value={`${latest.totalKm} km`}
          sub={prev ? `Tuần trước ${prev.totalKm}km` : `${latest.sessions} buổi`}
          subColor={latest.totalKm >= (prev?.totalKm ?? 0) ? 'text-green-600' : 'text-amber-500'} />
        <StatCard label="Số buổi" value={`${latest.sessions}`} sub="buổi/tuần" subColor="text-gray-500" />
        <StatCard label="Pace TB" value={paceStr(latest.avgPace)} sub="/km" subColor="text-gray-500" />
      </div>

      {/* Run type breakdown */}
      <div className="card p-4">
        <p className="text-xs mb-3" style={{color:"var(--text-3)"}}>Phân bổ buổi chạy tuần này</p>
        <div className="flex gap-3">
          <RunTypeBadge label="Easy" count={latest.easy} bgColor="var(--success-bg)" textColor="var(--success)" />
          <RunTypeBadge label="Tempo" count={latest.tempo} bgColor="var(--warning-bg)" textColor="var(--warning)" />
          <RunTypeBadge label="Interval" count={latest.interval} bgColor="var(--danger-bg)" textColor="var(--danger)" />
        </div>
        {latest.easy >= 1 && latest.tempo >= 1 && (
          <p className="text-xs mt-3" style={{color:"var(--text-3)"}}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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
function RecoveryTab({ refreshKey, days }: { refreshKey: number; days: number }) {
  const [allData, setAllData] = useState<RecoveryPoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    fetch('/api/dashboard/recovery')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setAllData(Array.isArray(d) ? d : [])
      })
      .catch(() => setError('Không thể tải dữ liệu'))
  }, [refreshKey])

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const data = days >= 9999 ? allData : allData.filter(d => d.date >= cutoffStr)

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
          sub={avgSleep ? `TB: ${avgSleep}/100` : ''} subColor={latest.sleep_score != null && latest.sleep_score >= 80 ? 'text-green-600' : 'text-amber-500'} />
        <StatCard label="Thời gian ngủ" value={sleepStr(latest.sleep_duration_min)} sub="hôm nay" subColor="text-gray-500" />
        <StatCard label="Năng lượng" value={latest.energy_level ?? '—'} sub="" subColor="text-gray-500" />
      </div>

      {/* HR trend */}
      {hrData.length > 1 && (
        <ChartCard title="Resting HR theo ngày (thấp hơn = hồi phục tốt hơn)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.map(d => ({ date: shortDate(d.date), hr: d.resting_hr }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} bpm`]} />
              {avgHr && <ReferenceLine y={avgHr} stroke="#CBD5E1" strokeDasharray="3 3" />}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis yAxisId="s" domain={[50, 100]} tick={axisStyle} />
              <YAxis yAxisId="h" orientation="right" domain={[0, 12]} tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine yAxisId="s" y={80} stroke="#CBD5E1" strokeDasharray="3 3" />
              <Line yAxisId="s" type="monotone" dataKey="score" name="Điểm ngủ" stroke={COLORS.sleep} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="h" type="monotone" dataKey="dur" name="Giờ ngủ" stroke={COLORS.km} strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ─── Nutrition Tab ────────────────────────────────────────────
function NutritionTab({ refreshKey, days }: { refreshKey: number; days: number }) {
  const [allData, setAllData] = useState<NutritionPoint[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    fetch('/api/dashboard/nutrition')
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setAllData(Array.isArray(d) ? d : []) })
      .catch(() => setError('Không thể tải dữ liệu'))
  }, [refreshKey])

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const data = days >= 9999 ? allData : allData.filter(d => d.date >= cutoffStr)

  if (error) return <div className="card px-4 py-3 text-sm" style={{ border: '1.5px solid var(--danger)', color: 'var(--danger)' }}>{error}</div>
  if (!data.length) return <EmptyState text="Chưa có dữ liệu dinh dưỡng. Nhấn '+ Ghi chép' → tab Dinh dưỡng." />

  // Tính trung bình
  const withCal = data.filter(d => d.calories != null)
  const withProt = data.filter(d => d.protein_g != null)
  const avgCal = withCal.length ? Math.round(withCal.reduce((s, d) => s + (d.calories ?? 0), 0) / withCal.length) : null
  const avgProt = withProt.length ? Math.round(withProt.reduce((s, d) => s + (d.protein_g ?? 0), 0) / withProt.length) : null
  const latest = data[data.length - 1]
  const daysProteinOk = data.filter(d => (d.protein_g ?? 0) >= 130).length
  const proteinRate = data.length > 0 ? Math.round(daysProteinOk / data.length * 100) : 0

  const chartData = data.map(d => ({
    date: shortDate(d.date),
    calories: d.calories,
    protein: d.protein_g,
    carbs: d.carbs_g,
    fat: d.fat_g,
  }))

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Calo TB/ngày" value={avgCal ? `${avgCal} kcal` : '—'}
          sub={latest.calories ? `Hôm qua: ${latest.calories} kcal` : ''}
          subColor="text-slate-400" />
        <StatCard label="Protein TB/ngày" value={avgProt ? `${avgProt}g` : '—'}
          sub={`${proteinRate}% ngày đủ protein`}
          subColor={proteinRate >= 80 ? 'text-green-600' : 'text-amber-500'} />
      </div>

      {/* Protein adequacy indicator */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: proteinRate >= 80 ? 'var(--success-bg)' : 'var(--warning-bg)' }}>
        <span className="text-2xl">{proteinRate >= 80 ? '💪' : '⚠️'}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: proteinRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
            Protein đủ {daysProteinOk}/{data.length} ngày ({proteinRate}%)
          </p>
          <p className="text-xs" style={{ color: proteinRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
            {proteinRate >= 80 ? 'Tốt — đủ điều kiện tăng cơ' : 'Cần tăng protein thêm để hỗ trợ tăng cơ'}
          </p>
        </div>
      </div>

      {/* Calories chart */}
      <ChartCard title="Calo theo ngày (kcal)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis domain={[1200, 'auto']} tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kcal`]} />
            <ReferenceLine y={1800} stroke="#CBD5E1" strokeDasharray="3 3" label={{ value: '1800', position: 'right', fontSize: 10, fill: '#94A3B8' }} />
            <ReferenceLine y={2200} stroke="#CBD5E1" strokeDasharray="3 3" label={{ value: '2200', position: 'right', fontSize: 10, fill: '#94A3B8' }} />
            <Bar dataKey="calories" name="Calo" fill={COLORS.weight} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Protein chart */}
      <ChartCard title="Protein theo ngày (g)">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis domain={[60, 'auto']} tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}g`]} />
            <ReferenceLine y={130} stroke="#16A34A" strokeDasharray="3 3" label={{ value: '130g min', position: 'right', fontSize: 10, fill: '#16A34A' }} />
            <Line type="monotone" dataKey="protein" name="Protein (g)" stroke={COLORS.lean} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Macro breakdown chart */}
      {data.some(d => d.carbs_g != null) && (
        <ChartCard title="Phân bổ macro theo ngày">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={axisStyle} />
              <YAxis tick={axisStyle} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}g`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="protein" name="Protein" stackId="a" fill={COLORS.lean} />
              <Bar dataKey="carbs" name="Carbs" stackId="a" fill={COLORS.warning} />
              <Bar dataKey="fat" name="Fat" stackId="a" fill={COLORS.hr} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div className="card-sm px-4 py-3">
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text)' }}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 font-medium ${subColor}`}>{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>{title}</p>
      {children}
    </div>
  )
}

function RunTypeBadge({ label, count, bgColor, textColor }: { label: string; count: number; bgColor: string; textColor: string }) {
  return (
    <div className="flex-1 rounded-xl px-3 py-2.5 text-center" style={{ background: bgColor }}>
      <p className="text-xl font-bold" style={{ color: textColor }}>{count}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: textColor }}>{label}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────
type TimeRange = '1w' | '1m' | '3m' | 'all'
const TIME_RANGES: { id: TimeRange; label: string; days: number }[] = [
  { id: '1w', label: '1 tuần', days: 7 },
  { id: '1m', label: '1 tháng', days: 30 },
  { id: '3m', label: '3 tháng', days: 90 },
  { id: 'all', label: 'Tất cả', days: 9999 },
]

export default function DashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('body')
  const [refreshKey, setRefreshKey] = useState(0)
  const [timeRange, setTimeRange] = useState<TimeRange>('1m')
  const days = TIME_RANGES.find(r => r.id === timeRange)!.days

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'body', label: 'Cơ thể', icon: '⚖️' },
    { id: 'strength', label: 'Sức mạnh', icon: '🏋️' },
    { id: 'running', label: 'Chạy bộ', icon: '🏃' },
    { id: 'nutrition', label: 'Dinh dưỡng', icon: '🥗' },
    { id: 'recovery', label: 'Phục hồi', icon: '😴' },
  ]

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h1>
          <div className="flex gap-2">
            <button onClick={() => router.push('/coach')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              🤖 AI Coach
            </button>
            <button onClick={() => router.push('/data')}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              📊 Excel
            </button>
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              ↻
            </button>
            <button onClick={() => router.push('/')} className="text-xs" style={{ color: 'var(--text-3)' }}>← Về</button>
          </div>
        </div>

        {/* Time range filter */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {TIME_RANGES.map(r => (
            <button key={r.id} onClick={() => setTimeRange(r.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: timeRange === r.id ? 'var(--brand)' : 'var(--surface-2)',
                color: timeRange === r.id ? 'white' : 'var(--text-3)',
                border: `1px solid ${timeRange === r.id ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              {r.label}
            </button>
          ))}
          <button onClick={() => router.push('/log')}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ml-auto"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            + Ghi chép
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === t.id ? 'var(--surface)' : 'transparent',
                color: tab === t.id ? 'var(--brand)' : 'var(--text-3)',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              <span className="block text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-4">
        {tab === 'body' && <BodyTab refreshKey={refreshKey} days={days} />}
        {tab === 'strength' && <StrengthTab />}
        {tab === 'running' && <RunningTab days={days} />}
        {tab === 'nutrition' && <NutritionTab refreshKey={refreshKey} days={days} />}
        {tab === 'recovery' && <RecoveryTab refreshKey={refreshKey} days={days} />}
      </div>
    </div>
  )
}
