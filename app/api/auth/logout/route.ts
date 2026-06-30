import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SESSION_OPTIONS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const session = await getIronSession(req, res, SESSION_OPTIONS)
  session.destroy()
  return res
}
