import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/session-exercises?session_id=xxx
//
// Priority:
//   1. session_exercises (snapshot, new sessions)
//   2. template_exercises fallback (old sessions — AD-01: backward compat)
//
// Returns shape compatible với Exercise type trong workout page:
//   { id, name, muscle_group, current_weight_kg, target_sets, target_reps, technique_cue }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  // ── Path 1: session_exercises (snapshot) ──────────────────
  const { data: sessionExercises, error: seError } = await supabase
    .from('session_exercises')
    .select('id, exercise_id, exercise_name, muscle_group, target_sets, target_reps, technique_cue, display_order')
    .eq('session_id', sessionId)
    .order('display_order')

  if (seError) {
    return NextResponse.json({ error: seError.message }, { status: 500 })
  }

  if (sessionExercises && sessionExercises.length > 0) {
    // Snapshot tồn tại → new path
    // Lấy current_weight_kg từ exercises table (live, không snapshot)
    // vì đây là gợi ý tạ hiện tại, không phải historical
    const exerciseIds = sessionExercises
      .filter(se => se.exercise_id != null)
      .map(se => se.exercise_id as string)

    let weightMap: Record<string, number | null> = {}
    if (exerciseIds.length > 0) {
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, current_weight_kg')
        .in('id', exerciseIds)

      for (const ex of (exercises ?? [])) {
        weightMap[ex.id] = ex.current_weight_kg
      }
    }

    const result = sessionExercises.map(se => ({
      // Dùng exercise_id làm id để workout_sets vẫn link đúng
      id: se.exercise_id ?? se.id,
      session_exercise_id: se.id,       // có thể dùng sau cho edit
      name: se.exercise_name,
      muscle_group: se.muscle_group,
      current_weight_kg: se.exercise_id ? (weightMap[se.exercise_id] ?? null) : null,
      target_sets: se.target_sets,
      target_reps: se.target_reps,
      technique_cue: se.technique_cue,
      _source: 'snapshot',              // debug field, không hiển thị UI
    }))

    return NextResponse.json(result)
  }

  // ── Path 2: Fallback sang template_exercises (session cũ — AD-01) ──
  const { data: session } = await supabase
    .from('workout_sessions')
    .select('template_id')
    .eq('id', sessionId)
    .single()

  if (!session?.template_id) {
    return NextResponse.json([])
  }

  const { data: templateExercises, error: teError } = await supabase
    .from('template_exercises')
    .select('display_order, exercise:exercises(id, name, muscle_group, current_weight_kg, target_sets, target_reps, technique_cue)')
    .eq('template_id', session.template_id)
    .order('display_order')

  if (teError) {
    return NextResponse.json({ error: teError.message }, { status: 500 })
  }

  const fallbackResult = (templateExercises ?? []).map(te => ({
    ...(te.exercise as any),
    _source: 'template_fallback',       // debug field
  }))

  return NextResponse.json(fallbackResult)
}
