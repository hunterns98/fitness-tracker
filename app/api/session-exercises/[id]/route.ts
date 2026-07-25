import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/session-exercises/:id
//
// Chặn xóa nếu exercise này đã có workout_sets đã log trong session -> 409.
// Không bao giờ tự động xóa workout_sets (bảo toàn lịch sử tập luyện).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const { data: row, error: rowError } = await supabase
    .from('session_exercises')
    .select('id, session_id, exercise_id')
    .eq('id', id)
    .single()

  if (rowError || !row) {
    return NextResponse.json({ error: 'Session exercise not found' }, { status: 404 })
  }

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('id')
    .eq('session_id', row.session_id)
    .eq('exercise_id', row.exercise_id)
    .limit(1)

  if (sets && sets.length > 0) {
    return NextResponse.json({ error: 'Exercise already has logged sets' }, { status: 409 })
  }

  const { error: deleteError } = await supabase
    .from('session_exercises')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
