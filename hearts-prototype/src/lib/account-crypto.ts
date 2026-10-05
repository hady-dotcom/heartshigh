import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'node:crypto'
import { payloadSecret } from './env'

function key(secret = payloadSecret()) {
  return scryptSync(secret, 'hearts-account-v1', 32)
}

export function hashToken(token: string, secret = payloadSecret()) {
  return createHash('sha256').update(`${secret}:${token}`).digest('hex')
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

export function encryptSecret(plain: string, secret = payloadSecret()) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`
}

export function decryptSecret(blob: string, secret = payloadSecret()) {
  const [ivHex, tagHex, encHex] = blob.split('.')
  if (!ivHex || !tagHex || !encHex) throw new Error('That secret could not be read.')
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}

export type HalfSession = { userId: number; token: string; setup?: boolean; exp: number }

export function signHalfSession(data: HalfSession, secret = payloadSecret()) {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function readHalfSession(value: string | null | undefined, secret = payloadSecret(), nowMs = Date.now()): HalfSession | null {
  if (!value || !value.includes('.')) return null
  const [body, sig] = value.split('.')
  const expect = createHmac('sha256', secret).update(body).digest('base64url')
  if (expect.length !== sig.length || !createHash('sha256').update(expect).digest().equals(createHash('sha256').update(sig).digest())) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as HalfSession
    if (!data.userId || !data.token || !data.exp || data.exp < nowMs) return null
    return data
  } catch {
    return null
  }
}

export function halfCookie(value: string | null, maxAge = 600) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return value
    ? `hearts_half=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
    : `hearts_half=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function cookieNamed(header: string | null | undefined, name: string) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [keyName, ...rest] = part.trim().split('=')
    if (keyName === name) return decodeURIComponent(rest.join('='))
  }
  return null
}
