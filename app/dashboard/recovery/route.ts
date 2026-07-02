import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('sleep_recovery_logs')
    .select('date, resting_hr, sleep_score, sleep_duration_min, wake_count, energy_level, note')
    .order('date', { ascending: true })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
