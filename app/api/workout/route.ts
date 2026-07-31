import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/import/workout
//
// ADR-008 — Bước 3: Insert thật cho Workout Import.
// Body: { sessions: WorkoutImportSessionPayload[] }
// Mỗi phần tử đã được client validate và gộp theo session_ref (ADR-008 D3),
// sẵn sàng để tạo session mới hoàn toàn (D2). Server KHÔNG validate lại
// referential integrity (đã làm ở client, Bước 2) — chỉ chịu trách nhiệm
// insert + duplicate detection (D4) + compensating delete (D6).

type WorkoutImportSet = {
  exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  note: string | null
}

type WorkoutImportExercise = {
  exercise_id: string
  display_order: number
  target_sets: number | null
  target_reps: string | null
  notes: string | null
}

type WorkoutImportSessionPayload = {
  session_ref: number
  date: string
  name: string | null
  duration_minutes: number | null
  distance_km: number | null
  avg_pace_mmss: string | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  feeling_note: string | null
  exercises: WorkoutImportExercise[]
  sets: WorkoutImportSet[]
}

type SessionResult = {
  session_ref: number
  status: 'created' | 'skipped_duplicate' | 'failed'
  message?: string
}

// ADR-008 D4: sha256(date + type + name_override + canonical sets), không salt.
// Chỉ hash trên SETS (không gồm target_sets/target_reps của session_exercises)
// — đúng công thức đã chốt ở Architecture Review.
function computeImportHash(date: string, name: string | null, sets: WorkoutImportSet[]): string {
  const canonical = [...sets]
    .sort((a, b) => {
      if (a.exercise_id !== b.exercise_id) return a.exercise_id < b.exercise_id ? -1 : 1
      return a.set_number - b.set_number
    })
    .map(s => `${s.exercise_id}|${s.set_number}|${s.reps ?? ''}|${s.weight_kg ?? ''}|${s.rpe ?? ''}`)
    .join(';')
  const raw = `${date}|strength|${name ?? ''}|${canonical}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

function parsePaceToSeconds(mmss: string | null): number | null {
  if (!mmss) return null
  const parts = String(mmss).split(':')
  if (parts.length !== 2) return null
  const m = parseInt(parts[0], 10)
  const s = parseInt(parts[1], 10)
  if (isNaN(m) || isNaN(s)) return null
  return m * 60 + s
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sessionsInput: WorkoutImportSessionPayload[] = Array.isArray(body?.sessions) ? body.sessions : []

  if (sessionsInput.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const results: SessionResult[] = []

  // ADR-008 D6: Application-layer, tuần tự từng session_ref. Một session lỗi
  // không chặn các session_ref còn lại (continue), không dùng transaction DB.
  for (const s of sessionsInput) {
    const importHash = computeImportHash(s.date, s.name, s.sets)
    const durationSeconds = s.duration_minutes != null ? Math.round(s.duration_minutes * 60) : null
    const avgPaceSeconds = parsePaceToSeconds(s.avg_pace_mmss)

    // ADR-008 D4: insert thẳng, bắt unique violation (Postgres 23505) trên
    // import_hash. KHÔNG select-trước-rồi-check.
    const { data: insertedSession, error: sessionError } = await supabase
      .from('workout_sessions')
      .insert({
        date: s.date,
        template_id: null,
        name_override: s.name,
        type: 'strength',
        duration_seconds: durationSeconds,
        distance_km: s.distance_km,
        avg_pace_seconds: avgPaceSeconds,
        avg_hr: s.avg_hr,
        max_hr: s.max_hr,
        calories: s.calories,
        feeling_note: s.feeling_note,
        import_hash: importHash,
      })
      .select()
      .single()

    if (sessionError) {
      if (sessionError.code === '23505') {
        results.push({ session_ref: s.session_ref, status: 'skipped_duplicate', message: 'Đã tồn tại (trùng import_hash) — không tạo lại' })
      } else {
        results.push({ session_ref: s.session_ref, status: 'failed', message: sessionError.message })
      }
      continue
    }

    const sessionId = insertedSession.id
    let stepFailed = false
    let failMessage = ''

    // ADR-008 D3/D5: snapshot session_exercises từ payload, cho phép exercise
    // đã archived (D5 — backward-looking, khác luồng Editor forward-looking).
    if (s.exercises.length > 0) {
      const { error: seError } = await supabase
        .from('session_exercises')
        .insert(s.exercises.map(e => ({
          session_id: sessionId,
          exercise_id: e.exercise_id,
          display_order: e.display_order,
          target_sets: e.target_sets,
          target_reps: e.target_reps,
          notes: e.notes,
          created_from_template_id: null,
        })))
      if (seError) {
        stepFailed = true
        failMessage = `Lỗi khi tạo session_exercises: ${seError.message}`
      }
    }

    if (!stepFailed && s.sets.length > 0) {
      const { error: setsError } = await supabase
        .from('workout_sets')
        .insert(s.sets.map(st => ({
          session_id: sessionId,
          exercise_id: st.exercise_id,
          set_number: st.set_number,
          reps: st.reps,
          weight_kg: st.weight_kg,
          rpe: st.rpe,
          note: st.note,
        })))
      if (setsError) {
        stepFailed = true
        failMessage = `Lỗi khi tạo workout_sets: ${setsError.message}`
      }
    }

    if (stepFailed) {
      // ADR-008 D6: Compensating delete — xóa workout_sessions (CASCADE có sẵn
      // trong schema tự động xóa session_exercises + workout_sets liên quan).
      // Không dùng PostgreSQL Function/RPC/transaction.
      await supabase.from('workout_sessions').delete().eq('id', sessionId)
      results.push({ session_ref: s.session_ref, status: 'failed', message: failMessage })
      continue
    }

    results.push({ session_ref: s.session_ref, status: 'created' })
  }

  return NextResponse.json({ results })
}
