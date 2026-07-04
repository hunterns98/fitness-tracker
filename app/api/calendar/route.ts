import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/calendar?year=2026&month=7
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0] // last day of month

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, date, type, name_override, workout_templates(name)')
    .gte('date', start)
    .lte('date', end)
    .order('date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by date
  const byDate: Record<string, { date: string; types: string[]; sessions: any[] }> = {}
  for (const s of (data ?? [])) {
    if (!byDate[s.date]) byDate[s.date] = { date: s.date, types: [], sessions: [] }
    if (!byDate[s.date].types.includes(s.type)) byDate[s.date].types.push(s.type)
    byDate[s.date].sessions.push({
      id: s.id,
      type: s.type,
      name: s.name_override ?? (s.workout_templates as any)?.name ?? s.type,
    })
  }

  return NextResponse.json(Object.values(byDate))
}
