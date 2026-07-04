'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push(from); router.refresh() }
    else { setError('Sai mật khẩu'); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl"
            style={{ background: 'linear-gradient(135deg, #0EA5E9, #6366F1)' }}>
            🏃
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Fitness Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Nhập mật khẩu để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            autoFocus
            className="input"
          />
          {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="submit" disabled={loading || !password} className="btn-primary">
            {loading ? 'Đang kiểm tra...' : 'Vào app'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
