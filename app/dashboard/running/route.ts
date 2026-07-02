import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('date, distance_km, avg_pace_seconds, avg_hr, max_hr, calories, workout_templates(run_type, name)')
    .eq('type', 'run')
    .not('distance_km', 'is', null)
    .order('date', { ascending: true })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group theo tuần ISO (Mon-Sun)
  const byWeek: Record<string, {
    week: string
    weekLabel: string
    totalKm: number
    sessions: number
    easy: number; tempo: number; interval: number
    avgPace: number | null
    paceCount: number
  }> = {}

  for (const s of (data ?? [])) {
    const d = new Date(s.date + 'T00:00:00')
    // Lấy thứ 2 của tuần đó
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1 - day)
    const mon = new Date(d)
    mon.setDate(d.getDate() + diff)
    const weekKey = mon.toISOString().split('T')[0]
    const weekLabel = `${mon.getDate()}/${mon.getMonth() + 1}`

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = { week: weekKey, weekLabel, totalKm: 0, sessions: 0, easy: 0, tempo: 0, interval: 0, avgPace: null, paceCount: 0 }
    }

    const w = byWeek[weekKey]
    w.totalKm = Math.round((w.totalKm + (s.distance_km ?? 0)) * 10) / 10
    w.sessions++

    const runType = (s.workout_templates as any)?.run_type ?? ''
    if (runType === 'easy') w.easy++
    else if (runType === 'tempo') w.tempo++
    else if (runType === 'interval') w.interval++

    if (s.avg_pace_seconds) {
      w.avgPace = ((w.avgPace ?? 0) * w.paceCount + s.avg_pace_seconds) / (w.paceCount + 1)
      w.paceCount++
    }
  }

  const result = Object.values(byWeek)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      ...w,
      avgPace: w.avgPace ? Math.round(w.avgPace) : null,
    }))

  return NextResponse.json(result)
}
