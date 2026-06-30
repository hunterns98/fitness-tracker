import { NextRequest, NextResponse } from 'next/server'
import { getIronSession, IronSessionData } from 'iron-session'
import { SESSION_OPTIONS } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const session = await getIronSession<IronSessionData>(req, res, SESSION_OPTIONS)
  session.destroy()
  return res
}
