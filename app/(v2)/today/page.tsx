'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExercisePicker } from '@/components/ExercisePicker'

type Session = {
  id: string
  date: string
  type: string
  duration_seconds: number | null
  name_override: string | null
  created_at: string
  workout_templates?: { name: string } | null
}

type PickedExercise = { id: string; name: string; muscle_group: string }

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

export default function TodayPage() {
  const router = useRouter()
  const today = isoToday()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState('')

  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<PickedExercise[]>([])
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  async function loadToday() {
    setLoading(true)
    setError('')
    try {
      // Reuse GET /api/sessions?date=&type= nguyên trạng — không sửa API.
      const res = await fetch(`/api/sessions?date=${today}&type=strength`)
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } catch {
      setError('Không tải được dữ liệu hôm nay')
    }
    setLoading(false)
  }

  useEffect(() => { loadToday() }, [today])

  // V2-S1 quy ước session state (đã chốt, không có cột status/completed_at):
  //   duration_seconds IS NULL      -> active / chưa hoàn thành
  //   duration_seconds IS NOT NULL  -> completed
  const activeSession = sessions.find(s => s.duration_seconds == null)
  const completedSessions = sessions.filter(s => s.duration_seconds != null)

  function toggleAddExercise(ex: PickedExercise) {
    setSelected(prev => [...prev, ex])
  }
  function removeExercise(id: string) {
    setSelected(prev => prev.filter(e => e.id !== id))
  }

  async function startWorkout() {
    if (selected.length === 0 || starting) return
    setStarting(true)
    setStartError('')
    try {
      // 1. Tạo session — không truyền template_id (mặc định NULL)
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, type: 'strength' }),
      })
      const session = await sessionRes.json()
      if (!sessionRes.ok || !session.id) {
        setStartError(session.error ?? 'Không tạo được buổi tập. Thử lại.')
        setStarting(false)
        return
      }

      // 2. Thêm từng bài đã chọn — reuse POST /api/session-exercises,
      //    gọi tuần tự cho từng bài, không tạo API bulk-insert mới.
      let hadExerciseError = false
      for (const ex of selected) {
        const res = await fetch('/api/session-exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id, exercise_id: ex.id }),
        })
        if (!res.ok) hadExerciseError = true
      }

      if (hadExerciseError) {
        setStartError('Một số bài tập không thêm được, nhưng buổi tập đã tạo. Đang chuyển vào buổi tập...')
      }

      router.push(`/w/${session.id}`)
    } catch {
      setStartError('Lỗi kết nối. Thử lại.')
      setStarting(false)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Today</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {loading && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>Đang tải...</p>}
        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}

        {!loading && !error && (
          <>
            {/* Active session — Continue, không cho tạo mới trong khi đang active */}
            {activeSession && (
              <button
                onClick={() => router.push(`/w/${activeSession.id}`)}
                className="card w-full p-5 flex items-center gap-3 text-left"
                style={{ border: '2px solid var(--brand)', minHeight: 48 }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-light)' }}>
                  💪
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--brand-dark)' }}>Tiếp tục buổi tập đang dở</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {activeSession.name_override ?? activeSession.workout_templates?.name ?? 'Buổi tập'} · bắt đầu {formatTime(activeSession.created_at)}
                  </p>
                </div>
                <span className="ml-auto shrink-0" style={{ color: 'var(--brand)' }}>›</span>
              </button>
            )}

            {/* Completed sessions hôm nay — chỉ hiển thị tham khảo, không phải History UI */}
            {completedSessions.length > 0 && (
              <div className="space-y-1.5">
                <p className="section-label">Đã hoàn thành hôm nay</p>
                {completedSessions.map(s => (
                  <div key={s.id} className="card-sm px-4 py-3 flex items-center gap-3">
                    <span className="text-lg">✅</span>
                    <p className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
                      {s.name_override ?? s.workout_templates?.name ?? 'Buổi tập'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Start Workout — luôn cho phép trừ khi đang có session active */}
            {!activeSession && !picking && (
              <button
                onClick={() => setPicking(true)}
                className="btn-primary py-3.5"
                style={{ minHeight: 48 }}
              >
                {completedSessions.length > 0 ? '+ Bắt đầu buổi tập mới' : '+ Start Workout'}
              </button>
            )}

            {/* Chọn bài tập trước khi Start */}
            {!activeSession && picking && (
              <div className="card p-4 space-y-4 fade-in">
                <div className="flex items-center justify-between">
                  <p className="font-bold" style={{ color: 'var(--text)' }}>Chọn bài tập cho buổi tập</p>
                  <button onClick={() => { setPicking(false); setSelected([]); setStartError('') }} style={{ color: 'var(--text-3)' }}>✕</button>
                </div>

                {selected.length > 0 && (
                  <div className="space-y-1.5">
                    {selected.map(ex => (
                      <div key={ex.id} className="card-sm px-3 py-2.5 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
                        </div>
                        <button
                          onClick={() => removeExercise(ex.id)}
                          className="shrink-0 flex items-center justify-center rounded-lg"
                          style={{ width: 32, height: 32, color: 'var(--danger)' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <ExercisePicker
                  allowSearch
                  allowFilter
                  excludeIds={selected.map(e => e.id)}
                  onSelect={ex => toggleAddExercise({ id: ex.id, name: ex.name, muscle_group: ex.muscle_group })}
                />

                {startError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{startError}</p>}

                <button
                  onClick={startWorkout}
                  disabled={selected.length === 0 || starting}
                  className="btn-primary"
                  style={{ minHeight: 48 }}
                >
                  {starting ? 'Đang bắt đầu...' : `Start Workout (${selected.length} bài)`}
                </button>
              </div>
            )}

            {!activeSession && !picking && completedSessions.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>
                Chưa có buổi tập nào hôm nay.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
