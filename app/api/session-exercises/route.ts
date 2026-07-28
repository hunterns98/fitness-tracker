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
//
// has_logged_sets (bổ sung — additive, không đổi shape cũ):
//   Cho biết bài này đã có workout_sets log trong session chưa, để client disable nút xóa
//   ngay từ đầu thay vì phải confirm rồi mới nhận lỗi 409 từ DELETE.
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
    // ── MỚI: lấy danh sách exercise_id đã có set log trong session này ──
    const { data: loggedSets } = await supabase
      .from('workout_sets')
      .select('exercise_id')
      .eq('session_id', sessionId)
    const loggedExerciseIds = new Set((loggedSets ?? []).map(r => r.exercise_id))

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
        has_logged_sets: loggedExerciseIds.has(se.exercise_id), // ← MỚI (additive)
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
    has_logged_sets: false, // fallback session không dùng field này (Editor bị ẩn), giữ shape nhất quán
    _source: 'template_fallback',
  }))

  return NextResponse.json(fallbackResult)
}

// POST /api/session-exercises
// Body: { session_id, exercise_id }
//
// Thêm 1 bài tập vào session đang tồn tại (dùng bởi Exercise Picker trong Workout Editor).
// Guard theo Architecture Review đã duyệt:
//   1. Exercise đã archived        -> 409 "Exercise is archived"
//   2. Exercise đã có trong session -> 409 "Exercise already in this session"
//   3. display_order = MAX hiện tại trong session + 1 (1-based, khớp convention template_exercises)
//   4. Snapshot target_sets/target_reps từ exercises tại thời điểm thêm (ADR-004)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { session_id, exercise_id } = body

  if (!session_id || !exercise_id) {
    return NextResponse.json({ error: 'session_id and exercise_id are required' }, { status: 400 })
  }

  // 1. Check exercise tồn tại + archived
  const { data: exercise, error: exError } = await supabase
    .from('exercises')
    .select('id, target_sets, target_reps, archived_at')
    .eq('id', exercise_id)
    .single()

  if (exError || !exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }
  if (exercise.archived_at) {
    return NextResponse.json({ error: 'Exercise is archived' }, { status: 409 })
  }

  // 2. Check duplicate trong session
  const { data: existing } = await supabase
    .from('session_exercises')
    .select('id')
    .eq('session_id', session_id)
    .eq('exercise_id', exercise_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Exercise already in this session' }, { status: 409 })
  }

  // 3. Tính display_order tiếp theo — 1-based, khớp convention template_exercises hiện có
  const { data: maxRow } = await supabase
    .from('session_exercises')
    .select('display_order')
    .eq('session_id', session_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = maxRow ? maxRow.display_order + 1 : 1

  // 4. Insert với snapshot target_sets/target_reps tại thời điểm này (ADR-004)
  const { data: inserted, error: insertError } = await supabase
    .from('session_exercises')
    .insert({
      session_id,
      exercise_id,
      display_order: nextOrder,
      target_sets: exercise.target_sets,
      target_reps: exercise.target_reps,
      notes: null,
      created_from_template_id: null, // thêm thủ công qua Picker, không phải từ template
    })
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
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const ex = inserted.exercise as any
  const result = {
    id: inserted.exercise_id,
    session_exercise_id: inserted.id,
    name: ex?.name ?? 'Bài tập không xác định',
    muscle_group: ex?.muscle_group ?? null,
    current_weight_kg: ex?.current_weight_kg ?? null,
    technique_cue: ex?.technique_cue ?? null,
    target_sets: inserted.target_sets,
    target_reps: inserted.target_reps,
    notes: inserted.notes,
    has_logged_sets: false, // vừa mới thêm, chắc chắn chưa có set nào
    _source: 'session_exercises',
  }

  return NextResponse.json(result, { status: 201 })
}
