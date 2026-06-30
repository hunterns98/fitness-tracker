import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/sessions/[id] — session + all its sets (with exercise info)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const [sessionRes, setsRes] = await Promise.all([
    supabase.from('workout_sessions').select('*').eq('id', id).single(),
    supabase
      .from('workout_sets')
      .select('*, exercise:exercises(*)')
      .eq('session_id', id)
      .order('exercise_id')
      .order('set_number'),
  ])

  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 })

  return NextResponse.json({ session: sessionRes.data, sets: setsRes.data ?? [] })
}

// PATCH /api/sessions/[id] — update session fields (duration, feeling_note, etc.)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('workout_sessions')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/sessions/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
