import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const [sessionRes, setsRes] = await Promise.all([
    supabase.from('workout_sessions').select('*, workout_templates(name, run_type, target_pace, target_hr_range)').eq('id', id).single(),
    supabase.from('workout_sets').select('*, exercise:exercises(*)').eq('session_id', id).order('exercise_id').order('set_number'),
  ])

  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 })
  return NextResponse.json({ session: sessionRes.data, sets: setsRes.data ?? [] })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const { data, error } = await supabase.from('workout_sessions').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
