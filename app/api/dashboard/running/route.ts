import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Lấy sessions chạy bộ
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id, date, distance_km, avg_pace_seconds, avg_hr, calories, template_id')
    .eq('type', 'run')
    .not('distance_km', 'is', null)
    .order('date', { ascending: true })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sessions?.length) return NextResponse.json([])

  // Lấy template info riêng
  const templateIds = [...new Set(sessions.filter(s => s.template_id).map(s => s.template_id!))]
  let templateMap: Record<string, string> = {}
  if (templateIds.length) {
    const { data: templates } = await supabase
      .from('workout_templates')
      .select('id, run_type')
      .in('id', templateIds)
    for (const t of (templates ?? [])) templateMap[t.id] = t.run_type ?? ''
  }

  // Group theo tuần (lấy thứ 2 đầu tuần)
  const byWeek: Record<string, {
    week: string; weekLabel: string; totalKm: number
    sessions: number; easy: number; tempo: number; interval: number
    totalPace: number; paceCount: number
  }> = {}

  for (const s of sessions) {
    const d = new Date(s.date + 'T00:00:00')
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(d)
    mon.setDate(d.getDate() + diff)
    const weekKey = mon.toISOString().split('T')[0]
    const weekLabel = `${mon.getDate()}/${mon.getMonth() + 1}`

    if (!byWeek[weekKey]) {
      byWeek[weekKey] = { week: weekKey, weekLabel, totalKm: 0, sessions: 0, easy: 0, tempo: 0, interval: 0, totalPace: 0, paceCount: 0 }
    }

    const w = byWeek[weekKey]
    w.totalKm = Math.round((w.totalKm + (s.distance_km ?? 0)) * 10) / 10
    w.sessions++

    const runType = s.template_id ? (templateMap[s.template_id] ?? '') : ''
    if (runType === 'easy') w.easy++
    else if (runType === 'tempo') w.tempo++
    else if (runType === 'interval') w.interval++

    if (s.avg_pace_seconds) {
      w.totalPace += s.avg_pace_seconds
      w.paceCount++
    }
  }

  const result = Object.values(byWeek)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      week: w.week,
      weekLabel: w.weekLabel,
      totalKm: w.totalKm,
      sessions: w.sessions,
      easy: w.easy,
      tempo: w.tempo,
      interval: w.interval,
      avgPace: w.paceCount > 0 ? Math.round(w.totalPace / w.paceCount) : null,
    }))

  return NextResponse.json(result)
}
