'use client'
import { usePathname } from 'next/navigation'
import { BottomTabBar } from '@/components/BottomTabBar'

// V2-S1 — layout riêng cho nhóm route (v2), KHÔNG đụng app/layout.tsx (V1).
// Quy tắc ẩn tab bar: bất kỳ route nào bắt đầu bằng /w/ (full-screen
// Workout Logging) đều ẩn bottom nav, đúng Architecture Lock.
export default function V2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideNav = pathname?.startsWith('/w/') ?? false

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ paddingBottom: hideNav ? 0 : 64 }}>{children}</div>
      {!hideNav && <BottomTabBar />}
    </div>
  )
}

