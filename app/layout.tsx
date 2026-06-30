import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fitness Tracker',
  description: 'Personal workout & running tracker',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0ea5e9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <div className="max-w-md mx-auto min-h-screen relative">
          {children}
        </div>
      </body>
    </html>
  )
}
