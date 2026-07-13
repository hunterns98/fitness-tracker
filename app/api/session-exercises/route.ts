import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/session-exercises?session_id=xxx
//
// Partial Snapshot strategy (ADR-004):
//   - session_exercises lưu: exercise_id, display_order, target_sets, target_reps, notes
//   - Exercise metadata (name, muscle_group, technique_cue...) luôn JOIN từ exercises table
//
// Fallback (ADR-001 backward compat):
//   1. session_exercises tồn tại → new path (snapshot + JOIN)
//   2. session_exercises rỗng → fallback: template_exercises + JOIN exercises (session cũ)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  // ── Path 1: session_exercises snapshot + JOIN exercises ────
  const { data: sessionExercises, error: seError } = await supabase
    .from('session_exercises')
    .select(`
      id,
      exercise_id,
      display_order,
      target_sets,
      target_reps,
      notes,
      created_from_template_id,
      exercise:exercises(
        id,
        name,
        muscle_group,
        current_weight_kg,
        technique_cue
      )
    `)
    .eq('session_id', sessionId)
    .order('display_order')

  if (seError) {
    return NextResponse.json({ error: seError.message }, { status: 500 })
  }

  if (sessionExercises && sessionExercises.length > 0) {
    // New path: dùng session_exercises với metadata từ exercises table
    const result = sessionExercises.map(se => {
      const ex = se.exercise as any
      return {
        // id dùng exercise_id để workout_sets JOIN đúng
        id: se.exercise_id,
        session_exercise_id: se.id,
        name: ex?.name ?? 'Bài tập không xác định',
        muscle_group: ex?.muscle_group ?? null,
        current_weight_kg: ex?.current_weight_kg ?? null,
        technique_cue: ex?.technique_cue ?? null,
        // target từ snapshot (có thể override so với template gốc)
        target_sets: se.target_sets,
        target_reps: se.target_reps,
        notes: se.notes,
        _source: 'session_exercises',
      }
    })

    return NextResponse.json(result)
  }

  // ── Path 2: Fallback → template_exercises (session cũ — ADR-001) ──
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
    _source: 'template_fallback',
  }))

  return NextResponse.json(fallbackResult)
}
