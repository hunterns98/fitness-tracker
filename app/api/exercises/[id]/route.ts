import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  // Guard: chỉ kích hoạt khi request đang ARCHIVE (archived_at: null -> có giá trị).
  // Unarchive (archived_at: null) và các PATCH khác (Edit form không gửi field này) không bị ảnh hưởng.
  if (Object.prototype.hasOwnProperty.call(body, 'archived_at') && body.archived_at) {
    const { data: usedInTemplate } = await supabase
      .from('template_exercises')
      .select('id')
      .eq('exercise_id', id)
      .limit(1)

    if (usedInTemplate && usedInTemplate.length > 0) {
      return NextResponse.json({ error: 'Exercise is used by template' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('exercises')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { data, error } = await supabase.from('exercises').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
