import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('date, calories, protein_g, carbs_g, fat_g, fiber_g, water_adequate, note')
    .order('date', { ascending: true })
    .limit(90)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
