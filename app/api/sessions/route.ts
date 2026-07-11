import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const type = searchParams.get('type')
  const date = searchParams.get('date')
  const templateId = searchParams.get('template_id')

  let query = supabase
    .from('workout_sessions')
    .select('*, workout_templates(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) query = query.eq('type', type)
  if (date) query = query.eq('date', date)
  if (templateId) query = query.eq('template_id', templateId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Tạo session
  const { data: session, error } = await supabase
    .from('workout_sessions')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nếu có template_id → snapshot template_exercises sang session_exercises (AD-02: Full Snapshot)
  if (session.template_id) {
    const { data: templateExercises, error: teError } = await supabase
      .from('template_exercises')
      .select('display_order, exercise:exercises(id, name, muscle_group, target_sets, target_reps, technique_cue, current_weight_kg)')
      .eq('template_id', session.template_id)
      .order('display_order')

    if (!teError && templateExercises?.length) {
      const snapshot = templateExercises.map(te => {
        const ex = te.exercise as any
        return {
          session_id: session.id,
          exercise_id: ex.id,
          exercise_name: ex.name,
          muscle_group: ex.muscle_group,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          technique_cue: ex.technique_cue,
          display_order: te.display_order,
          created_from_template_id: session.template_id,
        }
      })

      const { error: snapshotError } = await supabase
        .from('session_exercises')
        .insert(snapshot)

      if (snapshotError) {
        // Log lỗi snapshot nhưng không fail session creation
        // Session đã tạo thành công — fallback sẽ dùng template_exercises
        console.error('Snapshot error (non-fatal):', snapshotError.message)
      }
    }
  }

  return NextResponse.json(session, { status: 201 })
}
