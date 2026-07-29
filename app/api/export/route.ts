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
    // ADR-008 (D3): cần cho sheet "Session Exercises" — target_sets/target_reps snapshot
    supabase.from('session_exercises').select('*, exercises(name, muscle_group)').order('display_order'),
  ])

  // ── ADR-008 (D3): session_ref ─────────────────────────────────
  // Số thứ tự sinh TẠI THỜI ĐIỂM EXPORT, chỉ gán cho session type='strength'
  // (Session Exercises / Workout Sets chỉ có ý nghĩa với kháng lực).
  // KHÔNG lưu vào DB — chỉ tồn tại trong file export để nối 3 sheet lại với nhau
  // lúc import, vì session_id thật chưa tồn tại tại thời điểm đó (ADR-008 D2).
  const strengthSessions = (sessions.data ?? []).filter(s => s.type === 'strength')
  const sessionRefMap = new Map<string, number>()
  strengthSessions.forEach((s, i) => sessionRefMap.set(s.id, i + 1))

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
    // ADR-008 (D3): Session Exercises — snapshot target, nối bằng session_ref
    session_exercises: (sessionExercises.data ?? [])
      .filter(se => sessionRefMap.has(se.session_id))
      .map(se => ({
        session_ref: sessionRefMap.get(se.session_id),
        exercise_id: se.exercise_id,
        exercise_name: (se.exercises as any)?.name ?? '',
        muscle_group: (se.exercises as any)?.muscle_group ?? '',
        display_order: se.display_order,
        target_sets: se.target_sets,
        target_reps: se.target_reps,
        notes: se.notes,
      })),
    // ADR-008 (D1): thêm exercise_id — identity chính thức để import match.
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
