import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  if (pathname === '/' && searchParams.get('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/join'
    return NextResponse.redirect(url)
  }
  const headers = new Headers(request.headers)
  headers.set('x-hearts-path', `${pathname}${search}`)
  return NextResponse.next({ request: { headers } })
}

export const config = { matcher: ['/', '/p/:path*', '/master/:path*'] }
