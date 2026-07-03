import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('date, weight_kg, body_fat_pct, lean_mass_kg, waist_cm, hip_cm, arm_cm, thigh_cm')
    .order('date', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
