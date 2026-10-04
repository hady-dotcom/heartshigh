import type { Payload } from 'payload'
import { DEMO_PORTAL_SLUG, liveDemoGuard, replayTitle } from '@/lib/live'
import { portalIdOf } from '@/lib/ids'
import type { SessionUser } from '@/server/context'

const DEMO_YOUTUBE = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
const HOST_EMAILS = ['demo-teacher@hearts.foundation', 'demo-admin@hearts.foundation']

type SeedResult = { ok: true; created: number; reused: number; live: boolean } | { ok: false; reason: string }

async function one(payload: Payload, collection: 'portals' | 'users' | 'live-sessions', where: unknown) {
  const found = await payload.find({ collection: collection as 'users', overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as { id: number } | undefined) || null
}

function later(days: number, hours = 19, minutes = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hours, minutes, 0, 0)
  return date
}

/** Seeds one scheduled session, and optionally one live session, on hearts-demo only. Never touches passwords. */
export async function seedLiveDemo(payload: Payload, options: { live?: boolean } = {}): Promise<SeedResult> {
  const portal = await one(payload, 'portals', { slug: { equals: DEMO_PORTAL_SLUG } })
  const guard = liveDemoGuard(portal ? DEMO_PORTAL_SLUG : null)
  if (!portal || guard) return { ok: false, reason: guard || `Refusing to seed live sessions. This script only touches ${DEMO_PORTAL_SLUG}.` }

  let host = null as { id: number; name: string } | null
  for (const email of HOST_EMAILS) {
    const user = await one(payload, 'users', { email: { equals: email } })
    if (!user) continue
    const full = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
    if (portalIdOf(full as SessionUser) !== portal.id) continue
    const role = String((full as { role?: string }).role || '')
    if (role !== 'teacher' && role !== 'portal-admin' && role !== 'master') continue
    host = { id: user.id, name: String((full as { name?: string }).name || 'Teacher') }
    break
  }
  if (!host) {
    const staff = await payload.find({
      collection: 'users',
      overrideAccess: true,
      depth: 0,
      limit: 20,
      where: { or: [{ role: { equals: 'teacher' } }, { role: { equals: 'portal-admin' } }] } as never,
    })
    for (const row of staff.docs) {
      if (portalIdOf(row as SessionUser) !== portal.id) continue
      host = { id: row.id, name: String((row as { name?: string }).name || 'Teacher') }
      break
    }
  }
  if (!host) return { ok: false, reason: 'hearts-demo has no teacher or portal admin to host a live session. Passwords were not changed.' }

  let created = 0
  let reused = 0
  const scheduledKey = 'live-demo-scheduled'
  const existingScheduled = await one(payload, 'live-sessions', { seedKey: { equals: scheduledKey } })
  if (existingScheduled) reused += 1
  else {
    await payload.create({
      collection: 'live-sessions' as 'users',
      overrideAccess: true,
      data: {
        portal: portal.id,
        title: 'Jumuʿah reminders',
        door: 16,
        host: host.id,
        hostName: host.name,
        source: 'youtube',
        sourceUrl: DEMO_YOUTUBE,
        youtubeId: 'jNQXAC9IVRw',
        status: 'scheduled',
        scheduledAt: later(2).toISOString(),
        seedKey: scheduledKey,
      } as never,
    })
    created += 1
  }

  const wantLive = Boolean(options.live)
  if (wantLive) {
    const liveKey = 'live-demo-live'
    const existingLive = await one(payload, 'live-sessions', { seedKey: { equals: liveKey } })
    if (existingLive) reused += 1
    else {
      await payload.create({
        collection: 'live-sessions' as 'users',
        overrideAccess: true,
        data: {
          portal: portal.id,
          title: 'Circle after Isha',
          door: 7,
          host: host.id,
          hostName: host.name,
          source: 'youtube',
          sourceUrl: DEMO_YOUTUBE,
          youtubeId: 'jNQXAC9IVRw',
          status: 'live',
          scheduledAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          seedKey: liveKey,
        } as never,
      })
      created += 1
    }
  }

  return { ok: true, created, reused, live: wantLive }
}

export const liveDemoYoutube = DEMO_YOUTUBE
export { replayTitle }
