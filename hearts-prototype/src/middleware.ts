import { NextResponse, type NextRequest } from 'next/server'
import { demoWriteBlocked } from '@/lib/parenting-demo'
import { helperTokenFlash } from '@/lib/helper-token-flash'
import { stageFlagRedirect, stageWriteBlocked } from '@/lib/stage-readonly'

/** Role saved on the admin session cookie. Unverified: the desk still checks the account. */
function tokenRole(token: string) {
  const part = token.split('.')[1]
  if (!part) return ''
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4)
    const json = JSON.parse(atob(padded)) as { role?: unknown }
    return typeof json.role === 'string' ? json.role : ''
  } catch {
    return ''
  }
}

/**
 * Masters never land on Payload's collections list. /admin/cms is the custom desk.
 * Collection edit pages and everyone else's sign-in stay where they are.
 */
function adminLanding(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname } = request.nextUrl
  const dashboard = pathname === '/admin' || pathname === '/admin/'
  const cms = pathname === '/admin/cms' || pathname === '/admin/cms/'
  if (!dashboard && !cms) return null
  const role = tokenRole(request.cookies.get('payload-token')?.value || '')
  if (role !== 'master') {
    if (!cms) return null
    const back = new URL('/admin', request.url)
    back.search = ''
    return NextResponse.redirect(back)
  }
  if (dashboard) return NextResponse.redirect(new URL(`/admin/cms${request.nextUrl.search}`, request.url))
  const headers = new Headers(request.headers)
  const cookie = request.cookies.getAll().map((item) => `${item.name}=${item.value}`).join('; ')
  if (cookie) headers.set('cookie', cookie)
  headers.set('x-hearts-path', `${pathname}${request.nextUrl.search}`)
  return NextResponse.rewrite(new URL(`/master${request.nextUrl.search}`, request.url), { request: { headers } })
}

// Payload's "create the first user" screen and endpoint. The first account comes only from `npm run bootstrap`
// (or the seed on a development machine), so both are closed everywhere.
const FIRST_USER_PATHS = [/^\/admin\/create-first-user\/?$/, /^\/api\/users\/first-register\/?$/]

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  const here = `${pathname}${search}`
  const referer = request.headers.get('referer')
  if (stageWriteBlocked(request.method, here, referer)) {
    return NextResponse.json({ error: 'The demo stage only looks. Nothing here is saved.' }, { status: 403 })
  }
  if (demoWriteBlocked(request.method, here, referer)) {
    return NextResponse.json({ error: 'This practice view cannot change the real course.' }, { status: 403 })
  }
  if (stageFlagRedirect({ method: request.method, url: here, referer, dest: request.headers.get('sec-fetch-dest') })) {
    const next = request.nextUrl.clone()
    next.searchParams.set('stage', '1')
    return NextResponse.redirect(next)
  }
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
  const landing = adminLanding(request)
  if (landing) return landing
  const headers = new Headers(request.headers)
  headers.set('x-hearts-path', `${pathname}${search}`)
  const lookParam = searchParams.get('look')
  const storedLook = request.cookies.get('hh_look')?.value || ''
  const lookOn = lookParam === 'off' ? false : lookParam === 'apple' ? true : storedLook !== 'off'
  if (lookOn) headers.set('x-hh-look', 'apple')
  const response = NextResponse.next({ request: { headers } })
  const lookCookie = { path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' }
  if (lookParam === 'apple') response.cookies.set('hh_look', '', { ...lookCookie, maxAge: 0 })
  if (lookParam === 'off') response.cookies.set('hh_look', 'off', { ...lookCookie, maxAge: 60 * 60 * 24 * 14 })
  const door = pathname.match(/^\/p\/([a-z0-9-]{1,80})(?:\/|$)/i)
  if (door) {
    response.cookies.set('hh_door', door[1], { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' })
  }
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

export const config = { matcher: ['/', '/demo', '/change-password', '/p/:path*', '/master', '/master/:path*', '/api/:path*', '/admin', '/admin/', '/admin/cms', '/admin/cms/', '/admin/create-first-user', '/admin/create-first-user/', '/api/users/first-register', '/api/users/first-register/'] }
