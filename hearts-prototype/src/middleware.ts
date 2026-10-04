import { NextResponse, type NextRequest } from 'next/server'

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
  const headers = new Headers(request.headers)
  headers.set('x-hearts-path', `${pathname}${search}`)
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/', '/p/:path*', '/master/:path*', '/admin/create-first-user', '/admin/create-first-user/', '/api/users/first-register', '/api/users/first-register/'] }
