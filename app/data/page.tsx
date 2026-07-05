'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type ValidationError = { sheet: string; row: number; field: string; message: string }
type ImportResult = { imported: number; errors: ValidationError[] }

// ── Export ─────────────────────────────────────────────────────
async function exportToExcel() {
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sessionRows.length ? sessionRows : [{ 'Ngày': '' }]), 'Workout Sessions')

  // Sheet 4: Workout Sets
  const setRows = data.workout_sets.map((r: any) => ({
    'Session ID': r.session_id,
    'Bài tập': r.exercise,
    'Nhóm cơ': r.muscle_group,
    'Set': r.set_number,
    'Reps': r.reps,
    'Tạ (kg)': r.weight_kg,
    'RPE': r.rpe,
    'Ghi chú': r.note,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setRows.length ? setRows : [{ 'Session ID': '' }]), 'Workout Sets')

  // Sheet 5: Template for import
  const templateBody = [{ 'date': 'YYYY-MM-DD', 'weight_kg': 62.5, 'body_fat_pct': 17.2, 'lean_mass_kg': 51.7, 'waist_cm': 79, 'note': 'Ghi chú tuỳ chọn' }]
  const templateSleep = [{ 'date': 'YYYY-MM-DD', 'resting_hr': 60, 'sleep_score': 85, 'sleep_duration_min': 450, 'wake_count': 1, 'energy_level': 'Tốt', 'note': '' }]
  const templateRun = [{ 'date': 'YYYY-MM-DD', 'name': 'Easy Run', 'duration_minutes': 50, 'distance_km': 7.0, 'avg_pace_mmss': '8:30', 'avg_hr': 140, 'max_hr': 165, 'calories': 450, 'feeling_note': '' }]

  const ws5 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateBody), 'Template - Body')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateSleep), 'Template - Sleep')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateRun), 'Template - Running')

  const today = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `fitness-tracker-${today}.xlsx`)
}

// ── Import ─────────────────────────────────────────────────────
async function importFromFile(file: File): Promise<{ results: ImportResult[]; totalImported: number; totalErrors: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })

  const SHEET_MAP: Record<string, string> = {
    'Body Metrics': 'body_metrics',
    'Template - Body': 'body_metrics',
    'Sleep & Recovery': 'sleep_recovery',
    'Template - Sleep': 'sleep_recovery',
    'Template - Running': 'running',
  }

  const results: ImportResult[] = []
  let totalImported = 0
  let totalErrors = 0

  for (const sheetName of wb.SheetNames) {
    const apiSheet = SHEET_MAP[sheetName]
    if (!apiSheet) continue // skip unknown sheets

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName])
    if (!rows.length) continue

    // Normalize keys: remove units from column headers
    const normalized = rows.map((r: any) => {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(r)) {
        // Extract field name from "Field name (unit)" pattern
        const key = k.split('(')[0].trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
        // Map Vietnamese headers to field names
        const fieldMap: Record<string, string> = {
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
        }
        out[fieldMap[key] ?? key] = v
      }
      return out
    })

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
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ totalImported: number; totalErrors: number; results: ImportResult[] } | null>(null)
  const [error, setError] = useState('')

  async function handleExport() {
    setExporting(true)
    try { await exportToExcel() }
    catch (e: any) { setError(e.message) }
    setExporting(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setError('')
    try {
      const result = await importFromFile(file)
      setImportResult(result)
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
        {/* Export */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--success-bg)' }}>📥</div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text)' }}>Export dữ liệu</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Tải toàn bộ dữ liệu ra file Excel</p>
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>File Excel sẽ chứa các sheet:</p>
            {['📋 Body Metrics (cân nặng, body fat, vòng eo...)', '😴 Sleep & Recovery (resting HR, điểm ngủ...)', '🏋️ Workout Sessions (tất cả buổi tập)', '💪 Workout Sets (từng set kháng lực)', '📝 Template - sẵn sàng để nhập dữ liệu cũ'].map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-2)' }}>{item}</p>
            ))}
          </div>

          <button onClick={handleExport} disabled={exporting} className="btn-primary"
            style={{ background: 'var(--success)' }}>
            {exporting ? 'Đang tạo file...' : '⬇️ Tải file Excel'}
          </button>
        </div>

        {/* Import */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--brand-light)' }}>📤</div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text)' }}>Import dữ liệu</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Nhập dữ liệu từ file Excel vào app</p>
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--warning-bg)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>⚠️ Lưu ý trước khi import:</p>
            <p className="text-xs" style={{ color: 'var(--warning)' }}>Dùng template từ file Export để đảm bảo đúng format. Dữ liệu import sẽ ghi đè nếu trùng ngày (body metrics, sleep). Các buổi chạy sẽ được thêm mới.</p>
          </div>

          <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Sheet được hỗ trợ import:</p>
            {['Body Metrics / Template - Body → cập nhật cân nặng, body fat', 'Sleep & Recovery / Template - Sleep → cập nhật giấc ngủ', 'Template - Running → thêm buổi chạy bộ'].map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-2)' }}>• {item}</p>
            ))}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'var(--success-bg)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{importResult.totalImported}</p>
                <p className="text-xs" style={{ color: 'var(--success)' }}>Dòng đã import</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: importResult.totalErrors > 0 ? 'var(--danger-bg)' : 'var(--surface-2)' }}>
                <p className="text-2xl font-bold" style={{ color: importResult.totalErrors > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{importResult.totalErrors}</p>
                <p className="text-xs" style={{ color: importResult.totalErrors > 0 ? 'var(--danger)' : 'var(--text-3)' }}>Lỗi</p>
              </div>
            </div>

            {/* Errors detail */}
            {importResult.results.some(r => r.errors.length > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>Chi tiết lỗi:</p>
                {importResult.results.flatMap(r => r.errors).map((err, i) => (
                  <div key={i} className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                    <strong>Sheet {err.sheet} · Dòng {err.row}</strong>{err.field ? ` · ${err.field}` : ''}: {err.message}
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

        {/* How to use */}
        <div className="card p-4 space-y-3">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>💡 Cách nhập dữ liệu lịch sử</p>
          <div className="space-y-2">
            {[
              ['1', 'Export → tải file Excel về'],
              ['2', 'Mở sheet "Template - Body" hoặc "Template - Sleep"'],
              ['3', 'Điền dữ liệu theo format (ngày dạng YYYY-MM-DD)'],
              ['4', 'Lưu file → quay lại app → Import'],
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
