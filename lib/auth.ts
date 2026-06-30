import { getIronSession, IronSessionData } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

declare module 'iron-session' {
  interface IronSessionData {
    authenticated?: boolean
  }
}

export const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET!, // min 32 chars
  cookieName: 'ft_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<IronSessionData>(cookieStore, SESSION_OPTIONS)
}

export async function requireAuth(): Promise<void | NextResponse> {
  const session = await getSession()
  if (!session.authenticated) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'))
  }
}

export function checkPassword(input: string): boolean {
  return input === process.env.APP_PASSWORD
}
