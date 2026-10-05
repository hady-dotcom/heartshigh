import type { Payload, Where } from 'payload'
import { idOf, portalIdOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { screenAnswer } from '@/lib/answer-moderation'
import {
  REPORT_THANKS,
  SAFEGUARD_EMAIL_BODY,
  SAFEGUARD_EMAIL_SUBJECT,
  SLOW_DOWN,
  safeguardingFromReport,
  shouldAutoHide,
  tealMailHtml,
  type ReportReason,
  type TargetType,
} from '@/lib/safety'
import { safeguardingLead } from '@/lib/portal-contacts'
import { audit } from './viewas'
import type { SessionUser } from './context'

type Doc = Record<string, unknown> & { id: number }

export { REPORT_THANKS, SLOW_DOWN }

async function notify(payload: Payload, data: { user: number; portal?: number | null; title: string; body?: string; href?: string; key?: string }) {
  if (data.key) {
    const existing = await payload.find({ collection: 'notifications', overrideAccess: true, limit: 1, where: { and: [{ user: { equals: data.user } }, { key: { equals: data.key } }] } })
    if (existing.docs.length) return
  }
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { user: data.user, portal: data.portal || undefined, title: data.title, body: data.body, href: data.href || '/', channel: 'in-app', key: data.key },
  })
}

export async function trySendMail(payload: Payload, to: string, subject: string, text: string, html: string) {
  try {
    const send = (payload as { sendEmail?: (msg: { to: string; subject: string; html: string; text: string }) => Promise<unknown> }).sendEmail
    if (!send) return false
    await send({ to, subject, html, text })
    return true
  } catch {
    return false
  }
}

export async function isHidden(payload: Payload, targetType: string, targetId: number) {
  const found = await payload.find({
    collection: 'moderation-hides',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ targetType: { equals: targetType } }, { targetId: { equals: targetId } }, { hidden: { equals: true } }] },
  })
  return found.docs.length > 0
}

export async function hiddenIds(payload: Payload, targetType: string, ids: number[]) {
  if (!ids.length) return new Set<number>()
  const found = await payload.find({
    collection: 'moderation-hides',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { and: [{ targetType: { equals: targetType } }, { targetId: { in: ids } }, { hidden: { equals: true } }] },
  })
  return new Set(found.docs.map((row) => Number((row as { targetId?: number }).targetId)))
}

export async function setHidden(payload: Payload, portal: number, targetType: string, targetId: number, hidden: boolean, source: 'report' | 'screen' | 'staff', reason: string, by?: number) {
  const existing = await payload.find({
    collection: 'moderation-hides',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ targetType: { equals: targetType } }, { targetId: { equals: targetId } }] },
  })
  if (existing.docs[0]) {
    await payload.update({ collection: 'moderation-hides', id: existing.docs[0].id, overrideAccess: true, data: { hidden, source, reason, by, portal } as never })
    return
  }
  await payload.create({ collection: 'moderation-hides', overrideAccess: true, data: { portal, targetType, targetId, hidden, source, reason, by } as never })
}

export async function circleMutedUntil(payload: Payload, userId: number) {
  const found = await payload.find({
    collection: 'circle-mutes',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { user: { equals: userId } },
    sort: '-until',
  })
  const until = found.docs[0] ? new Date(String((found.docs[0] as { until?: string }).until)) : null
  if (!until || until.getTime() <= Date.now()) return null
  return until
}

export async function portalStaffIds(payload: Payload, portalId: number, roles: string[]) {
  const found = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 80,
    where: { and: [{ 'tenants.tenant': { equals: portalId } }, { role: { in: roles } }] },
  })
  return found.docs.map((row) => row.id)
}

export async function raiseSafeguarding(payload: Payload, opts: {
  portal: number
  learner: number
  source: 'crisis' | 'screen' | 'report'
  targetType?: string
  targetId?: number
}) {
  const existing = await payload.find({
    collection: 'safeguarding-alerts',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [
      { portal: { equals: opts.portal } },
      { learner: { equals: opts.learner } },
      { source: { equals: opts.source } },
      opts.targetId ? { targetId: { equals: opts.targetId } } : { id: { exists: true } },
    ] },
  })
  const alert = existing.docs[0]
    ? existing.docs[0]
    : await payload.create({
        collection: 'safeguarding-alerts',
        overrideAccess: true,
        data: { portal: opts.portal, learner: opts.learner, source: opts.source, targetType: opts.targetType, targetId: opts.targetId } as never,
      })
  const portal = await payload.findByID({ collection: 'portals', id: opts.portal, overrideAccess: true, depth: 0 }).catch(() => null) as { slug?: string } | null
  const slug = portal?.slug || ''
  const href = slug ? `/p/${slug}/admin/safety` : '/master/safety'
  const lead = await safeguardingLead(payload, opts.portal)
  const staff = await portalStaffIds(payload, opts.portal, ['portal-admin'])
  const masters = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 10, where: { role: { equals: 'master' } } })
  const recipients = new Set<number>([...staff, ...masters.docs.map((row) => row.id)])
  if (lead?.email) {
    const named = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 5, where: { email: { equals: lead.email } } })
    for (const row of named.docs) recipients.add(row.id)
    await trySendMail(
      payload,
      lead.email,
      SAFEGUARD_EMAIL_SUBJECT,
      SAFEGUARD_EMAIL_BODY,
      tealMailHtml(SAFEGUARD_EMAIL_SUBJECT, `<p>${SAFEGUARD_EMAIL_BODY}</p>`, href, 'Open Care and safety'),
    )
  }
  for (const userId of recipients) {
    await notify(payload, {
      user: userId,
      portal: opts.portal,
      title: 'A learner may need support',
      body: SAFEGUARD_EMAIL_BODY,
      href,
      key: `safeguard-${alert.id}`,
    })
  }
  return alert.id as number
}

export async function afterLearnerWords(payload: Payload, user: SessionUser, portal: number, text: string, target: { type: TargetType; id: number }, crisis = false) {
  const screen = screenAnswer(text)
  if (!screen.show) {
    await setHidden(payload, portal, target.type, target.id, true, 'screen', screen.reason)
  }
  if (crisis || screen.atRisk) {
    await raiseSafeguarding(payload, { portal, learner: user.id, source: crisis ? 'crisis' : 'screen', targetType: target.type, targetId: target.id })
  }
}

export async function fileReport(payload: Payload, user: SessionUser, input: {
  portal: number
  targetType: TargetType
  targetId: number
  reason: ReportReason
  note?: string
}) {
  const duplicate = await payload.find({
    collection: 'reports',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [
      { reporter: { equals: user.id } },
      { targetType: { equals: input.targetType } },
      { targetId: { equals: input.targetId } },
    ] },
  })
  if (duplicate.docs.length) return { ok: true as const, already: true, thanks: REPORT_THANKS }
  const report = await payload.create({
    collection: 'reports',
    overrideAccess: true,
    data: {
      reporter: user.id,
      portal: input.portal,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      note: (input.note || '').slice(0, 500),
      status: 'open',
    } as never,
  })
  const open = await payload.find({
    collection: 'reports',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ targetType: { equals: input.targetType } }, { targetId: { equals: input.targetId } }, { status: { equals: 'open' } }] },
  })
  const reasons = open.docs.map((row) => String((row as { reason?: string }).reason)) as ReportReason[]
  if (shouldAutoHide(reasons)) {
    await setHidden(payload, input.portal, input.targetType, input.targetId, true, 'report', input.reason)
    await payload.update({ collection: 'reports', id: report.id, overrideAccess: true, data: { status: 'hidden' } as never })
  }
  if (safeguardingFromReport(input.reason)) {
    const learner = await targetLearner(payload, input.targetType, input.targetId)
    await raiseSafeguarding(payload, {
      portal: input.portal,
      learner: learner || user.id,
      source: 'report',
      targetType: input.targetType,
      targetId: input.targetId,
    })
    await payload.update({ collection: 'reports', id: report.id, overrideAccess: true, data: { status: 'escalated' } as never })
  }
  const slug = ((await payload.findByID({ collection: 'portals', id: input.portal, overrideAccess: true, depth: 0 }).catch(() => null)) as { slug?: string } | null)?.slug || ''
  const staff = await portalStaffIds(payload, input.portal, ['portal-admin', 'teacher'])
  for (const staffId of staff) {
    await notify(payload, {
      user: staffId,
      portal: input.portal,
      title: 'A concern was raised',
      body: 'A person asked the portal team to look at something. Open Care and safety when you can.',
      href: slug ? `/p/${slug}/admin/safety` : '/master/safety',
      key: `report-${report.id}`,
    })
  }
  return { ok: true as const, already: false, thanks: REPORT_THANKS }
}

export async function targetLearner(payload: Payload, type: string, id: number) {
  if (type === 'answer') {
    const row = await payload.findByID({ collection: 'answers', id, overrideAccess: true, depth: 0 }).catch(() => null)
    return idOf((row as { user?: unknown } | null)?.user)
  }
  if (type === 'gather-photo') {
    const row = await payload.findByID({ collection: 'gather-photos', id, overrideAccess: true, depth: 0 }).catch(() => null)
    return idOf((row as { postedBy?: unknown } | null)?.postedBy)
  }
  if (type === 'teacher-reply') {
    const row = await payload.findByID({ collection: 'workbook-entries', id, overrideAccess: true, depth: 0 }).catch(() => null)
    return idOf((row as { user?: unknown } | null)?.user)
  }
  return null
}

export async function samePortal(user: SessionUser, portalId: number) {
  if (user.role === 'master') return true
  return portalIdOf(user) === portalId
}

export async function loadQueue(payload: Payload, portalId: number | null) {
  const scoped = (extra: Record<string, unknown> = {}): Where => (portalId ? { and: [{ portal: { equals: portalId } }, extra] } : extra) as Where
  const [reports, hides, alerts] = await Promise.all([
    payload.find({ collection: 'reports', overrideAccess: true, depth: 1, limit: 80, sort: '-createdAt', where: scoped() }),
    payload.find({ collection: 'moderation-hides', overrideAccess: true, depth: 0, limit: 80, sort: '-updatedAt', where: scoped({ hidden: { equals: true } }) }),
    payload.find({ collection: 'safeguarding-alerts', overrideAccess: true, depth: 1, limit: 40, sort: '-createdAt', where: scoped() }),
  ])
  return {
    reports: reports.docs as unknown as Doc[],
    hides: hides.docs as unknown as Doc[],
    alerts: alerts.docs as unknown as Doc[],
  }
}

export async function openAnnouncements(payload: Payload, user: SessionUser, portalId: number) {
  const at = now().toISOString()
  const found = await payload.find({
    collection: 'announcements',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    sort: '-createdAt',
    where: { and: [{ portal: { equals: portalId } }, { or: [{ publishAt: { exists: false } }, { publishAt: { less_than_equal: at } }] }] },
  })
  const mine = found.docs.filter((row) => {
    const audience = String((row as { audience?: string }).audience || 'everyone')
    if (audience === 'everyone') return true
    if (audience === 'teachers') return user.role === 'teacher' || user.role === 'portal-admin' || user.role === 'master'
    if (audience === 'code') return idOf((row as { accessCode?: unknown }).accessCode) === idOf(user.accessCode)
    return false
  })
  const ids = mine.map((row) => row.id)
  const dismissed = ids.length
    ? await payload.find({
        collection: 'announcement-dismissals',
        overrideAccess: true,
        depth: 0,
        limit: 40,
        where: { and: [{ user: { equals: user.id } }, { announcement: { in: ids } }] },
      })
    : { docs: [] }
  const gone = new Set(dismissed.docs.map((row) => idOf((row as { announcement?: unknown }).announcement)))
  return mine.filter((row) => !gone.has(row.id)) as unknown as Doc[]
}
