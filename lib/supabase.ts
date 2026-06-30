import { createClient } from '@supabase/supabase-js'

// Server-side only — uses SERVICE ROLE KEY, never exposed to client
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ---- Type definitions (mirror schema.sql) ----

export type Exercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  technique_cue: string | null
  notes: string | null
  display_order: number
}

export type WorkoutTemplate = {
  id: string
  name: string
  type: 'strength' | 'run'
  target_pace: string | null
  target_hr_range: string | null
  run_type: 'easy' | 'tempo' | 'interval' | null
}

export type TemplateExercise = {
  id: string
  template_id: string
  exercise_id: string
  display_order: number
  exercise: Exercise
}

export type WorkoutSession = {
  id: string
  date: string
  template_id: string | null
  name_override: string | null
  type: 'strength' | 'run'
  duration_seconds: number | null
  distance_km: number | null
  avg_pace_seconds: number | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  feeling_note: string | null
  created_at: string
}

export type WorkoutSet = {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  note: string | null
}

export type BodyMetrics = {
  date: string
  weight_kg: number | null
  body_fat_pct: number | null
  lean_mass_kg: number | null
  waist_cm: number | null
  chest_cm: number | null
}
