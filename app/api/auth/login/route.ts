import { NextRequest, NextResponse } from 'next/server'
import { getIronSession, IronSessionData } from 'iron-session'
import { SESSION_OPTIONS, checkPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const session = await getIronSession<IronSessionData>(req, res, SESSION_OPTIONS)
  session.authenticated = true
  await session.save()

  return res
}
