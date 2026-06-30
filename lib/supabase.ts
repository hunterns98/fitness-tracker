import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy init — tránh lỗi lúc build khi env var chưa sẵn sàng ở build step.
// Client chỉ thực sự được tạo khi có request gọi tới (runtime).
let _supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. ' +
      'Kiểm tra lại Environment Variables trong Vercel dashboard.'
    )
  }

  _supabase = createClient(supabaseUrl, supabaseKey)
  return _supabase
}

// Proxy giữ nguyên cách dùng `supabase.from(...)` như cũ ở mọi nơi khác trong code
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient()
    return (client as any)[prop]
  },
})

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
