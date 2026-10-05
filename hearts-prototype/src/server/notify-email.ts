import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { isQuietHour, NOTIFY_DEBOUNCE_MS } from '@/lib/account-rules'
import { kindFromKey, parsePrefs, type NotifyKind, unsubscribeToken, wantsEmail, wantsInApp } from '@/lib/notify-prefs'
import { portalTimeZone } from '@/lib/zone-time'
import { mailPublicUrl, sendMail } from './mail'
import { idOf } from '@/lib/ids'

type Person = {
  id: number
  email?: string | null
  name?: string | null
  notificationPrefs?: unknown
  nightAlerts?: boolean | null
  tenants?: { tenant?: unknown }[]
}

export async function sendQueuedNotification(
  payload: Payload,
  args: { userId: number; portalId?: number | null; kind: NotifyKind; title: string; body?: string; href?: string; key?: string },
) {
  const person = (await payload.findByID({ collection: 'users', id: args.userId, overrideAccess: true, depth: 0 }).catch(() => null)) as Person | null
  if (!person) return { sent: false, reason: 'missing' as const }
  const prefs = parsePrefs(person.notificationPrefs, person.nightAlerts)
  if (wantsInApp(prefs, args.kind)) {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        user: args.userId,
        portal: args.portalId || undefined,
        title: args.title,
        body: args.body,
        href: args.href || '/',
        channel: 'in-app',
        key: args.key,
      },
    })
  }
  if (!wantsEmail(prefs, args.kind) || !person.email) return { sent: false, reason: 'pref-off' as const }
  if (prefs.quietNight) {
    const portal = args.portalId
      ? ((await payload.findByID({ collection: 'portals', id: args.portalId, overrideAccess: true, depth: 0 }).catch(() => null)) as { timeZone?: string } | null)
      : null
    if (isQuietHour(now(), portalTimeZone(portal))) return { sent: false, reason: 'quiet' as const }
  }
  const since = new Date(now().getTime() - NOTIFY_DEBOUNCE_MS).toISOString()
  const recent = await payload.find({
    collection: 'notifications',
    overrideAccess: true,
    limit: 5,
    where: {
      and: [
        { user: { equals: args.userId } },
        { key: { like: `n:${args.kind}:` } },
        { channel: { contains: 'email' } },
        { updatedAt: { greater_than_equal: since } },
      ],
    },
  })
  if (recent.docs.length) return { sent: false, reason: 'debounce' as const }
  const unsub = mailPublicUrl(`/unsubscribe?token=${unsubscribeToken(person.id, args.kind)}&user=${person.id}&kind=${args.kind}`)
  const mailed = await sendMail(payload, {
    to: person.email,
    kind: args.kind,
    vars: { name: person.name || undefined, buttonUrl: args.href ? mailPublicUrl(args.href) : undefined, extra: args.body },
    unsubscribeUrl: unsub,
  })
  if (mailed.sent) {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        user: args.userId,
        portal: args.portalId || undefined,
        title: args.title,
        body: args.body,
        href: args.href || '/',
        channel: 'in-app,email',
        key: args.key || `n:${args.kind}:${now().toISOString()}`,
      },
    })
  }
  return mailed
}

export async function emailPendingNotifications(payload: Payload) {
  const rows = await payload.find({
    collection: 'notifications',
    overrideAccess: true,
    depth: 1,
    limit: 100,
    sort: 'createdAt',
    where: { and: [{ channel: { equals: 'in-app' } }, { key: { like: 'n:' } }] },
  })
  let sent = 0
  for (const row of rows.docs as { id: number; user?: unknown; portal?: unknown; title?: string; body?: string; href?: string; key?: string; createdAt?: string }[]) {
    const kind = kindFromKey(row.key)
    if (!kind) continue
    if (now().getTime() - new Date(String(row.createdAt)).getTime() < 30_000) continue
    const userId = idOf(row.user)
    if (!userId) continue
    const person = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, depth: 0 }).catch(() => null)) as Person | null
    if (!person) continue
    const prefs = parsePrefs(person.notificationPrefs, person.nightAlerts)
    if (!wantsEmail(prefs, kind)) continue
    const result = await sendQueuedNotification(payload, {
      userId,
      portalId: idOf(row.portal),
      kind,
      title: row.title || KIND_SAFE[kind],
      body: row.body || undefined,
      href: row.href || '/',
      key: `${row.key}:mail`,
    })
    if (result.sent) {
      sent += 1
      await payload.update({ collection: 'notifications', id: row.id, overrideAccess: true, data: { channel: 'in-app,email' } as never })
    }
  }
  return sent
}

const KIND_SAFE: Record<NotifyKind, string> = {
  'teacher-reply': 'Your teacher replied',
  'future-question': 'A question opened',
  'live-soon': 'A live sitting is about to start',
  'gather-tomorrow': 'A gathering is tomorrow',
  'study-plan': 'A study plan was shared',
  weekly: 'Your week on HEARTS',
}
