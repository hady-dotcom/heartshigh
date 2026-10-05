import type { Payload } from 'payload'
import { clientIp } from '@/lib/rate-limit'
import { hitShared, REPORT_PER_DAY, DAY_MS } from '@/lib/rate-store'
import { announceProblems, canModerate, isAnnounceAudience, isReportReason, isTargetType, reportNoteProblems } from '@/lib/safety'
import { portalIdOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { audit } from './viewas'
import { fileReport, samePortal, setHidden, SLOW_DOWN, REPORT_THANKS } from './safety'
import type { SessionUser } from './context'

type Redirect = (path: string, error?: string, notice?: string) => Response

function text(form: FormData, key: string) {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function handleSafetyAction(
  action: string,
  form: FormData,
  payload: Payload,
  user: SessionUser,
  req: Request,
  back: Redirect,
): Promise<Response | null> {
  if (action === 'report' || action === 'announce' || action.startsWith('safety-') || action.startsWith('announce-')) {
    return handleSafety(action, form, payload, user, req, back)
  }
  return null
}

export async function handleSafety(
  action: string,
  form: FormData,
  payload: Payload,
  user: SessionUser,
  req: Request,
  back: Redirect,
): Promise<Response> {
  const next = text(form, 'next') || '/'

  if (action === 'report' || action === 'safety-report') {
    const portal = portalIdOf(user)
    if (!portal) return back(next, 'Your account is not in a portal.')
    const limited = await hitShared(payload, `report-user:${user.id}`, REPORT_PER_DAY, DAY_MS)
    if (!limited.allowed) return back(next, SLOW_DOWN)
    const targetType = text(form, 'targetType')
    const targetId = Number(text(form, 'targetId'))
    const reason = text(form, 'reason')
    const note = text(form, 'note')
    if (!isTargetType(targetType) || !targetId) return back(next, 'Choose what this is about.')
    if (!isReportReason(reason)) return back(next, 'Choose what is wrong.')
    const noteProblems = reportNoteProblems(note)
    if (noteProblems[0]) return back(next, noteProblems[0])
    const result = await fileReport(payload, user, { portal, targetType, targetId, reason, note })
    return back(next, undefined, result.thanks)
  }

  if (action === 'safety-hide' || action === 'safety-keep' || action === 'safety-message' || action === 'safety-mute' || action === 'safety-outcome') {
    if (!canModerate(user.role)) return back(next, 'That page is for the portal team.')
    const portal = Number(text(form, 'portal') || portalIdOf(user) || 0)
    if (!portal || !(await samePortal(user, portal))) return back(next, 'That is not in your portal.')
    const targetType = text(form, 'targetType')
    const targetId = Number(text(form, 'targetId'))

    if (action === 'safety-hide' || action === 'safety-keep') {
      if (!isTargetType(targetType) || !targetId) return back(next, 'Choose an item.')
      const hide = action === 'safety-hide'
      await setHidden(payload, portal, targetType, targetId, hide, 'staff', text(form, 'reason') || (hide ? 'Hidden by staff' : 'Kept visible'), user.id)
      const reportId = Number(text(form, 'report'))
      if (reportId) {
        await payload.update({
          collection: 'reports',
          id: reportId,
          overrideAccess: true,
          data: { status: hide ? 'hidden' : 'kept', handledBy: user.id, handledAt: now().toISOString(), handleNote: text(form, 'reason') } as never,
        })
      }
      await audit(payload, hide ? 'moderation.hide' : 'moderation.keep', { actor: user.id, actorRole: user.role, portal, detail: { targetType, targetId } })
      return back(next, undefined, hide ? 'That item is hidden from the circle.' : 'That item is visible again.')
    }

    if (action === 'safety-message') {
      const person = Number(text(form, 'person'))
      const body = text(form, 'body').slice(0, 400)
      if (!person || !body) return back(next, 'Write a short note for them.')
      const target = await payload.findByID({ collection: 'users', id: person, overrideAccess: true, depth: 0 }).catch(() => null)
      if (!target || (user.role !== 'master' && portalIdOf(target as SessionUser) !== portal)) return back(next, 'That person is not in your portal.')
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: { user: person, portal, title: 'A note from your teacher', body, href: '/', channel: 'in-app' },
      })
      await audit(payload, 'moderation.message', { actor: user.id, actorRole: user.role, target: person, portal })
      return back(next, undefined, 'Your note is on its way.')
    }

    if (action === 'safety-mute') {
      const person = Number(text(form, 'person'))
      if (!person) return back(next, 'Choose a person.')
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await payload.create({
        collection: 'circle-mutes',
        overrideAccess: true,
        data: { user: person, portal, until, by: user.id, reason: text(form, 'reason').slice(0, 200) } as never,
      })
      await audit(payload, 'moderation.mute', { actor: user.id, actorRole: user.role, target: person, portal, reason: text(form, 'reason') })
      return back(next, undefined, 'They will not appear in the circle for seven days.')
    }

    if (action === 'safety-outcome') {
      const alertId = Number(text(form, 'alert'))
      const outcome = text(form, 'outcome').slice(0, 400)
      if (!alertId || !outcome) return back(next, 'Write a short note about what you did.')
      await payload.update({
        collection: 'safeguarding-alerts',
        id: alertId,
        overrideAccess: true,
        data: { outcome, seenBy: user.id, seenAt: now().toISOString() } as never,
      })
      await audit(payload, 'safeguarding.outcome', { actor: user.id, actorRole: user.role, portal, detail: { alert: alertId } })
      return back(next, undefined, 'That note is saved.')
    }
  }

  if (action === 'announce' || action === 'announce-create') {
    if (!canModerate(user.role)) return back(next, 'That page is for the portal team.')
    const portal = Number(text(form, 'portal') || portalIdOf(user) || 0)
    if (!portal || !(await samePortal(user, portal))) return back(next, 'That is not in your portal.')
    const body = text(form, 'body')
    const problems = announceProblems(body)
    if (problems[0]) return back(next, problems[0])
    const audience = text(form, 'audience') || 'everyone'
    if (!isAnnounceAudience(audience)) return back(next, 'Choose who should see this.')
    const publishAt = text(form, 'publishAt') || undefined
    const code = Number(text(form, 'code') || 0) || undefined
    const made = await payload.create({
      collection: 'announcements',
      overrideAccess: true,
      data: {
        portal,
        body,
        audience,
        accessCode: audience === 'code' ? code : undefined,
        publishAt: publishAt || now().toISOString(),
        createdBy: user.id,
      } as never,
    })
    await audit(payload, 'announcement.create', { actor: user.id, actorRole: user.role, portal, detail: { id: made.id, audience } })
    const people = await payload.find({
      collection: 'users',
      overrideAccess: true,
      depth: 0,
      limit: 400,
      where: { 'tenants.tenant': { equals: portal } },
    })
    const slug = ((await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 }).catch(() => null)) as { slug?: string } | null)?.slug || ''
    for (const person of people.docs) {
      const role = (person as { role?: string }).role
      if (audience === 'teachers' && role !== 'teacher' && role !== 'portal-admin') continue
      if (audience === 'code' && Number((person as { accessCode?: unknown }).accessCode) !== code) continue
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: person.id,
          portal,
          title: 'A note from your portal',
          body,
          href: slug ? `/p/${slug}` : '/',
          channel: 'in-app',
          key: `announce-${made.id}-${person.id}`,
        },
      })
    }
    return back(next, undefined, 'The announcement is ready.')
  }

  if (action === 'announce-dismiss') {
    const id = Number(text(form, 'announcement'))
    if (!id) return back(next)
    await payload.create({
      collection: 'announcement-dismissals',
      overrideAccess: true,
      data: { announcement: id, user: user.id, portal: portalIdOf(user) || undefined } as never,
    })
    return back(next)
  }

  return back(next, 'That action is not known.')
}

export { REPORT_THANKS }
