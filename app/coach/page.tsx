'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'week' | 'month'

// Simple markdown renderer
function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-base font-bold mt-5 mb-2 flex items-center gap-2"
          style={{ color: 'var(--text)' }}>
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={key++} className="text-sm font-semibold mt-2" style={{ color: 'var(--text)' }}>
          {line.replace(/\*\*/g, '')}
        </p>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.replace(/^[-•] /, '')
      // Handle inline bold
      const parts = content.split(/\*\*(.*?)\*\*/)
      elements.push(
        <div key={key++} className="flex gap-2 mt-1">
          <span className="text-sm mt-0.5 shrink-0" style={{ color: 'var(--brand)' }}>•</span>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {parts.map((p, i) => i % 2 === 1
              ? <strong key={i} style={{ color: 'var(--text)' }}>{p}</strong>
              : p
            )}
          </p>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />)
    } else if (line.trim()) {
      const parts = line.split(/\*\*(.*?)\*\*/)
      elements.push(
        <p key={key++} className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {parts.map((p, i) => i % 2 === 1
            ? <strong key={i} style={{ color: 'var(--text)' }}>{p}</strong>
            : p
          )}
        </p>
      )
    }
  }
  return <div>{elements}</div>
}

export default function CoachPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('week')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    analysis: string
    period: { from: string; to: string }
    stats: { sessions: number; strengthSessions: number; runSessions: number }
  } | null>(null)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Lỗi phân tích')
      } else {
        setResult(data)
      }
    } catch {
      setError('Lỗi kết nối')
    }
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <div>
          <p className="font-bold" style={{ color: 'var(--text)' }}>🤖 AI Coach</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>Phân tích bởi Claude</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 fade-in">
        {/* Mode selector */}
        <div>
          <p className="section-label mb-2">Phân tích theo</p>
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
            {(['week', 'month'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: mode === m ? 'var(--brand)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-3)',
                }}>
                {m === 'week' ? '📅 7 ngày qua' : '🗓 30 ngày qua'}
              </button>
            ))}
          </div>
        </div>

        {/* Analyze button */}
        {!loading && !result && (
          <div className="card p-6 text-center space-y-4">
            <div className="text-5xl">🤖</div>
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Phân tích tiến trình</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                AI sẽ đọc dữ liệu tập luyện, giấc ngủ và cơ thể của bạn, sau đó đưa ra đánh giá theo 5 góc độ.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-left rounded-xl p-3"
              style={{ background: 'var(--surface-2)' }}>
              {['💪 Tiến triển tập luyện', '🏗 Tăng cơ', '🏃 Chạy bộ', '⚖️ Body recomposition', '🛡 Phục hồi & Chấn thương'].map(item => (
                <span key={item} style={{ color: 'var(--text-2)' }}>{item}</span>
              ))}
            </div>
            <button onClick={analyze} className="btn-primary">
              Phân tích {mode === 'week' ? '7 ngày' : '30 ngày'} qua
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card p-8 text-center space-y-4">
            <div className="text-4xl animate-pulse">🤖</div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Đang phân tích...</p>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Claude đang đọc dữ liệu và tổng hợp. Thường mất 15–30 giây.
            </p>
            <div className="flex justify-center gap-1 pt-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--brand)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card p-4 space-y-3" style={{ border: '1.5px solid var(--danger)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>❌ {error}</p>
            <button onClick={analyze} className="btn-primary py-2.5 text-sm">Thử lại</button>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-4 fade-in">
            {/* Meta */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'var(--brand-light)' }}>
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--brand-dark)' }}>
                  Phân tích {formatDate(result.period.from)} – {formatDate(result.period.to)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--brand)' }}>
                  {result.stats.sessions} buổi tập · {result.stats.strengthSessions} kháng lực · {result.stats.runSessions} chạy bộ
                </p>
              </div>
            </div>

            {/* Analysis content */}
            <div className="card p-5">
              <MarkdownBlock text={result.analysis} />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setResult(null); setError('') }} className="flex-1 btn-ghost">
                Phân tích lại
              </button>
              <button onClick={() => setMode(m => m === 'week' ? 'month' : 'week')}
                className="flex-1 btn-ghost">
                Đổi sang {mode === 'week' ? '30 ngày' : '7 ngày'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
