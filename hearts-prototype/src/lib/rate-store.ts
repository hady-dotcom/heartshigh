/**
 * Shared rate-limit store. Memory stays for unit tests and as a last resort;
 * when Payload is passed, hits are counted in the `rate-hits` collection so
 * limits hold across servers.
 */

import type { Payload } from 'payload'
import { hit, limitsRelaxed, type LimitResult } from './rate-limit'

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000
export const ANSWER_PER_HOUR = 30
export const UPLOAD_PER_HOUR = 10
export const REPORT_PER_DAY = 10
export const JOIN_PER_CODE_IP = 12
export const GATHER_POST_PER_HOUR = 20

export async function hitShared(
  payload: Payload | null | undefined,
  key: string,
  limit: number,
  windowMs: number,
  at = Date.now(),
  env: Record<string, string | undefined> = process.env,
): Promise<LimitResult> {
  if (limitsRelaxed(env)) return { allowed: true, retryAfterSec: 0, count: 0 }
  if (!payload) return hit(key, limit, windowMs, at)
  try {
    const since = new Date(at - windowMs).toISOString()
    const found = await payload.find({
      collection: 'rate-hits',
      overrideAccess: true,
      depth: 0,
      limit: limit + 1,
      sort: 'at',
      where: { and: [{ key: { equals: key } }, { at: { greater_than: since } }] },
    })
    if (found.docs.length >= limit) {
      const first = new Date(String((found.docs[0] as { at?: string }).at || since)).getTime()
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((first + windowMs - at) / 1000)), count: found.docs.length }
    }
    await payload.create({ collection: 'rate-hits', overrideAccess: true, data: { key, at: new Date(at).toISOString() } as never })
    return { allowed: true, retryAfterSec: 0, count: found.docs.length + 1 }
  } catch {
    return hit(key, limit, windowMs, at)
  }
}

export function uploadKey(userId: number) {
  return `upload-user:${userId}`
}

export function answerHourKey(userId: number) {
  return `answer-hour:${userId}`
}

export function gatherPostKey(userId: number) {
  return `gather-post:${userId}`
}

export function joinCodeIpKey(ip: string | null, code: string) {
  return `join-code-ip:${ip || 'unknown'}:${code}`
}
