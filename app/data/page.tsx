'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { stripDiacritics } from '@/lib/text'

type ValidationError = { sheet: string; row?: number; field: string; message: string; sessionRef?: number }
type ImportResult = { imported: number; skipped?: number; errors: ValidationError[]; message?: string }

// ── Field normalization dùng chung cho Import (Body/Sleep/Running/Nutrition + ADR-008 Workout) ──
const IMPORT_FIELD_MAP: Record<string, string> = {
  ngay_yyyy_mm_dd: 'date',
  ngay: 'date',
  can_nang: 'weight_kg',
  body_fat: 'body_fat_pct',
  lean_mass: 'lean_mass_kg',
  vong_eo: 'waist_cm',
  vong_hong: 'hip_cm',
  vong_bap_tay: 'arm_cm',
  vong_dui: 'thigh_cm',
  resting_hr: 'resting_hr',
  diem_ngu: 'sleep_score',
  thoi_gian_ngu: 'sleep_duration_min',
  so_lan_thuc: 'wake_count',
  nang_luong: 'energy_level',
  ten_buoi: 'name',
  loai: 'type',
  thoi_gian: 'duration_minutes',
  quang_duong: 'distance_km',
  pace: 'avg_pace_mmss',
  hr_tb: 'avg_hr',
  hr_max: 'max_hr',
  cam_giac: 'feeling_note',
  ghi_chu: 'note',
  protein: 'protein_g',
  carbs: 'carbs_g',
  chat_beo: 'fat_g',
  chat_xo: 'fiber_g',
  nuoc: 'water_adequate',
  est_calo_in: 'calories',
  // ADR-008 — bổ sung cho 3 sheet Workout
  thu_tu: 'display_order',
  set: 'set_number',
  ta: 'weight_kg',
}

function normalizeRow(r: any): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(r)) {
    const key = stripDiacritics(k).split('(')[0].trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    out[IMPORT_FIELD_MAP[key] ?? key] = v
  }
  return out
}

function isValidDateStr(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d))
}

// ── ADR-008 — Gộp 3 sheet Workout theo session_ref ──
// Hàm THUẦN, không đọc file, không gọi API. Dùng chung bởi validateWorkoutSheets
// (chỉ lấy lỗi) và buildValidWorkoutSessions (lấy payload sẵn sàng insert).
function groupWorkoutRows(
  sessionRows: Record<string, any>[],
  sessionExRows: Record<string, any>[],
  setRows: Record<string, any>[]
) {
  const rowLevelErrors: ValidationError[] = []

  const sessionMetaByRef = new Map<number, Record<string, any>>()
  sessionRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) return // dòng run/other, không thuộc Workout Import
    if (sessionMetaByRef.has(ref)) {
      rowLevelErrors.push({ sheet: 'Workout Sessions', row: i + 2, field: 'session_ref', message: `Session Ref ${ref} bị lặp lại trong sheet Workout Sessions`, sessionRef: ref })
      return
    }
    sessionMetaByRef.set(ref, r)
  })

  const exercisesByRef = new Map<number, Record<string, any>[]>()
  sessionExRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) {
      rowLevelErrors.push({ sheet: 'Session Exercises', row: i + 2, field: 'session_ref', message: 'Thiếu hoặc sai Session Ref' })
      return
    }
    if (!exercisesByRef.has(ref)) exercisesByRef.set(ref, [])
    exercisesByRef.get(ref)!.push(r)
  })

  const setsByRef = new Map<number, Record<string, any>[]>()
  setRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) {
      rowLevelErrors.push({ sheet: 'Workout Sets', row: i + 2, field: 'session_ref', message: 'Thiếu hoặc sai Session Ref' })
      return
    }
    if (!setsByRef.has(ref)) setsByRef.set(ref, [])
    setsByRef.get(ref)!.push(r)
  })

  const allRefs = new Set<number>([...sessionMetaByRef.keys(), ...exercisesByRef.keys(), ...setsByRef.keys()])

  return { sessionMetaByRef, exercisesByRef, setsByRef, allRefs, rowLevelErrors }
}

// ── ADR-008 — Validation cho Workout Import (Bước 2, giữ nguyên hành vi) ──
function validateWorkoutSheets(
  sessionRows: Record<string, any>[],
  sessionExRows: Record<string, any>[],
  setRows: Record<string, any>[]
): ValidationError[] {
  const { sessionMetaByRef, exercisesByRef, setsByRef, allRefs, rowLevelErrors } = groupWorkoutRows(sessionRows, sessionExRows, setRows)
  const errors: ValidationError[] = [...rowLevelErrors]

  for (const ref of allRefs) {
    const meta = sessionMetaByRef.get(ref)
    const exs = exercisesByRef.get(ref) ?? []
    const sets = setsByRef.get(ref) ?? []

    // Orphan (ADR-008 UX — skip toàn bộ session nếu thiếu quan hệ giữa sheet)
    if (!meta) {
      errors.push({ sheet: 'Session Exercises / Workout Sets', field: 'session_ref', message: `Session Ref ${ref} không có dòng tương ứng trong sheet Workout Sessions`, sessionRef: ref })
      continue
    }
    if (!meta.date || !isValidDateStr(String(meta.date))) {
      errors.push({ sheet: 'Workout Sessions', field: 'date', message: `Session Ref ${ref}: ngày không hợp lệ (dùng YYYY-MM-DD)`, sessionRef: ref })
      continue
    }
    if (String(meta.type).trim() !== 'strength') {
      errors.push({ sheet: 'Workout Sessions', field: 'type', message: `Session Ref ${ref}: chỉ hỗ trợ import buổi kháng lực (type=strength)`, sessionRef: ref })
      continue
    }

    // Orphan: exercise_id trong Workout Sets phải khớp exercise_id nào đó
    // trong Session Exercises của CÙNG session_ref (ADR-008 D1 + orphan rule)
    const exIds = new Set(exs.map(e => String(e.exercise_id)))
    const missingEx = sets.filter(s => !exIds.has(String(s.exercise_id)))
    if (missingEx.length > 0) {
      errors.push({ sheet: 'Workout Sets', field: 'exercise_id', message: `Session Ref ${ref}: có set không khớp exercise_id nào trong Session Exercises`, sessionRef: ref })
      continue
    }

    // TODO (Bước sau, nếu cần siết chặt thêm — không bắt buộc cho Bước 3):
    // - Validate target_sets / target_reps trong Session Exercises (kiểu số hợp lệ).
    // - Validate display_order: số nguyên, không trùng nhau trong cùng session_ref.
    // - Validate set_number: số nguyên dương, không trùng (exercise_id, set_number).
    // - Validate reps/weight_kg/rpe: kiểu số hợp lệ, rpe trong khoảng 6-10 nếu có.
  }

  return errors
}

// ── ADR-008 — Payload sẵn sàng insert cho các session_ref KHÔNG có lỗi ──
type WorkoutImportSessionPayload = {
  session_ref: number
  date: string
  name: string | null
  duration_minutes: number | null
  distance_km: number | null
  avg_pace_mmss: string | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  feeling_note: string | null
  exercises: { exercise_id: string; display_order: number; target_sets: number | null; target_reps: string | null; notes: string | null }[]
  sets: { exercise_id: string; set_number: number; reps: number | null; weight_kg: number | null; rpe: number | null; note: string | null }[]
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function buildValidWorkoutSessions(
  sessionRows: Record<string, any>[],
  sessionExRows: Record<string, any>[],
  setRows: Record<string, any>[],
  errors: ValidationError[]
): WorkoutImportSessionPayload[] {
  const { sessionMetaByRef, exercisesByRef, setsByRef, allRefs } = groupWorkoutRows(sessionRows, sessionExRows, setRows)
  const errorRefs = new Set(errors.filter(e => e.sessionRef !== undefined).map(e => e.sessionRef as number))

  const payloads: WorkoutImportSessionPayload[] = []
  for (const ref of allRefs) {
    if (errorRefs.has(ref)) continue
    const meta = sessionMetaByRef.get(ref)
    if (!meta) continue // đã bị coi là lỗi orphan ở validate — phòng hờ, không nên tới đây

    const exs = exercisesByRef.get(ref) ?? []
    const sets = setsByRef.get(ref) ?? []

    payloads.push({
      session_ref: ref,
      date: String(meta.date),
      name: meta.name ?? null,
      duration_minutes: toNumberOrNull(meta.duration_minutes),
      distance_km: toNumberOrNull(meta.distance_km),
      avg_pace_mmss: meta.avg_pace_mmss ?? null,
      avg_hr: toNumberOrNull(meta.avg_hr),
      max_hr: toNumberOrNull(meta.max_hr),
      calories: toNumberOrNull(meta.calories),
      feeling_note: meta.feeling_note ?? null,
      exercises: exs.map(e => ({
        exercise_id: String(e.exercise_id),
        display_order: toNumberOrNull(e.display_order) ?? 0,
        target_sets: toNumberOrNull(e.target_sets),
        target_reps: e.target_reps != null && e.target_reps !== '' ? String(e.target_reps) : null,
        // Lưu ý: cột "Ghi chú" normalize qua IMPORT_FIELD_MAP dùng chung ("ghi_chu" → "note",
        // singular) — nhưng schema session_exercises dùng "notes" (số nhiều). Đọc đúng key
        // đã normalize ("note") rồi gán vào field "notes" của payload.
        notes: (e as any).note ?? null,
      })),
      sets: sets.map(s => ({
        exercise_id: String(s.exercise_id),
        set_number: toNumberOrNull(s.set_number) ?? 0,
        reps: toNumberOrNull(s.reps),
        weight_kg: toNumberOrNull(s.weight_kg),
        rpe: toNumberOrNull(s.rpe),
        note: s.note ?? null,
      })),
    })
  }
  return payloads
}

// ── ADR-008 — Kết quả cuối cùng cho từng session_ref (validate + insert) ──
type WorkoutSessionOutcome = {
  session_ref: number
  status: 'created' | 'skipped_duplicate' | 'skipped_invalid' | 'failed'
  errors?: ValidationError[]
  message?: string
}

// ── ADR-008 — Bước 3: đọc 3 sheet Workout, validate, insert thật, trả outcome ──
// Tách hoàn toàn khỏi importFromFile() — không ảnh hưởng luồng Body/Sleep/
// Running/Nutrition. Trả về null nếu file không có sheet Workout nào.
async function importWorkoutData(wb: XLSX.WorkBook): Promise<WorkoutSessionOutcome[] | null> {
  const hasWorkoutSheets = ['Workout Sessions', 'Session Exercises', 'Workout Sets'].some(n => wb.SheetNames.includes(n))
  if (!hasWorkoutSheets) return null

  const sessionRows = wb.SheetNames.includes('Workout Sessions')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Workout Sessions']).map(normalizeRow) : []
  const sessionExRows = wb.SheetNames.includes('Session Exercises')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Session Exercises']).map(normalizeRow) : []
  const setRows = wb.SheetNames.includes('Workout Sets')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Workout Sets']).map(normalizeRow) : []

  const errors = validateWorkoutSheets(sessionRows, sessionExRows, setRows)
  const payloads = buildValidWorkoutSessions(sessionRows, sessionExRows, setRows, errors)

  const outcomes: WorkoutSessionOutcome[] = []

  // Session_ref có lỗi validation → skipped_invalid, không gọi API cho các session này
  const errorsByRef = new Map<number, ValidationError[]>()
  for (const e of errors) {
    if (e.sessionRef === undefined) continue
    if (!errorsByRef.has(e.sessionRef)) errorsByRef.set(e.sessionRef, [])
    errorsByRef.get(e.sessionRef)!.push(e)
  }
  for (const [ref, errs] of errorsByRef) {
    outcomes.push({ session_ref: ref, status: 'skipped_invalid', errors: errs })
  }

  // Session_ref hợp lệ → gọi API insert thật (ADR-008 D2/D4/D6)
  if (payloads.length > 0) {
    const res = await fetch('/api/import/workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: payloads }),
    })
    const data = await res.json().catch(() => ({ results: [] }))
    const apiResults: { session_ref: number; status: string; message?: string }[] = data.results ?? []
    for (const r of apiResults) {
      outcomes.push({ session_ref: r.session_ref, status: r.status as WorkoutSessionOutcome['status'], message: r.message })
    }
  }

  return outcomes.sort((a, b) => a.session_ref - b.session_ref)
}

// ── Export: Data (fitness-data.xlsx) ────────────────────────────
// Chứa CHỈ dữ liệu thật — không có sheet Template (Task 6).
async function exportDataToExcel() {
  const res = await fetch('/api/export')
  const data = await res.json()

  const wb = XLSX.utils.book_new()

  // Sheet 1: Body Metrics
  const bodyRows = data.body_metrics.map((r: any) => ({
    'Ngày (YYYY-MM-DD)': r.date,
    'Cân nặng (kg)': r.weight_kg,
    'Body fat (%)': r.body_fat_pct,
    'Lean mass (kg)': r.lean_mass_kg,
    'Vòng eo (cm)': r.waist_cm,
    'Vòng hông (cm)': r.hip_cm,
    'Vòng bắp tay (cm)': r.arm_cm,
    'Vòng đùi (cm)': r.thigh_cm,
    'BMI': r.bmi,
    'Ghi chú': r.note,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bodyRows.length ? bodyRows : [{ 'Ngày (YYYY-MM-DD)': '' }]), 'Body Metrics')

  // Sheet 2: Sleep & Recovery
  const sleepRows = data.sleep_recovery.map((r: any) => ({
    'Ngày (YYYY-MM-DD)': r.date,
    'Resting HR (bpm)': r.resting_hr,
    'Điểm ngủ (/100)': r.sleep_score,
    'Thời gian ngủ (phút)': r.sleep_duration_min,
    'Số lần thức': r.wake_count,
    'Năng lượng': r.energy_level,
    'Ghi chú': r.note,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sleepRows.length ? sleepRows : [{ 'Ngày (YYYY-MM-DD)': '' }]), 'Sleep & Recovery')

  // Sheet 3: Workout Sessions
  const sessionRows = data.workout_sessions.map((r: any) => ({
    'Session Ref': r.session_ref ?? '',
    'Ngày': r.date,
    'Loại': r.type,
    'Tên buổi': r.name,
    'Thời gian (phút)': r.duration_minutes,
    'Quãng đường (km)': r.distance_km,
    'Pace (mm:ss/km)': r.avg_pace_mmss,
    'HR TB (bpm)': r.avg_hr,
    'HR max (bpm)': r.max_hr,
    'Calories': r.calories,
    'Cảm giác': r.feeling_note,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionRows.length ? sessionRows : [{ 'Session Ref': '' }]), 'Workout Sessions')

  // Sheet 4: Session Exercises (ADR-008 D3 + D3b)
  const sessionExRows = data.session_exercises.map((r: any) => ({
    'Session Ref': r.session_ref,
    'Exercise ID': r.exercise_id,
    'Bài tập': r.exercise_name,
    'Nhóm cơ': r.muscle_group,
    'Thứ tự': r.display_order,
    'Target Sets': r.target_sets,
    'Target Reps': r.target_reps,
    'Ghi chú': r.notes,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionExRows.length ? sessionExRows : [{ 'Session Ref': '' }]), 'Session Exercises')

  // Sheet 5: Workout Sets (ADR-008 D1/D3)
  const setRows = data.workout_sets.map((r: any) => ({
    'Session Ref': r.session_ref,
    'Exercise ID': r.exercise_id,
    'Bài tập': r.exercise,
    'Nhóm cơ': r.muscle_group,
    'Set': r.set_number,
    'Reps': r.reps,
    'Tạ (kg)': r.weight_kg,
    'RPE': r.rpe,
    'Ghi chú': r.note,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setRows.length ? setRows : [{ 'Session Ref': '' }]), 'Workout Sets')

  XLSX.writeFile(wb, 'fitness-data.xlsx')
}

// ── Export: Import Templates (fitness-import-templates.xlsx) ────
async function exportImportTemplates() {
  const wb = XLSX.utils.book_new()

  const templateBody = [{ 'date': 'YYYY-MM-DD', 'weight_kg': 62.5, 'body_fat_pct': 17.2, 'lean_mass_kg': 51.7, 'waist_cm': 79, 'note': 'Ghi chú tuỳ chọn' }]
  const templateSleep = [{ 'date': 'YYYY-MM-DD', 'resting_hr': 60, 'sleep_score': 85, 'sleep_duration_min': 450, 'wake_count': 1, 'energy_level': 'Tốt', 'note': '' }]
  const templateRun = [{ 'date': 'YYYY-MM-DD', 'name': 'Easy Run', 'duration_minutes': 50, 'distance_km': 7.0, 'avg_pace_mmss': '8:30', 'avg_hr': 140, 'max_hr': 165, 'calories': 450, 'feeling_note': '' }]

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateBody), 'Template - Body')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateSleep), 'Template - Sleep')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateRun), 'Template - Running')

  XLSX.writeFile(wb, 'fitness-import-templates.xlsx')
}

// ── Import: Body/Sleep/Running/Nutrition (KHÔNG đổi hành vi so với trước Bước 3) ──
// Workout được xử lý HOÀN TOÀN riêng bởi importWorkoutData(), gọi song song
// trong handleFileChange — hàm này không còn biết gì về Workout.
async function importFromFile(file: File): Promise<{ results: ImportResult[]; totalImported: number; totalErrors: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })

  const SHEET_MAP: Record<string, string> = {
    'Body Metrics': 'body_metrics',
    'Template - Body': 'body_metrics',
    'Sleep & Recovery': 'sleep_recovery',
    'Template - Sleep': 'sleep_recovery',
    'Running': 'running',
    'Template - Running': 'running',
    'Dinh dưỡng': 'nutrition',
    'Nutrition': 'nutrition',
    'Template - Nutrition': 'nutrition',
  }

  const results: ImportResult[] = []
  let totalImported = 0
  let totalErrors = 0

  for (const sheetName of wb.SheetNames) {
    const apiSheet = SHEET_MAP[sheetName]
    if (!apiSheet) continue // skip unknown sheets (bao gồm 3 sheet Workout — xử lý riêng)

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName])
    if (!rows.length) continue

    const normalized = rows.map(normalizeRow)

    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: apiSheet, rows: normalized }),
    })
    const result = await res.json()

    if (res.status === 422) {
      results.push({ imported: result.valid_count ?? 0, errors: result.errors ?? [] })
      totalErrors += (result.errors ?? []).length
    } else if (res.ok) {
      results.push({ imported: result.imported, errors: [] })
      totalImported += result.imported
    } else {
      results.push({ imported: 0, errors: [{ sheet: sheetName, row: 0, field: '', message: result.error }] })
      totalErrors++
    }
  }

  return { results, totalImported, totalErrors }
}

// ── UI ─────────────────────────────────────────────────────────
export default function DataPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exportingData, setExportingData] = useState(false)
  const [exportingTemplates, setExportingTemplates] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ totalImported: number; totalErrors: number; results: ImportResult[] } | null>(null)
  const [workoutOutcomes, setWorkoutOutcomes] = useState<WorkoutSessionOutcome[] | null>(null)
  const [error, setError] = useState('')

  async function handleExportData() {
    setExportingData(true)
    try { await exportDataToExcel() }
    catch (e: any) { setError(e.message) }
    setExportingData(false)
  }

  async function handleExportTemplates() {
    setExportingTemplates(true)
    try { await exportImportTemplates() }
    catch (e: any) { setError(e.message) }
    setExportingTemplates(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setWorkoutOutcomes(null)
    setError('')
    try {
      // Luồng cũ — Body/Sleep/Running/Nutrition, không đổi hành vi (ADR-008 yêu cầu)
      const result = await importFromFile(file)
      setImportResult(result)

      // ADR-008 Bước 3 — Workout, hoàn toàn tách biệt, đọc lại workbook riêng
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const outcomes = await importWorkoutData(wb)
      setWorkoutOutcomes(outcomes)
    } catch (e: any) {
      setError(e.message)
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <div>
          <p className="font-bold" style={{ color: 'var(--text)' }}>📊 Import / Export</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Quản lý dữ liệu Excel</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 fade-in">
        {/* ① Export Data */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--success-bg)' }}>📥</div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text)' }}>fitness-data.xlsx</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Toàn bộ dữ liệu thật — backup / xem lại</p>
            </div>
          </div>
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Sheet trong file này:</p>
            {['📋 Body Metrics', '😴 Sleep & Recovery', '🏋️ Workout Sessions', '💪 Session Exercises', '🏋️‍♂️ Workout Sets'].map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-2)' }}>{item}</p>
            ))}
          </div>
          <button onClick={handleExportData} disabled={exportingData} className="btn-primary"
            style={{ background: 'var(--success)' }}>
            {exportingData ? 'Đang tạo file...' : '⬇️ Tải fitness-data.xlsx'}
          </button>
        </div>

        {/* ② Import Templates */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--brand-light)' }}>📝</div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text)' }}>fitness-import-templates.xlsx</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Mẫu để điền dữ liệu mới hoặc lịch sử, rồi import ngược lại</p>
            </div>
          </div>
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Sheet trong file này:</p>
            {['⚖️ Template - Body', '😴 Template - Sleep', '🏃 Template - Running', '🥗 Template - Nutrition'].map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-2)' }}>{item}</p>
            ))}
          </div>
          <button onClick={handleExportTemplates} disabled={exportingTemplates} className="btn-primary">
            {exportingTemplates ? 'Đang tạo file...' : '📝 Tải fitness-import-templates.xlsx'}
          </button>
        </div>

        {/* ③ Import */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--warning-bg)' }}>📤</div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text)' }}>Import dữ liệu</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Dùng file ② sau khi đã điền, hoặc file ① nếu muốn khôi phục</p>
            </div>
          </div>
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--warning-bg)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>⚠️ Lưu ý trước khi import:</p>
            <p className="text-xs" style={{ color: 'var(--warning)' }}>Body/Sleep/Nutrition ghi đè nếu trùng ngày. Running tự động bỏ qua nếu đã tồn tại. Workout (kháng lực) LUÔN tạo buổi tập mới — import lại file giống hệt sẽ tự động bỏ qua (trùng), nhưng sửa dữ liệu rồi import lại sẽ tạo buổi tập mới riêng biệt, không ghi đè buổi cũ.</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary">
            {importing ? '⏳ Đang xử lý...' : '⬆️ Chọn file Excel để import'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="card p-4" style={{ border: '1.5px solid var(--danger)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>❌ {error}</p>
          </div>
        )}

        {/* Import result — Body/Sleep/Running/Nutrition */}
        {importResult && (
          <div className="card p-4 space-y-3 fade-in">
            <p className="font-bold" style={{ color: 'var(--text)' }}>Kết quả import</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--success-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{importResult.totalImported}</p>
                <p className="text-xs" style={{ color: 'var(--success)' }}>Đã import</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--warning-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
                  {importResult.results.reduce((s, r) => s + (r.skipped ?? 0), 0)}
                </p>
                <p className="text-xs" style={{ color: 'var(--warning)' }}>Bỏ qua (trùng)</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: importResult.totalErrors > 0 ? 'var(--danger-bg)' : 'var(--surface-2)' }}>
                <p className="text-2xl font-bold" style={{ color: importResult.totalErrors > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{importResult.totalErrors}</p>
                <p className="text-xs" style={{ color: importResult.totalErrors > 0 ? 'var(--danger)' : 'var(--text-3)' }}>Lỗi</p>
              </div>
            </div>

            {importResult.results.some(r => r.errors.length > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>Chi tiết lỗi:</p>
                {importResult.results.flatMap(r => r.errors).map((err, i) => (
                  <div key={i} className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                    <strong>Sheet {err.sheet}{err.row !== undefined ? ` · Dòng ${err.row}` : ''}</strong>{err.field ? ` · ${err.field}` : ''}: {err.message}
                  </div>
                ))}
              </div>
            )}

            {importResult.totalImported > 0 && (
              <p className="text-xs text-center" style={{ color: 'var(--success)' }}>
                ✓ Import thành công! Vào Dashboard để xem dữ liệu mới.
              </p>
            )}
          </div>
        )}

        {/* Import result — Workout (ADR-008 Bước 3) */}
        {workoutOutcomes !== null && (
          <div className="card p-4 space-y-3 fade-in">
            <p className="font-bold" style={{ color: 'var(--text)' }}>Kết quả import Workout (kháng lực)</p>

            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-xl p-2 text-center" style={{ background: 'var(--success-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{workoutOutcomes.filter(o => o.status === 'created').length}</p>
                <p className="text-xs" style={{ color: 'var(--success)' }}>Đã tạo</p>
              </div>
              <div className="rounded-xl p-2 text-center" style={{ background: 'var(--warning-bg)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--warning)' }}>{workoutOutcomes.filter(o => o.status === 'skipped_duplicate').length}</p>
                <p className="text-xs" style={{ color: 'var(--warning)' }}>Trùng</p>
              </div>
              <div className="rounded-xl p-2 text-center" style={{ background: 'var(--surface-2)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--text-3)' }}>{workoutOutcomes.filter(o => o.status === 'skipped_invalid').length}</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Lỗi dữ liệu</p>
              </div>
              <div className="rounded-xl p-2 text-center" style={{ background: workoutOutcomes.some(o => o.status === 'failed') ? 'var(--danger-bg)' : 'var(--surface-2)' }}>
                <p className="text-xl font-bold" style={{ color: workoutOutcomes.some(o => o.status === 'failed') ? 'var(--danger)' : 'var(--text-3)' }}>{workoutOutcomes.filter(o => o.status === 'failed').length}</p>
                <p className="text-xs" style={{ color: workoutOutcomes.some(o => o.status === 'failed') ? 'var(--danger)' : 'var(--text-3)' }}>Thất bại</p>
              </div>
            </div>

            {workoutOutcomes.some(o => o.status === 'skipped_invalid' || o.status === 'failed') && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>Chi tiết:</p>
                {workoutOutcomes.filter(o => o.status === 'skipped_invalid' || o.status === 'failed').map(o => (
                  <div key={o.session_ref} className="rounded-xl px-3 py-2 text-xs space-y-1" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                    <strong>Session Ref {o.session_ref}</strong>
                    {o.status === 'failed' && o.message && <p>• {o.message}</p>}
                    {o.errors?.map((err, i) => (
                      <p key={i}>• {err.sheet}{err.row !== undefined ? ` · Dòng ${err.row}` : ''}{err.field ? ` · ${err.field}` : ''}: {err.message}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {workoutOutcomes.some(o => o.status === 'skipped_duplicate') && (
              <div className="space-y-1">
                {workoutOutcomes.filter(o => o.status === 'skipped_duplicate').map(o => (
                  <p key={o.session_ref} className="text-xs" style={{ color: 'var(--warning)' }}>
                    Session Ref {o.session_ref}: {o.message}
                  </p>
                ))}
              </div>
            )}

            {workoutOutcomes.filter(o => o.status === 'created').length > 0 && (
              <p className="text-xs text-center" style={{ color: 'var(--success)' }}>
                ✓ Đã tạo {workoutOutcomes.filter(o => o.status === 'created').length} buổi tập mới. Vào trang chủ hoặc Dashboard để xem.
              </p>
            )}
          </div>
        )}

        {/* How to use */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>💡 Cách nhập dữ liệu lịch sử</p>
          <div className="space-y-2">
            {[
              ['1', 'Tải fitness-import-templates.xlsx ở mục ②'],
              ['2', 'Mở sheet tương ứng (Body/Sleep/Running/Nutrition)'],
              ['3', 'Điền dữ liệu theo format (ngày dạng YYYY-MM-DD)'],
              ['4', 'Lưu file → quay lại app → Import ở mục ③'],
              ['5', 'App tự kiểm tra và báo lỗi nếu có'],
            ].map(([n, text]) => (
              <div key={n} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'var(--brand)' }}>{n}</span>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
