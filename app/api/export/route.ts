import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [body, sleep, sessions, sets, exercises, sessionExercises] = await Promise.all([
    supabase.from('body_metrics').select('*').order('date'),
    supabase.from('sleep_recovery_logs').select('*').order('date'),
    supabase.from('workout_sessions').select('*, workout_templates(name, run_type)').order('date'),
    supabase.from('workout_sets').select('*, exercises(name, muscle_group)').order('created_at'),
    supabase.from('exercises').select('*').order('muscle_group').order('name'),
    // ADR-008 (D3): session_exercises THẬT (chỉ session tạo từ Sprint 3 Phase 2.5 trở đi)
    supabase.from('session_exercises').select('*, exercises(name, muscle_group)').order('display_order'),
  ])

  // ── ADR-008 (D3): session_ref ─────────────────────────────────
  // Số thứ tự sinh TẠI THỜI ĐIỂM EXPORT, chỉ gán cho session type='strength'.
  // KHÔNG lưu vào DB — chỉ tồn tại trong file export để nối 3 sheet lại với
  // nhau lúc import (session_id thật chưa tồn tại tại thời điểm đó, D2).
  const strengthSessions = (sessions.data ?? []).filter(s => s.type === 'strength')
  const sessionRefMap = new Map<string, number>()
  strengthSessions.forEach((s, i) => sessionRefMap.set(s.id, i + 1))

  // ── ADR-008 phụ lục D3b: Legacy Session Compatibility ──────────
  // Session type=strength không có session_exercises thật (tạo trước Sprint 3
  // Phase 2.5, dùng fallback template_exercises theo ADR-001) → derive dữ liệu
  // tương đương từ template_exercises JOIN exercises, để export/backup không
  // mất khả năng khôi phục các session này. Logic derive giống hệt cách
  // GET /api/session-exercises Path 2 phục vụ fallback hiển thị.
  const sessionIdsWithRealSnapshot = new Set((sessionExercises.data ?? []).map(se => se.session_id))
  const legacySessions = strengthSessions.filter(
    s => !sessionIdsWithRealSnapshot.has(s.id) && s.template_id
  )

  type DerivedSessionExercise = {
    session_id: string
    exercise_id: string | null
    exercise_name: string
    muscle_group: string
    display_order: number
    target_sets: number | null
    target_reps: string | null
    notes: null
  }

  let derivedSessionExercises: DerivedSessionExercise[] = []

  if (legacySessions.length > 0) {
    const templateIds = [...new Set(legacySessions.map(s => s.template_id as string))]

    const { data: templateExercises } = await supabase
      .from('template_exercises')
      .select('template_id, display_order, exercise:exercises(id, name, muscle_group, target_sets, target_reps)')
      .in('template_id', templateIds)
      .order('display_order')

    const byTemplateId = new Map<string, typeof templateExercises>()
    for (const te of (templateExercises ?? [])) {
      const tid = te.template_id as string
      if (!byTemplateId.has(tid)) byTemplateId.set(tid, [])
      byTemplateId.get(tid)!.push(te)
    }

    for (const s of legacySessions) {
      const tes = byTemplateId.get(s.template_id as string) ?? []
      for (const te of tes) {
        const ex = te.exercise as any
        derivedSessionExercises.push({
          session_id: s.id,
          exercise_id: ex?.id ?? null,
          exercise_name: ex?.name ?? '',
          muscle_group: ex?.muscle_group ?? '',
          display_order: te.display_order,
          target_sets: ex?.target_sets ?? null,
          target_reps: ex?.target_reps ?? null,
          notes: null,
        })
      }
    }
  }

  // ── Gộp session_exercises thật + derived (legacy) thành 1 danh sách thống nhất ──
  const realSessionExerciseRows = (sessionExercises.data ?? []).map(se => ({
    session_id: se.session_id,
    exercise_id: se.exercise_id,
    exercise_name: (se.exercises as any)?.name ?? '',
    muscle_group: (se.exercises as any)?.muscle_group ?? '',
    display_order: se.display_order,
    target_sets: se.target_sets,
    target_reps: se.target_reps,
    notes: se.notes,
  }))

  const allSessionExerciseRows = [...realSessionExerciseRows, ...derivedSessionExercises]

  return NextResponse.json({
    body_metrics: body.data ?? [],
    sleep_recovery: sleep.data ?? [],
    workout_sessions: (sessions.data ?? []).map(s => ({
      id: s.id,
      session_ref: sessionRefMap.get(s.id) ?? null, // chỉ có giá trị với type='strength'
      date: s.date,
      type: s.type,
      name: s.name_override ?? (s.workout_templates as any)?.name ?? s.type,
      duration_minutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
      distance_km: s.distance_km,
      avg_pace_mmss: s.avg_pace_seconds ? `${Math.floor(s.avg_pace_seconds/60)}:${(s.avg_pace_seconds%60).toString().padStart(2,'0')}` : null,
      avg_hr: s.avg_hr,
      max_hr: s.max_hr,
      calories: s.calories,
      feeling_note: s.feeling_note,
    })),
    // ADR-008 (D3 + D3b): Session Exercises — thật + derived cho legacy session,
    // nối bằng session_ref
    session_exercises: allSessionExerciseRows
      .filter(se => sessionRefMap.has(se.session_id))
      .map(se => ({
        session_ref: sessionRefMap.get(se.session_id),
        exercise_id: se.exercise_id,
        exercise_name: se.exercise_name,
        muscle_group: se.muscle_group,
        display_order: se.display_order,
        target_sets: se.target_sets,
        target_reps: se.target_reps,
        notes: se.notes,
      })),
    // ADR-008 (D1): exercise_id — identity chính thức để import match.
    // ADR-008 (D3): session_id (UUID thật) đổi thành session_ref.
    workout_sets: (sets.data ?? [])
      .filter(s => sessionRefMap.has(s.session_id))
      .map(s => ({
        session_ref: sessionRefMap.get(s.session_id),
        exercise_id: s.exercise_id,
        exercise: (s.exercises as any)?.name ?? '',
        muscle_group: (s.exercises as any)?.muscle_group ?? '',
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        rpe: s.rpe,
        note: s.note,
      })),
    exercises: exercises.data ?? [],
  })
}
