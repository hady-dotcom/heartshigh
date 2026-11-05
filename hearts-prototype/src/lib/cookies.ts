import { cookiesSecure, type Env } from './env'

/** HttpOnly session cookie. Secure is always on in production, including behind a proxy that speaks HTTP to the app. */
export function authCookie(name: string, value: string, maxAge: number, env: Env = process.env) {
  const secure = cookiesSecure(env) ? '; Secure' : ''
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}
