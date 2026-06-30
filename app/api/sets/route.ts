import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/sets — save a completed set
export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('workout_sets')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// GET /api/sets?exercise_id=xxx&limit=1
// Trả về session + sets của buổi TRƯỚC NHẤT có cùng exercise
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const exerciseId = searchParams.get('exercise_id')
  const sessionId = searchParams.get('session_id')    // exclude current session

  if (!exerciseId) return NextResponse.json([])

  // Tìm session gần nhất chứa exercise này (không tính session hiện tại)
  let sessionsQuery = supabase
    .from('workout_sets')
    .select('session_id, workout_sessions!inner(date)')
    .eq('exercise_id', exerciseId)
    .order('workout_sessions(date)', { ascending: false })
    .limit(20)

  const { data: setRows } = await sessionsQuery

  if (!setRows || setRows.length === 0) return NextResponse.json([])

  // Lấy session_id đầu tiên khác session hiện tại
  const prevSessionId = setRows.find(r => r.session_id !== sessionId)?.session_id
  if (!prevSessionId) return NextResponse.json([])

  const { data: prevSets } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('session_id', prevSessionId)
    .eq('exercise_id', exerciseId)
    .order('set_number')

  return NextResponse.json(prevSets ?? [])
}

// DELETE /api/sets?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('workout_sets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
