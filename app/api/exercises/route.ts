import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/exercises?template_id=xxx — lấy danh sách exercise (tuỳ chọn lọc theo template)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const templateId = searchParams.get('template_id')

  if (templateId) {
    const { data, error } = await supabase
      .from('template_exercises')
      .select('display_order, exercise:exercises(*)')
      .eq('template_id', templateId)
      .order('display_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data?.map(r => r.exercise) ?? [])
  }

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('muscle_group')
    .order('display_order')

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
