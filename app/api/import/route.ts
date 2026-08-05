import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import crypto from 'crypto'

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

// ADR-011 canonical serialization for import_hash — MUST stay byte-identical
// to the SQL formula used in supabase/sprint3_backfill_import_hash.sql.
// Verified 2026-07-17: matches all 22 backfilled historical sessions exactly.
// TD-01 (Sprint 4.1): công thức này KHÔNG đổi — chỉ đổi cơ chế chống trùng
// (per-row INSERT + catch 23505 thay cho SELECT-trước-rồi-filter).
function computeImportHash(input: {
  date: string
  type: string
  distance_km: number
  duration_seconds: number
}): string {
  const canonical = `${input.date}|${input.type}|${input.distance_km.toFixed(2)}|${input.duration_seconds}`
  return crypto.createHash('sha256').update(canonical).digest('hex')
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

// Validate nutrition rows
function validateNutrition(rows: ImportRow[]): { valid: ImportRow[]; errors: ValidationError[] } {
  const valid: ImportRow[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2

    if (!r.date || !isValidDate(String(r.date))) {
      errors.push({ sheet: 'Dinh dưỡng', row: rowNum, field: 'date', message: 'Ngày không hợp lệ (dùng YYYY-MM-DD)' })
      continue
    }

    valid.push({
      date: String(r.date),
      calories: parseNum(r.calories),
      protein_g: parseNum(r.protein_g),
      carbs_g: parseNum(r.carbs_g),
      fat_g: parseNum(r.fat_g),
      fiber_g: parseNum(r.fiber_g),
      water_adequate: r.water_adequate !== undefined ? Boolean(r.water_adequate) : true,
      note: parseStr(r.note),
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
    } else if (sheet === 'nutrition') {
      validation = validateNutrition(rows)
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
      // ============================================================
      // TD-01 (Sprint 4.1) — Running import chuyển từ Application-layer
      // pre-check (SELECT existing hashes -> filter -> bulk INSERT) sang
      // DB-layer constraint-catch (per-row INSERT -> catch Postgres 23505),
      // đúng pattern đã dùng cho Workout Import (app/api/workout/route.ts)
      // và đúng tinh thần ADR-006: "Application layer không chịu trách
      // nhiệm chống duplicate. Database phải đảm bảo."
      //
      // Công thức import_hash KHÔNG đổi (xem computeImportHash ở trên).
      //
      // Insert TỪNG ROW, không bulk: Postgres bulk INSERT là atomic — nếu
      // gộp nhiều rows trong 1 câu lệnh, chỉ cần 1 row bị 23505 sẽ làm cả
      // batch fail, phá vỡ hành vi hiện có "dòng trùng -> skip, dòng mới ->
      // vẫn import". Per-row insert giữ đúng hành vi này.
      // ============================================================

      // Compute import_hash cho từng row hợp lệ. distance_km / duration_seconds
      // là bắt buộc để hash — row thiếu 1 trong 2 bị từ chối ở bước validate
      // (không hash với giá trị placeholder, tránh rủi ro trùng hash giữa
      // các session không liên quan).
      const rowsWithHash: (ImportRow & { import_hash: string })[] = []
      const hashErrors: ValidationError[] = []

      for (let i = 0; i < validation.valid.length; i++) {
        const r = validation.valid[i]
        if (r.distance_km === null || r.duration_seconds === null) {
          hashErrors.push({
            sheet: 'Running',
            row: i + 2,
            field: r.distance_km === null ? 'distance_km' : 'duration_minutes',
            message: 'Thiếu quãng đường hoặc thời gian — không thể tính import_hash để chống trùng lặp',
          })
          continue
        }
        rowsWithHash.push({
          ...r,
          import_hash: computeImportHash({
            date: r.date,
            type: r.type,
            distance_km: r.distance_km,
            duration_seconds: r.duration_seconds,
          }),
        })
      }

      if (hashErrors.length > 0) {
        return NextResponse.json({ errors: hashErrors, valid_count: rowsWithHash.length }, { status: 422 })
      }

      // Per-row INSERT — DB (unique index partial trên import_hash, xem
      // supabase/sprint2_migration_patch1.sql-tương-đương cho workout_sessions)
      // là nguồn sự thật duy nhất cho duplicate detection. Không SELECT-trước.
      let imported = 0
      let skipped = 0
      const insertErrors: ValidationError[] = []

      for (let i = 0; i < rowsWithHash.length; i++) {
        const row = rowsWithHash[i]
        const { error: insertError } = await supabase.from('workout_sessions').insert(row)

        if (insertError) {
          if (insertError.code === '23505') {
            // Unique violation trên import_hash -> đã tồn tại, skip, KHÔNG coi là lỗi
            skipped++
          } else {
            // Lỗi khác (không phải duplicate) -> ghi nhận, không chặn các row còn lại
            insertErrors.push({
              sheet: 'Running',
              row: i + 2,
              field: '',
              message: insertError.message,
            })
          }
          continue
        }
        imported++
      }

      if (insertErrors.length > 0) {
        return NextResponse.json({ errors: insertErrors, valid_count: imported }, { status: 422 })
      }

      return NextResponse.json({
        imported,
        skipped,
        errors: [],
        message: skipped > 0 ? `Đã import ${imported} buổi. Bỏ qua ${skipped} buổi đã tồn tại (import_hash trùng).` : undefined
      })
    } else if (sheet === 'nutrition') {
      result = await supabase.from('nutrition_logs').upsert(validation.valid, { onConflict: 'date' })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ imported: validation.valid.length, errors: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
