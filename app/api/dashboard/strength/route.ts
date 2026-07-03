import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const exerciseId = searchParams.get('exercise_id')

  // Không có exercise_id → trả danh sách bài có data
  if (!exerciseId) {
    const { data: setRows, error } = await supabase
      .from('workout_sets')
      .select('exercise_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!setRows?.length) return NextResponse.json([])

    const ids = [...new Set(setRows.map(r => r.exercise_id))]
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name, muscle_group')
      .in('id', ids)
      .order('muscle_group')

    return NextResponse.json(exercises ?? [])
  }

  // Lấy sets của bài này
  const { data: sets, error } = await supabase
    .from('workout_sets')
    .select('session_id, set_number, reps, weight_kg, rpe')
    .eq('exercise_id', exerciseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sets?.length) return NextResponse.json([])

  // Lấy session dates
  const sessionIds = [...new Set(sets.map(s => s.session_id))]
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, date')
    .in('id', sessionIds)

  if (!sessions?.length) return NextResponse.json([])

  const dateById: Record<string, string> = {}
  for (const s of sessions) dateById[s.id] = s.date

  // Group theo session
  const bySession: Record<string, {
    date: string
    sets: typeof sets
    maxWeight: number
    totalVolume: number
  }> = {}

  for (const s of sets) {
    const date = dateById[s.session_id]
    if (!date) continue
    if (!bySession[s.session_id]) {
      bySession[s.session_id] = { date, sets: [], maxWeight: 0, totalVolume: 0 }
    }
    bySession[s.session_id].sets.push(s)
    bySession[s.session_id].maxWeight = Math.max(bySession[s.session_id].maxWeight, s.weight_kg)
    bySession[s.session_id].totalVolume += s.weight_kg * s.reps
  }

  const result = Object.values(bySession)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(g => {
      const rpus = g.sets.filter(s => s.rpe != null).map(s => s.rpe as number)
      const avgRpe = rpus.length ? Math.round(rpus.reduce((a, b) => a + b, 0) / rpus.length * 10) / 10 : null
      return {
        date: g.date,
        maxWeight: g.maxWeight,
        totalVolume: Math.round(g.totalVolume),
        avgRpe,
        sets: g.sets.map(s => ({
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: s.weight_kg,
          rpe: s.rpe,
        })),
      }
    })

  return NextResponse.json(result)
}
