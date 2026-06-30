import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/sessions?limit=20&type=strength
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')
  const type = searchParams.get('type')
  const templateId = searchParams.get('template_id')

  let query = supabase
    .from('workout_sessions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)

  if (type) query = query.eq('type', type)
  if (templateId) query = query.eq('template_id', templateId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/sessions — create a new session
export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
