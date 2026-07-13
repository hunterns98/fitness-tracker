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

  // Nếu có template_id → Partial Snapshot vào session_exercises (ADR-004)
  // Chỉ copy workout-specific data, không copy exercise metadata
  if (session.template_id) {
    const { data: templateExercises, error: teError } = await supabase
      .from('template_exercises')
      .select('display_order, exercise_id, exercises(target_sets, target_reps)')
      .eq('template_id', session.template_id)
      .order('display_order')

    if (!teError && templateExercises?.length) {
      const snapshot = templateExercises.map(te => {
        const ex = te.exercises as any
        return {
          session_id: session.id,
          exercise_id: te.exercise_id,
          display_order: te.display_order,
          target_sets: ex?.target_sets ?? null,
          target_reps: ex?.target_reps ?? null,
          notes: null,
          created_from_template_id: session.template_id,
        }
      })

      const { error: snapshotError } = await supabase
        .from('session_exercises')
        .insert(snapshot)

      if (snapshotError) {
        // Non-fatal: session đã tạo thành công, fallback sẽ dùng template_exercises
        console.error('Snapshot error (non-fatal):', snapshotError.message)
      }
    }
  }

  return NextResponse.json(session, { status: 201 })
}
