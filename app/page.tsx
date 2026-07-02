'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate, formatDuration } from '@/lib/utils'

type Template = {
  id: string
  name: string
  type: 'strength' | 'run'
  run_type?: string | null
}

type Session = {
  id: string
  date: string
  type: string
  name_override: string | null
  duration_seconds: number | null
  distance_km: number | null
  feeling_note: string | null
  template_id: string | null
  workout_templates?: { name: string } | null
}

const TYPE_ICON: Record<string, string> = {
  strength: '🏋️',
  run: '🏃',
}

const RUN_ICON: Record<string, string> = {
  easy: '🟢',
  tempo: '🟡',
  interval: '🔴',
}

export default function HomePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [recent, setRecent] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [today] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/sessions?limit=7').then(r => r.json()),
    ]).then(([tmpl, sess]) => {
      setTemplates(tmpl)
      setRecent(sess)
    })
  }, [])

  async function startSession(template: Template) {
    setLoading(true)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        template_id: template.id,
        type: template.type,
      }),
    })
    const session = await res.json()
    router.push(`/workout/${session.id}`)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const strength = templates.filter(t => t.type === 'strength')
  const runs = templates.filter(t => t.type === 'run')

  return (
    <div className="px-4 pt-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Hôm nay tập gì?</h1>
          <p className="text-sm text-gray-500">{formatDate(today)}</p>
        </div>
        <button
          onClick={logout}
          className="text-xs text-gray-600 px-3 py-1.5 rounded-lg border border-gray-800"
        >
          Đăng xuất
        </button>
      </div>

      {/* Kháng lực */}
      <section>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2.5">
          Kháng lực
        </p>
        <div className="space-y-2">
          {strength.map(t => (
            <button
              key={t.id}
              onClick={() => startSession(t)}
              disabled={loading}
              className="w-full card p-4 flex items-center gap-3 text-left
                         active:bg-gray-800 transition-colors"
            >
              <span className="text-2xl">🏋️</span>
              <div className="flex-1">
                <p className="font-medium text-gray-100 text-sm">{t.name}</p>
              </div>
              <span className="text-gray-600 text-lg">›</span>
            </button>
          ))}
        </div>
      </section>

      {/* Chạy bộ */}
      <section>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2.5">
          Chạy bộ
        </p>
        <div className="space-y-2">
          {runs.map(t => (
            <button
              key={t.id}
              onClick={() => startSession(t)}
              disabled={loading}
              className="w-full card p-4 flex items-center gap-3 text-left
                         active:bg-gray-800 transition-colors"
            >
              <span className="text-2xl">{RUN_ICON[t.run_type ?? ''] ?? '🏃'}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-100 text-sm">{t.name}</p>
              </div>
              <span className="text-gray-600 text-lg">›</span>
            </button>
          ))}
        </div>
      </section>

      {/* Nghỉ */}
      <button
        onClick={async () => {
          setLoading(true)
          const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: today, type: 'strength', name_override: 'Nghỉ ngơi' }),
          })
          const s = await res.json()
          router.push(`/summary/${s.id}`)
        }}
        disabled={loading}
        className="w-full card p-4 flex items-center gap-3 text-left active:bg-gray-800"
      >
        <span className="text-2xl">😴</span>
        <p className="font-medium text-gray-400 text-sm">Nghỉ ngơi hôm nay</p>
      </button>

      {/* Lịch sử gần đây */}
      {recent.length > 0 && (
        <section>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2.5">
            7 buổi gần nhất
          </p>
          <div className="space-y-1.5">
            {recent.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/summary/${s.id}`)}
                className="w-full card px-4 py-3 flex items-center gap-3 text-left
                           active:bg-gray-800 transition-colors"
              >
                <span className="text-base">{TYPE_ICON[s.type] ?? '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {s.name_override || (s as any).workout_templates?.name || '—'}
                  </p>
                  <p className="text-xs text-gray-600">{formatDate(s.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  {s.duration_seconds ? (
                    <p className="text-xs text-gray-500">{formatDuration(s.duration_seconds)}</p>
                  ) : null}
                  {s.distance_km ? (
                    <p className="text-xs text-gray-500">{s.distance_km} km</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
