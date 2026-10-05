import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { eventIcs } from '@/lib/ics'
import { notifyKey } from '@/lib/notify-prefs'
import { idOf } from '@/lib/ids'
import { sendQueuedNotification } from './notify-email'

/**
 * V03 hook. LV owns `server/live.ts`. Call `emailLiveStartingSoon(payload, session)` from there
 * when a sitting is an hour out, or let the account job scan `live-sessions` if that collection exists.
 */
export async function emailLiveStartingSoon(
  payload: Payload,
  session: { id: number; title?: string; startsAt?: string; portal?: unknown },
) {
  const portalId = idOf(session.portal)
  if (!portalId || !session.startsAt) return 0
  const people = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { 'tenants.tenant': { equals: portalId } },
  })
  let sent = 0
  for (const person of people.docs as { id: number }[]) {
    const result = await sendQueuedNotification(payload, {
      userId: person.id,
      portalId,
      kind: 'live-soon',
      title: session.title || 'A live sitting',
      body: 'It starts in about an hour.',
      href: '/',
      key: notifyKey('live-soon', String(session.id)),
    })
    if (result.sent) sent += 1
  }
  return sent
}

export function liveEventIcs(session: { id: number; title?: string; startsAt: string; url?: string }) {
  return eventIcs({
    title: session.title || 'HEARTS live sitting',
    startsAt: new Date(session.startsAt),
    minutes: 60,
    url: session.url,
    uid: `hearts-live-${session.id}@hearts`,
    description: 'A live sitting on HEARTS.',
  })
}

export async function scanLiveReminders(payload: Payload) {
  const collections = payload.collections || {}
  if (!('live-sessions' in collections)) return { scanned: 0, emailed: 0 }
  const start = new Date(now().getTime() + 50 * 60_000)
  const end = new Date(now().getTime() + 70 * 60_000)
  const found = await payload.find({
    collection: 'live-sessions' as 'users',
    overrideAccess: true,
    depth: 0,
    limit: 50,
    where: { and: [{ startsAt: { greater_than_equal: start.toISOString() } }, { startsAt: { less_than_equal: end.toISOString() } }] } as never,
  })
  let emailed = 0
  for (const row of found.docs as { id: number; title?: string; startsAt?: string; portal?: unknown }[]) {
    emailed += await emailLiveStartingSoon(payload, row)
  }
  return { scanned: found.docs.length, emailed }
}
