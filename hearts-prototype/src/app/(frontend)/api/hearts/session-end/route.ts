import { NextResponse } from 'next/server'
import { authCookie } from '@/lib/cookies'
import { getPayloadClient } from '@/server/context'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const payload = await getPayloadClient()
  const reason = new URL(req.url).searchParams.get('reason')
  const error = reason === 'paused' ? 'This account is paused. Please speak to your masjid or school.' : 'Please sign in again.'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const url = new URL('/login', host ? `${proto}://${host}` : req.url)
  url.searchParams.set('error', error)
  const response = NextResponse.redirect(url, 303)
  response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, '', 0))
  return response
}
