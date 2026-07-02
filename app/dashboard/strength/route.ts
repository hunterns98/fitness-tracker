import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/dashboard/strength?exercise_id=xxx
// Trả về lịch sử set của 1 bài tập theo session (để vẽ progression chart)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const exerciseId = searchParams.get('exercise_id')

  if (!exerciseId) {
    // Không có exercise_id → trả danh sách bài tập có data
    const { data } = await supabase
      .from('workout_sets')
      .select('exercise_id, exercise:exercises(id, name, muscle_group)')
      .order('exercise_id')

    // Deduplicate
    const seen = new Set<string>()
    const unique = (data ?? []).filter(r => {
      if (seen.has(r.exercise_id)) return false
      seen.add(r.exercise_id)
      return true
    })
    return NextResponse.json(unique.map(r => r.exercise))
  }

  // Lấy tất cả sets của bài này, group theo session
  const { data: sets, error } = await supabase
    .from('workout_sets')
    .select('session_id, set_number, reps, weight_kg, rpe, workout_sessions!inner(date)')
    .eq('exercise_id', exerciseId)
    .order('workout_sessions(date)', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group theo session, tính max weight + tổng volume mỗi buổi
  const bySession: Record<string, { date: string; sets: typeof sets; maxWeight: number; totalVolume: number; avgRpe: number | null }> = {}
  for (const s of (sets ?? [])) {
    const date = (s.workout_sessions as any).date as string
    if (!bySession[s.session_id]) {
      bySession[s.session_id] = { date, sets: [], maxWeight: 0, totalVolume: 0, avgRpe: null }
    }
    bySession[s.session_id].sets.push(s)
    bySession[s.session_id].maxWeight = Math.max(bySession[s.session_id].maxWeight, s.weight_kg)
    bySession[s.session_id].totalVolume += s.weight_kg * s.reps
  }

  // Tính avgRpe
  for (const key of Object.keys(bySession)) {
    const g = bySession[key]
    const rpus = g.sets.filter(s => s.rpe != null).map(s => s.rpe as number)
    g.avgRpe = rpus.length ? Math.round((rpus.reduce((a, b) => a + b, 0) / rpus.length) * 10) / 10 : null
  }

  const result = Object.values(bySession)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(g => ({
      date: g.date,
      maxWeight: g.maxWeight,
      totalVolume: Math.round(g.totalVolume),
      avgRpe: g.avgRpe,
      sets: g.sets.map(s => ({ set_number: s.set_number, reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe })),
    }))

  return NextResponse.json(result)
}
