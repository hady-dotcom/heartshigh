import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { deleteIsDue } from '@/lib/account-rules'
import { notifyKey } from '@/lib/notify-prefs'
import { idOf } from '@/lib/ids'
import { eraseUser } from './erase-user'
import { scanLiveReminders } from './live-email'
import { emailPendingNotifications, sendQueuedNotification } from './notify-email'
import { sendMail } from './mail'
import { audit } from './viewas'

export async function runDeletionWipes(payload: Payload) {
  const found = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 200,
  })
  const results: { id: number; ok: boolean; pending?: boolean; error?: string }[] = []
  for (const person of found.docs as { id: number; name?: string; email?: string; deletionRequestedAt?: string }[]) {
    if (!person.deletionRequestedAt || !deleteIsDue(person.deletionRequestedAt, now())) continue
    const wiped = await eraseUser(payload, {
      actor: { id: person.id, role: 'learner', name: person.name },
      userId: person.id,
      confirmName: String(person.name || person.email || ''),
    })
    if (wiped.ok) {
      await sendMail(payload, { to: person.email, kind: 'delete-done', vars: { name: person.name || undefined } })
      await audit(payload, 'account.deleted', { actor: person.id, target: person.id, detail: { via: 'cooling-off' } })
    }
    results.push({ id: person.id, ok: wiped.ok, pending: 'pending' in wiped ? wiped.pending : undefined, error: 'error' in wiped ? wiped.error : undefined })
  }
  return results
}

export async function emailGatherTomorrow(payload: Payload) {
  const start = new Date(now())
  start.setHours(0, 0, 0, 0)
  const tomorrow = new Date(start.getTime() + 86_400_000)
  const dayAfter = new Date(start.getTime() + 2 * 86_400_000)
  let emailed = 0
  const events = await payload.find({
    collection: 'events',
    overrideAccess: true,
    depth: 0,
    limit: 50,
    where: { and: [{ startsAt: { greater_than_equal: tomorrow.toISOString() } }, { startsAt: { less_than: dayAfter.toISOString() } }] },
  })
  for (const event of events.docs as { id: number; title?: string; portal?: unknown }[]) {
    const rsvps = await payload.find({
      collection: 'rsvps',
      overrideAccess: true,
      depth: 0,
      limit: 500,
      where: { event: { equals: event.id } },
    })
    for (const rsvp of rsvps.docs as { user?: unknown }[]) {
      const userId = idOf(rsvp.user)
      if (!userId) continue
      const result = await sendQueuedNotification(payload, {
        userId,
        portalId: idOf(event.portal),
        kind: 'gather-tomorrow',
        title: event.title || 'A gathering is tomorrow',
        href: '/',
        key: notifyKey('gather-tomorrow', String(event.id)),
      })
      if (result.sent) emailed += 1
    }
  }
  const gatherings = 'gatherings' in (payload.collections || {})
    ? await payload.find({
        collection: 'gatherings',
        overrideAccess: true,
        depth: 0,
        limit: 50,
        where: { and: [{ startsAt: { greater_than_equal: tomorrow.toISOString() } }, { startsAt: { less_than: dayAfter.toISOString() } }] } as never,
      }).catch(() => ({ docs: [] }))
    : { docs: [] }
  for (const gathering of gatherings.docs as { id: number; title?: string; portal?: unknown }[]) {
    const rsvps = await payload.find({
      collection: 'gather-rsvps',
      overrideAccess: true,
      depth: 0,
      limit: 500,
      where: { gathering: { equals: gathering.id } },
    }).catch(() => ({ docs: [] }))
    for (const rsvp of rsvps.docs as { user?: unknown }[]) {
      const userId = idOf(rsvp.user)
      if (!userId) continue
      const result = await sendQueuedNotification(payload, {
        userId,
        portalId: idOf(gathering.portal),
        kind: 'gather-tomorrow',
        title: gathering.title || 'A gathering is tomorrow',
        href: '/',
        key: notifyKey('gather-tomorrow', `g-${gathering.id}`),
      })
      if (result.sent) emailed += 1
    }
  }
  return emailed
}

export async function runAccountJobs(payload: Payload) {
  const deletions = await runDeletionWipes(payload)
  const notifications = await emailPendingNotifications(payload)
  const gatherings = await emailGatherTomorrow(payload)
  const live = await scanLiveReminders(payload)
  return { deletions, notifications, gatherings, live }
}
