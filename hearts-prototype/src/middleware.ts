import { NextResponse, type NextRequest } from 'next/server'
import { helperTokenFlash } from '@/lib/helper-token-flash'
import { cookieHeaderForSlot, demoCookieName, parseDemoFrame } from '@/lib/demo-stage'

// Payload's "create the first user" screen and endpoint. The first account comes only from `npm run bootstrap`
// (or the seed on a development machine), so both are closed everywhere.
const FIRST_USER_PATHS = [/^\/admin\/create-first-user\/?$/, /^\/api\/users\/first-register\/?$/]

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  if (FIRST_USER_PATHS.some((pattern) => pattern.test(pathname))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ errors: [{ message: 'The first account is created with npm run bootstrap.' }] }, { status: 403 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (pathname === '/' && searchParams.get('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/join'
    return NextResponse.redirect(url)
  }
  const frame = parseDemoFrame(pathname)
  const headers = new Headers(request.headers)
  headers.set('x-hearts-path', `${pathname}${search}`)
  if (frame) {
    const token = request.cookies.get(demoCookieName(frame.slot))?.value || ''
    headers.set('cookie', cookieHeaderForSlot(headers.get('cookie'), token || null))
    headers.set('x-demo-slot', frame.slot)
    const url = request.nextUrl.clone()
    url.pathname = frame.rest
    const response = NextResponse.rewrite(url, { request: { headers } })
    if (!request.cookies.get('hearts_device')) {
      const id = `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24)
      response.cookies.set('hearts_device', id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 400, secure: process.env.NODE_ENV === 'production' })
    }
    return response
  }
  const response = NextResponse.next({ request: { headers } })
  if (!request.cookies.get('hearts_device')) {
    const id = `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24)
    response.cookies.set('hearts_device', id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 400, secure: process.env.NODE_ENV === 'production' })
  }
  if (pathname.includes('/bring-in')) {
    const flash = helperTokenFlash({
      once: request.cookies.get('hearts_helper_once')?.value,
      seen: request.cookies.get('hearts_helper_seen')?.value,
    })
    const cookieBase = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }
    if (flash.setSeen) response.cookies.set('hearts_helper_seen', '1', { ...cookieBase, maxAge: 180 })
    if (flash.clear) {
      response.cookies.set('hearts_helper_once', '', { ...cookieBase, maxAge: 0 })
      response.cookies.set('hearts_helper_seen', '', { ...cookieBase, maxAge: 0 })
    }
  }
  return response
}

export const config = { matcher: ['/', '/p/:path*', '/master/:path*', '/demo-stage/:path*', '/api/experiments', '/admin/create-first-user', '/admin/create-first-user/', '/api/users/first-register', '/api/users/first-register/'] }
