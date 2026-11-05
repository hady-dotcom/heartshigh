import { NextResponse } from 'next/server'
import { clientIp, hitAuth, type AuthKind } from './rate-limit'
import { checkTurnstile } from './turnstile'

const MESSAGES: Record<AuthKind, string> = {
  login: 'Too many sign-in tries from here. Wait a few minutes, then try again.',
  join: 'Too many join tries from here. Wait a few minutes, then try again.',
  forgot: 'Too many password-reset tries from here. Wait a few minutes, then try again.',
  reset: 'Too many password-reset tries from here. Wait a few minutes, then try again.',
}

function tooManyHtml(message: string, retryAfterSec: number, back: string) {
  const body =
    '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Too many tries</title></head>' +
    `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><h1>Too many tries</h1><p>${message}</p>` +
    `<p><a href="${back}">Back</a></p></body></html>`
  return new NextResponse(body, {
    status: 429,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': String(Math.max(1, retryAfterSec)) },
  })
}

function redirect(req: Request, path: string, error: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  url.searchParams.set('error', error)
  return NextResponse.redirect(url, 303)
}

/** Turnstile, then the auth rate limit. Null means the request may continue. */
export async function gateAuth(
  req: Request,
  form: FormData | { get?: (key: string) => unknown } | null,
  kind: AuthKind,
  email: string,
  back: string,
) {
  const ip = clientIp(req)
  const turnstile = await checkTurnstile(form, ip)
  if (turnstile) return redirect(req, back, turnstile)
  const limit = hitAuth(kind, ip, email)
  if (!limit.allowed) return tooManyHtml(MESSAGES[kind], limit.retryAfterSec, back)
  return null
}

export function tooManyAnswers(retryAfterSec: number, asJson: boolean) {
  const message = 'You have sent quite a few answers. Wait a few minutes, then try again.'
  if (asJson) {
    return NextResponse.json({ error: message }, { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSec)) } })
  }
  return tooManyHtml(message, retryAfterSec, '/')
}
