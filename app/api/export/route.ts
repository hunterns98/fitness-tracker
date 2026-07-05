import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [body, sleep, sessions, sets, exercises] = await Promise.all([
    supabase.from('body_metrics').select('*').order('date'),
    supabase.from('sleep_recovery_logs').select('*').order('date'),
    supabase.from('workout_sessions').select('*, workout_templates(name, run_type)').order('date'),
    supabase.from('workout_sets').select('*, exercises(name, muscle_group)').order('created_at'),
    supabase.from('exercises').select('*').order('muscle_group').order('name'),
  ])

  return NextResponse.json({
    body_metrics: body.data ?? [],
    sleep_recovery: sleep.data ?? [],
    workout_sessions: (sessions.data ?? []).map(s => ({
      id: s.id,
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
    workout_sets: (sets.data ?? []).map(s => ({
      session_id: s.session_id,
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
