import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/exercises?template_id=xxx&status=active|archived|all
//
// status (mặc định 'active' khi không truyền):
//   active   -> archived_at IS NULL       (mặc định — dùng cho Library, Picker)
//   archived -> archived_at IS NOT NULL   (dùng cho toggle "Hiện đã lưu trữ")
//   all      -> không filter theo archived_at
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const templateId = searchParams.get('template_id')
  const status = searchParams.get('status') ?? 'active'

  if (templateId) {
    const { data, error } = await supabase
      .from('template_exercises')
      .select('display_order, exercise:exercises(*)')
      .eq('template_id', templateId)
      .order('display_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data?.map(r => r.exercise) ?? [])
  }

  let query = supabase
    .from('exercises')
    .select('*')
    .order('muscle_group')
    .order('display_order')

  if (status === 'active') {
    query = query.is('archived_at', null)
  } else if (status === 'archived') {
    query = query.not('archived_at', 'is', null)
  }
  // status === 'all' -> không filter

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/exercises — tạo bài mới
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase.from('exercises').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
