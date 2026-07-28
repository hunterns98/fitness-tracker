'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Session = {
  id: string
  type: string
  name_override: string | null
  duration_seconds: number | null
  distance_km: number | null
  feeling_note: string | null
  workout_templates?: { name: string } | null
}

type Template = {
  id: string
  name: string
  type: 'strength' | 'run'
  run_type?: string
}

const TYPE_ICON: Record<string, string> = {
  strength: '💪',
  run: '🏃',
  other: '⭐',
}

const RUN_TYPES = [
  { value: 'recovery', label: 'Recovery' },
  { value: 'easy', label: 'Easy Run' },
  { value: 'long', label: 'Long Run' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'interval', label: 'Interval' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'race', label: 'Race' },
  { value: 'trail', label: 'Trail' },
  { value: 'other', label: 'Other' },
]

const OTHER_TYPES = [
  'Jump Rope', 'Swimming', 'Cycling', 'Yoga', 'Boxing',
  'Badminton', 'Basketball', 'Football', 'Hiking', 'Dance', 'Other',
]

function formatDur(s: number | null) {
  if (!s) return ''
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${m}m` : `${m}m`
}

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  return `${days[dt.getDay()]}, ${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<'strength' | 'run' | 'other' | 'rest' | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [selectedRunType, setSelectedRunType] = useState('easy')
  const [otherName, setOtherName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/sessions?date=${date}`).then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
    ]).then(([sess, tmpl]) => {
      setSessions(Array.isArray(sess) ? sess : [])
      setTemplates(Array.isArray(tmpl) ? tmpl : [])
      setLoading(false)
    })
  }, [date])

  const strengthTemplates = templates.filter(t => t.type === 'strength')

  async function createSession() {
    setCreating(true)
    setCreateError('')

    // Build body — chỉ gửi các field có trong schema workout_sessions
    const body: Record<string, any> = { date, type: addType }

    if (addType === 'strength') {
      body.template_id = selectedTemplate
    } else if (addType === 'run') {
      // run_type_custom KHÔNG có trong schema → dùng name_override để lưu loại chạy
      body.name_override = RUN_TYPES.find(r => r.value === selectedRunType)?.label ?? 'Chạy bộ'
    } else if (addType === 'other') {
      body.name_override = otherName || 'Other Workout'
    } else if (addType === 'rest') {
      body.name_override = 'Nghỉ ngơi'
    }

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const session = await res.json()

      // Defensive guard: không navigate nếu không có session.id hợp lệ
      if (!res.ok || !session.id || typeof session.id !== 'string') {
        setCreateError(session.error ?? 'Không tạo được buổi tập. Thử lại.')
        setCreating(false)
        return
      }

      // Navigate chỉ khi session.id tồn tại và hợp lệ
      if (addType === 'strength') {
        router.push(`/workout/${session.id}`)
      } else if (addType === 'run') {
        router.push(`/workout/${session.id}/run`)
      } else if (addType === 'other') {
        router.push(`/workout/${session.id}/other`)
      } else if (addType === 'rest') {
        // Nghỉ ngơi không cần màn hình tập, vào thẳng summary
        router.push(`/summary/${session.id}`)
      }
    } catch (err) {
      setCreateError('Lỗi kết nối. Thử lại.')
      setCreating(false)
    }
  }

  // Bắt đầu buổi kháng lực trống — không chọn template, không snapshot exercise nào.
  // Workout Editor (đã build ở app/workout/[sessionId]/page.tsx) cho phép build từ đầu.
  // Quyết định UX Design đã duyệt: session strength được phép có 0 exercise.
  async function createBlankStrengthSession() {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type: 'strength', name_override: 'Buổi tập tự chọn' }),
      })
      const session = await res.json()

      if (!res.ok || !session.id || typeof session.id !== 'string') {
        setCreateError(session.error ?? 'Không tạo được buổi tập. Thử lại.')
        setCreating(false)
        return
      }

      router.push(`/workout/${session.id}`)
    } catch {
      setCreateError('Lỗi kết nối. Thử lại.')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          ←
        </button>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{formatDate(date)}</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {sessions.length > 0 ? `${sessions.length} buổi tập` : 'Chưa có buổi tập nào'}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="ml-auto px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--brand)' }}>
          + Thêm
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 fade-in">
        {loading && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>Đang tải...</p>}

        {!loading && sessions.length === 0 && !showAdd && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-3xl">📅</p>
            <p className="font-medium" style={{ color: 'var(--text-2)' }}>Ngày nghỉ hoặc chưa ghi chép</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary py-2.5 text-sm">
              + Thêm buổi tập
            </button>
          </div>
        )}

        {sessions.map(s => (
          <button key={s.id} onClick={() => router.push(`/summary/${s.id}`)}
            className="card p-4 w-full text-left flex items-center gap-3">
            <span className="text-2xl">{TYPE_ICON[s.type] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>
                {s.name_override ?? s.workout_templates?.name ?? '—'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {s.duration_seconds ? formatDur(s.duration_seconds) : ''}
                {s.distance_km ? ` · ${s.distance_km}km` : ''}
              </p>
            </div>
            <span style={{ color: 'var(--text-3)' }}>›</span>
          </button>
        ))}
      </div>

      {/* Bottom sheet: Add session */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setAddType(null) } }}>
          <div className="slide-up rounded-t-3xl p-6 space-y-5" style={{ background: 'var(--surface)' }}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-strong)' }} />

            {!addType && (
              <>
                <h3 className="font-bold text-lg text-center" style={{ color: 'var(--text)' }}>Thêm buổi tập</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'strength', icon: '💪', label: 'Kháng lực', cls: 'type-card-strength' },
                    { type: 'run', icon: '🏃', label: 'Chạy bộ', cls: 'type-card-run' },
                    { type: 'other', icon: '⭐', label: 'Khác', cls: 'type-card-other' },
                    { type: 'rest', icon: '😴', label: 'Nghỉ ngơi', cls: 'type-card-rest' },
                  ].map(opt => (
                    <button key={opt.type}
                      onClick={() => {
                        setAddType(opt.type as any)
                        // Rest Day không cần bước chọn thêm → tạo ngay
                        if (opt.type === 'rest') {
                          setAddType('rest')
                        }
                      }}
                      className={`${opt.cls} rounded-2xl p-4 flex flex-col items-center gap-2`}>
                      <span className="text-3xl">{opt.icon}</span>
                      <span className="text-white text-sm font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {createError && (
                  <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{createError}</p>
                )}
                <button onClick={() => setShowAdd(false)} className="btn-ghost w-full text-center">Huỷ</button>
              </>
            )}

            {addType === 'strength' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddType(null)} style={{ color: 'var(--text-3)' }}>←</button>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>💪 Kháng lực</h3>
                </div>
                <div className="space-y-2">
                  {strengthTemplates.map(t => (
                    <button key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className="w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all"
                      style={{
                        background: selectedTemplate === t.id ? 'var(--brand-light)' : 'var(--surface-2)',
                        color: selectedTemplate === t.id ? 'var(--brand-dark)' : 'var(--text)',
                        border: `1.5px solid ${selectedTemplate === t.id ? 'var(--brand)' : 'var(--border)'}`,
                      }}>
                      {t.name}
                    </button>
                  ))}
                </div>
                {createError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{createError}</p>}
                <button onClick={createSession} disabled={!selectedTemplate || creating}
                  className="btn-primary">
                  {creating ? 'Đang tạo...' : 'Bắt đầu tập →'}
                </button>
                {/* Bắt đầu trống — session strength 0 bài, build bằng Workout Editor (UX Design đã duyệt) */}
                <button onClick={createBlankStrengthSession} disabled={creating}
                  className="btn-ghost w-full text-center">
                  {creating ? 'Đang tạo...' : 'Hoặc bắt đầu trống, tự chọn bài tập →'}
                </button>
              </>
            )}

            {addType === 'run' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddType(null)} style={{ color: 'var(--text-3)' }}>←</button>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>🏃 Chạy bộ</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {RUN_TYPES.map(rt => (
                    <button key={rt.value}
                      onClick={() => setSelectedRunType(rt.value)}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: selectedRunType === rt.value ? 'var(--run-bg)' : 'var(--surface-2)',
                        color: selectedRunType === rt.value ? 'var(--run)' : 'var(--text-2)',
                        border: `1.5px solid ${selectedRunType === rt.value ? 'var(--run)' : 'var(--border)'}`,
                      }}>
                      {rt.label}
                    </button>
                  ))}
                </div>
                {createError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{createError}</p>}
                <button onClick={createSession} disabled={creating} className="btn-primary">
                  {creating ? 'Đang tạo...' : 'Tiếp tục →'}
                </button>
              </>
            )}

            {addType === 'rest' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddType(null)} style={{ color: 'var(--text-3)' }}>←</button>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>😴 Nghỉ ngơi</h3>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Ghi lại ngày nghỉ ngơi để theo dõi workout streak và lịch sử tập luyện.
                </p>
                {createError && (
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{createError}</p>
                )}
                <button onClick={createSession} disabled={creating} className="btn-primary">
                  {creating ? 'Đang lưu...' : 'Xác nhận nghỉ ngơi'}
                </button>
              </>
            )}

            {addType === 'other' && (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddType(null)} style={{ color: 'var(--text-3)' }}>←</button>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>⭐ Hoạt động khác</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {OTHER_TYPES.map(name => (
                    <button key={name}
                      onClick={() => setOtherName(name)}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: otherName === name ? 'var(--other-bg)' : 'var(--surface-2)',
                        color: otherName === name ? 'var(--other)' : 'var(--text-2)',
                        border: `1.5px solid ${otherName === name ? 'var(--other)' : 'var(--border)'}`,
                      }}>
                      {name}
                    </button>
                  ))}
                </div>
                <input className="input" placeholder="Hoặc gõ tên hoạt động..." value={otherName}
                  onChange={e => setOtherName(e.target.value)} />
                <button onClick={createSession} disabled={!otherName || creating} className="btn-primary">
                  {creating ? 'Đang tạo...' : 'Tiếp tục →'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
