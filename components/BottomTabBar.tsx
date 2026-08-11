'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// V2-S1 — 4 tab cố định theo Architecture Lock. Không thêm tab nào khác.
// Ẩn hoàn toàn khi đang ở full-screen Workout Logging (/w/[sessionId]) —
// việc ẩn được quyết định ở app/(v2)/layout.tsx (nơi gọi component này),
// component này chỉ chịu trách nhiệm render 4 tab, không tự quyết định ẩn/hiện.
const TABS = [
  { href: '/today', label: 'Today', icon: '🏠' },
  { href: '/history', label: 'History', icon: '📅' },
  { href: '/progress', label: 'Progress', icon: '📈' },
  { href: '/more', label: 'More', icon: '⋯' },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }} className="flex">
        {TABS.map(tab => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ minHeight: 56, color: active ? 'var(--brand)' : 'var(--text-3)' }}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
