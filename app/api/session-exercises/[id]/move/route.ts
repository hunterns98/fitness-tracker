import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/session-exercises/:id/move
// Body: { direction: 'up' | 'down' }
//
// Hoán đổi display_order với hàng liền kề trong cùng session.
// Ở biên (đầu/cuối) -> no-op, không lỗi, trả nguyên danh sách hiện tại.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { direction } = await req.json()

  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'direction must be "up" or "down"' }, { status: 400 })
  }

  const { data: row, error: rowError } = await supabase
    .from('session_exercises')
    .select('id, session_id')
    .eq('id', id)
    .single()

  if (rowError || !row) {
    return NextResponse.json({ error: 'Session exercise not found' }, { status: 404 })
  }

  const { data: all, error: listError } = await supabase
    .from('session_exercises')
    .select('id, display_order')
    .eq('session_id', row.session_id)
    .order('display_order', { ascending: true })

  if (listError || !all) {
    return NextResponse.json({ error: listError?.message ?? 'Failed to load session exercises' }, { status: 500 })
  }

  const idx = all.findIndex(r => r.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1

  if (idx !== -1 && swapIdx >= 0 && swapIdx < all.length) {
    const current = all[idx]
    const target = all[swapIdx]
    await supabase.from('session_exercises').update({ display_order: target.display_order }).eq('id', current.id)
    await supabase.from('session_exercises').update({ display_order: current.display_order }).eq('id', target.id)
  }
  // else: đã ở biên -> no-op

  const { data: refreshed, error: refreshError } = await supabase
    .from('session_exercises')
    .select(`
      id,
      exercise_id,
      display_order,
      target_sets,
      target_reps,
      notes,
      created_from_template_id,
      exercise:exercises(
        id,
        name,
        muscle_group,
        current_weight_kg,
        technique_cue
      )
    `)
    .eq('session_id', row.session_id)
    .order('display_order', { ascending: true })

  if (refreshError) {
    return NextResponse.json({ error: refreshError.message }, { status: 500 })
  }

  const result = (refreshed ?? []).map(r => {
    const ex = r.exercise as any
    return {
      id: r.exercise_id,
      session_exercise_id: r.id,
      name: ex?.name ?? 'Bài tập không xác định',
      muscle_group: ex?.muscle_group ?? null,
      current_weight_kg: ex?.current_weight_kg ?? null,
      technique_cue: ex?.technique_cue ?? null,
      target_sets: r.target_sets,
      target_reps: r.target_reps,
      notes: r.notes,
      _source: 'session_exercises',
    }
  })

  return NextResponse.json(result)
}
