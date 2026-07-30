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
  // ADR-008 — bổ sung cho 3 sheet Workout (Bước 2)
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

// ── ADR-008 — Validation logic cho Workout Import (Bước 2) ──
// Gộp 3 sheet theo session_ref, kiểm tra referential integrity.
// Hàm THUẦN (không đọc file, không gọi API) — được gọi bởi validateWorkoutImport().
function validateWorkoutSheets(
  sessionRows: Record<string, any>[],
  sessionExRows: Record<string, any>[],
  setRows: Record<string, any>[]
): ValidationError[] {
  const errors: ValidationError[] = []

  const sessionMetaByRef = new Map<number, Record<string, any>>()
  sessionRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) return // dòng run/other, không thuộc Workout Import
    if (sessionMetaByRef.has(ref)) {
      errors.push({ sheet: 'Workout Sessions', row: i + 2, field: 'session_ref', message: `Session Ref ${ref} bị lặp lại trong sheet Workout Sessions`, sessionRef: ref })
      return
    }
    sessionMetaByRef.set(ref, r)
  })

  const exercisesByRef = new Map<number, Record<string, any>[]>()
  sessionExRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) {
      errors.push({ sheet: 'Session Exercises', row: i + 2, field: 'session_ref', message: 'Thiếu hoặc sai Session Ref' })
      return
    }
    if (!exercisesByRef.has(ref)) exercisesByRef.set(ref, [])
    exercisesByRef.get(ref)!.push(r)
  })

  const setsByRef = new Map<number, Record<string, any>[]>()
  setRows.forEach((r, i) => {
    const ref = parseInt(r.session_ref, 10)
    if (!ref || isNaN(ref)) {
      errors.push({ sheet: 'Workout Sets', row: i + 2, field: 'session_ref', message: 'Thiếu hoặc sai Session Ref' })
      return
    }
    if (!setsByRef.has(ref)) setsByRef.set(ref, [])
    setsByRef.get(ref)!.push(r)
  })

  const allRefs = new Set<number>([...sessionMetaByRef.keys(), ...exercisesByRef.keys(), ...setsByRef.keys()])

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

    // TODO (Bước sau, trước khi viết API insert):
    // - Validate target_sets / target_reps trong Session Exercises (kiểu số hợp lệ,
    //   target_sets > 0, target_reps đúng định dạng "8-12" hoặc số đơn).
    // - Validate display_order: số nguyên, không trùng nhau trong cùng session_ref.
    // - Validate set_number trong Workout Sets: số nguyên dương, không trùng
    //   (exercise_id, set_number) trong cùng session_ref.
    // - Validate reps/weight_kg/rpe: kiểu số hợp lệ, rpe trong khoảng 6-10 nếu có.
    // Chưa làm ở Bước 2 vì Bước 2 chỉ kiểm tra referential integrity giữa các
    // sheet — validate giá trị từng field sẽ làm ngay trước khi viết logic insert.
  }

  return errors
}

// ── ADR-008 — Điều phối đọc + validate Workout (Bước 2) ──
// Tách khỏi importFromFile(): hàm đó chỉ điều phối luồng chung, không chứa
// logic đọc/gộp sheet Workout. Trả về null nếu file không có sheet Workout nào
// (import bình thường, không liên quan ADR-008).
function validateWorkoutImport(wb: XLSX.WorkBook): ValidationError[] | null {
  const hasWorkoutSheets = ['Workout Sessions', 'Session Exercises', 'Workout Sets'].some(n => wb.SheetNames.includes(n))
  if (!hasWorkoutSheets) return null

  const sessionRows = wb.SheetNames.includes('Workout Sessions')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Workout Sessions']).map(normalizeRow) : []
  const sessionExRows = wb.SheetNames.includes('Session Exercises')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Session Exercises']).map(normalizeRow) : []
  const setRows = wb.SheetNames.includes('Workout Sets')
    ? XLSX.utils.sheet_to_json(wb.Sheets['Workout Sets']).map(normalizeRow) : []

  return validateWorkoutSheets(sessionRows, sessionExRows, setRows)
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

  // Sheet 4: Session Exercises (ADR-008 D3)
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
// Sheet mẫu để điền tay rồi import ngược lại. Không gọi API — dữ
// liệu tĩnh, không phụ thuộc dữ liệu thật hiện có.
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

// ── Import ─────────────────────────────────────────────────────
async function importFromFile(file: File): Promise<{ results: ImportResult[]; totalImported: number; totalErrors: number; workoutValidation: ValidationError[] | null }> {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })

  const SHEET_MAP: Record<string, string> = {
    'Body Metrics': 'body_metrics',
    'Template - Body': 'body_metrics',
    'Sleep & Recovery': 'sleep_recovery',
    'Template - Sleep': 'sleep_recovery',
    'Running': 'running',           // fix: sheet name trong file Excel lịch sử
    'Template - Running': 'running',
    'Dinh dưỡng': 'nutrition',
    'Nutrition': 'nutrition',
    'Template - Nutrition': 'nutrition',
  }

  const results: ImportResult[] = []
  let totalImported = 0
  let totalErrors = 0

  // ADR-008 — Bước 2: validate Workout tách riêng, không gộp vào `results`
  // (results chỉ dành cho các sheet đã thực sự có luồng import thật).
  const workoutValidation = validateWorkoutImport(wb)

  for (const sheetName of wb.SheetNames) {
    const apiSheet = SHEET_MAP[sheetName]
    if (!apiSheet) continue // skip unknown sheets (bao gồm 3 sheet Workout — chưa có luồng import thật)

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

  return { results, totalImported, totalErrors, workoutValidation }
}

// ── UI ─────────────────────────────────────────────────────────
export default function DataPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [exportingData, setExportingData] = useState(false)
  const [exportingTemplates, setExportingTemplates] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ totalImported: number; totalErrors: number; results: ImportResult[] } | null>(null)
  const [workoutValidation, setWorkoutValidation] = useState<ValidationError[] | null>(null)
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
    setWorkoutValidation(null)
    setError('')
    try {
      const result = await importFromFile(file)
      setImportResult(result)
      setWorkoutValidation(result.workoutValidation)
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
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Toàn bộ dữ liệu thật — backup / xem lại (KHÔNG dùng để nhập liệu)</p>
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
            <p className="text-xs" style={{ color: 'var(--warning)' }}>Dữ liệu import sẽ ghi đè nếu trùng ngày (body metrics, sleep, nutrition). Các buổi chạy sẽ được thêm mới, tự động bỏ qua nếu đã tồn tại. Sheet Workout (Session Ref) hiện chỉ được KIỂM TRA, chưa được ghi vào hệ thống.</p>
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

        {/* Import result */}
        {importResult && (
          <div className="card p-4 space-y-3 fade-in">
            <p className="font-bold" style={{ color: 'var(--text)' }}>Kết quả import</p>

            {/* Summary */}
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

            {/* Errors detail — chỉ còn lỗi từ Body/Sleep/Running/Nutrition, không còn Workout */}
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

        {/* ADR-008 — Bước 2: kết quả validate Workout, độc lập với importResult */}
        {workoutValidation !== null && (
          <div className="card p-4 space-y-3 fade-in">
            <p className="font-bold" style={{ color: 'var(--text)' }}>Kiểm tra dữ liệu Workout (chưa import)</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Bước hiện tại chỉ kiểm tra tính hợp lệ giữa 3 sheet Workout — chưa ghi vào hệ thống.
            </p>
            {workoutValidation.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--success)' }}>✓ Không phát hiện lỗi.</p>
            ) : (() => {
              const flatErrors = workoutValidation.filter(e => e.sessionRef === undefined)
              const groupedMap = new Map<number, ValidationError[]>()
              for (const e of workoutValidation) {
                if (e.sessionRef === undefined) continue
                if (!groupedMap.has(e.sessionRef)) groupedMap.set(e.sessionRef, [])
                groupedMap.get(e.sessionRef)!.push(e)
              }
              return (
                <div className="space-y-2">
                  {[...groupedMap.entries()].map(([ref, errs]) => (
                    <div key={`ref-${ref}`} className="rounded-xl px-3 py-2 text-xs space-y-1" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      <strong>Session Ref {ref}</strong>
                      {errs.map((err, i) => (
                        <p key={i}>• {err.sheet}{err.row !== undefined ? ` · Dòng ${err.row}` : ''}{err.field ? ` · ${err.field}` : ''}: {err.message}</p>
                      ))}
                    </div>
                  ))}
                  {flatErrors.map((err, i) => (
                    <div key={`flat-${i}`} className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      <strong>Sheet {err.sheet}{err.row !== undefined ? ` · Dòng ${err.row}` : ''}</strong>{err.field ? ` · ${err.field}` : ''}: {err.message}
                    </div>
                  ))}
                </div>
              )
            })()}
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
