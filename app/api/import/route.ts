import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ImportRow = Record<string, any>
type ValidationError = { sheet: string; row: number; field: string; message: string }

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d))
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v))
  return isNaN(n) ? null : n
}

function parseStr(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v).trim()
}

// Validate body_metrics rows
function validateBody(rows: ImportRow[]): { valid: ImportRow[]; errors: ValidationError[] } {
  const valid: ImportRow[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2 // header is row 1

    if (!r.date || !isValidDate(String(r.date))) {
      errors.push({ sheet: 'Body Metrics', row: rowNum, field: 'date', message: 'Ngày không hợp lệ (dùng YYYY-MM-DD)' })
      continue
    }

    valid.push({
      date: String(r.date),
      weight_kg: parseNum(r.weight_kg),
      body_fat_pct: parseNum(r.body_fat_pct),
      lean_mass_kg: parseNum(r.lean_mass_kg),
      waist_cm: parseNum(r.waist_cm),
      hip_cm: parseNum(r.hip_cm),
      arm_cm: parseNum(r.arm_cm),
      thigh_cm: parseNum(r.thigh_cm),
      bmi: parseNum(r.bmi),
      note: parseStr(r.note),
    })
  }
  return { valid, errors }
}

// Validate sleep_recovery rows
function validateSleep(rows: ImportRow[]): { valid: ImportRow[]; errors: ValidationError[] } {
  const valid: ImportRow[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2

    if (!r.date || !isValidDate(String(r.date))) {
      errors.push({ sheet: 'Sleep & Recovery', row: rowNum, field: 'date', message: 'Ngày không hợp lệ (dùng YYYY-MM-DD)' })
      continue
    }

    const score = parseNum(r.sleep_score)
    if (score !== null && (score < 0 || score > 100)) {
      errors.push({ sheet: 'Sleep & Recovery', row: rowNum, field: 'sleep_score', message: 'Điểm ngủ phải từ 0-100' })
      continue
    }

    valid.push({
      date: String(r.date),
      resting_hr: parseNum(r.resting_hr),
      sleep_score: score,
      sleep_duration_min: parseNum(r.sleep_duration_min),
      wake_count: parseNum(r.wake_count),
      energy_level: parseStr(r.energy_level),
      note: parseStr(r.note),
    })
  }
  return { valid, errors }
}

// Validate running sessions
function validateRunning(rows: ImportRow[]): { valid: ImportRow[]; errors: ValidationError[] } {
  const valid: ImportRow[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2

    if (!r.date || !isValidDate(String(r.date))) {
      errors.push({ sheet: 'Running', row: rowNum, field: 'date', message: 'Ngày không hợp lệ (dùng YYYY-MM-DD)' })
      continue
    }

    // Parse pace mm:ss → seconds
    let paceSeconds: number | null = null
    if (r.avg_pace_mmss) {
      const parts = String(r.avg_pace_mmss).split(':')
      if (parts.length === 2) {
        paceSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1])
      }
    }

    valid.push({
      date: String(r.date),
      type: 'run',
      name_override: parseStr(r.name) ?? 'Easy Run',
      duration_seconds: r.duration_minutes ? Math.round(parseNum(r.duration_minutes)! * 60) : null,
      distance_km: parseNum(r.distance_km),
      avg_pace_seconds: paceSeconds,
      avg_hr: parseNum(r.avg_hr),
      max_hr: parseNum(r.max_hr),
      calories: parseNum(r.calories),
      feeling_note: parseStr(r.feeling_note),
    })
  }
  return { valid, errors }
}

export async function POST(req: NextRequest) {
  try {
    const { sheet, rows } = await req.json()

    if (!sheet || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 })
    }

    let validation: { valid: ImportRow[]; errors: ValidationError[] }

    if (sheet === 'body_metrics') {
      validation = validateBody(rows)
    } else if (sheet === 'sleep_recovery') {
      validation = validateSleep(rows)
    } else if (sheet === 'running') {
      validation = validateRunning(rows)
    } else {
      return NextResponse.json({ error: `Sheet không hỗ trợ: ${sheet}` }, { status: 400 })
    }

    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors, valid_count: validation.valid.length }, { status: 422 })
    }

    // Insert with upsert on date
    let result
    if (sheet === 'body_metrics') {
      result = await supabase.from('body_metrics').upsert(validation.valid, { onConflict: 'date' })
    } else if (sheet === 'sleep_recovery') {
      result = await supabase.from('sleep_recovery_logs').upsert(validation.valid, { onConflict: 'date' })
    } else if (sheet === 'running') {
      result = await supabase.from('workout_sessions').insert(validation.valid)
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ imported: validation.valid.length, errors: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
