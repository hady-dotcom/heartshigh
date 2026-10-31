/** Cloudflare Turnstile. Off when the keys are missing, so local and e2e runs stay unchanged. */

export type Env = Record<string, string | undefined>
export type TurnstileCheck = { ok: true; skipped?: boolean } | { ok: false; error: string }

const DEFAULT_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const HUMAN = 'Please confirm you are a person, then try again.'

export function turnstileSiteKey(env: Env = process.env) {
  return (env.TURNSTILE_SITE_KEY || '').trim()
}

export function turnstileSecret(env: Env = process.env) {
  return (env.TURNSTILE_SECRET_KEY || '').trim()
}

/** Both keys must be set. One key alone is treated as off, so a half-configured host does not lock people out. */
export function turnstileEnabled(env: Env = process.env) {
  return Boolean(turnstileSiteKey(env) && turnstileSecret(env))
}

export function turnstileToken(form: FormData | { get?: (key: string) => unknown } | null | undefined) {
  if (!form || typeof form.get !== 'function') return ''
  return String(form.get('cf-turnstile-response') || form.get('turnstile') || '').trim()
}

export async function verifyTurnstile(
  token: string,
  ip: string | null,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileCheck> {
  if (!turnstileEnabled(env)) return { ok: true, skipped: true }
  if (!token) return { ok: false, error: HUMAN }
  const body = new URLSearchParams({ secret: turnstileSecret(env), response: token })
  if (ip) body.set('remoteip', ip)
  const url = (env.TURNSTILE_VERIFY_URL || '').trim() || DEFAULT_VERIFY
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await response.json().catch(() => null)) as { success?: boolean } | null
    if (data?.success) return { ok: true }
    return { ok: false, error: HUMAN }
  } catch {
    return { ok: false, error: HUMAN }
  }
}

/** Form posts: a human sentence when the widget fails, or null when the check is skipped or passed. */
export async function checkTurnstile(
  form: FormData | { get?: (key: string) => unknown } | null | undefined,
  ip: string | null,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const result = await verifyTurnstile(turnstileToken(form), ip, env, fetchImpl)
  return result.ok ? null : result.error
}
