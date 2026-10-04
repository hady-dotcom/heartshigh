import { NextResponse } from 'next/server'
import { getSession } from '@/server/context'
import {
  attendanceCsv,
  attendanceReport,
  checkIn,
  gatheringById,
  gatheringBySlug,
  portalOf,
  respondToGathering,
  saveGathering,
  savePhoto,
  saveReflection,
  setGatheringStatus,
  splitCircles,
  welcomeNewcomers,
} from '@/server/gather'
import { blocked, READ_ONLY } from '@/server/viewas'
import type { RsvpChoice } from '@/lib/gather'

export const dynamic = 'force-dynamic'

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function wantsJson(req: Request) {
  return (req.headers.get('accept') || '').includes('application/json')
}

function checkinReply(req: Request, next: string, error?: string, notice?: string) {
  if (!wantsJson(req)) return redirectTo(req, next, error, notice)
  return NextResponse.json({ ok: !error, error: error || null, notice: notice || null }, { status: error ? 400 : 200 })
}

const NOTICE: Record<string, string> = {
  going: 'You’re down as coming.',
  maybe: 'You’re down as maybe. The place stays open for someone else.',
  cant: 'That’s fine. If you were holding a place, the next person on the list has it.',
  waitlist: 'It’s full. You’re at the head of the list as places free up.',
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('export') !== '1') return NextResponse.json({ ok: true })
  const session = await getSession()
  if (!session.user || session.user.role === 'learner') return NextResponse.json({ error: 'The desk export is for the portal team.' }, { status: 403 })
  const portal = await portalOf(session.payload, session.user, url.searchParams.get('portal') || '')
  if (!portal) return NextResponse.json({ error: 'That portal is not yours.' }, { status: 404 })
  const csv = attendanceCsv(await attendanceReport(session.payload, portal.id))
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gather-${portal.slug}.csv"`,
    },
  })
}

export async function POST(req: Request) {
  const form = await req.formData()
  const action = text(form, 'action')
  const next = text(form, 'next') || '/'
  const session = await getSession()

  if (action === 'guest') {
    const row = await gatheringBySlug(session.payload, text(form, 'slug'))
    if (!row) return redirectTo(req, next, 'That gathering could not be found.')
    const name = text(form, 'name')
    const contact = text(form, 'contact')
    if (name.length < 2) return redirectTo(req, next, 'Tell us what to call you.')
    if (contact.length < 3 || !/[@0-9]/.test(contact)) return redirectTo(req, next, 'Add a phone number or an email so the host can reach you.')
    const choice = (['going', 'maybe', 'cant'].includes(text(form, 'choice')) ? text(form, 'choice') : 'going') as RsvpChoice
    const result = await respondToGathering(session.payload, {
      gathering: row,
      choice,
      guestName: name,
      guestContact: contact,
      bringCode: text(form, 'with'),
      remind: form.get('remind') === 'on',
    })
    if (!result.ok) return redirectTo(req, next, result.error)
    const back = new URL(next, 'http://hearts.local')
    back.searchParams.set('rsvp', '1')
    if (result.guestToken) {
      back.searchParams.set('guest', result.guestToken)
      back.searchParams.set('name', name)
    }
    return redirectTo(req, `${back.pathname}${back.search}`, undefined, NOTICE[result.status] || 'Saved.')
  }

  if (!session.user) return redirectTo(req, `/login?next=${encodeURIComponent(next)}`, 'Sign in first.')
  if (session.viewAs && !session.viewAs.writeEnabled) {
    await blocked(session.payload, session.viewAs, { route: 'gather', action })
    return redirectTo(req, next, READ_ONLY === 'VIEW_AS_READ_ONLY' ? 'Read-only while viewing as someone else.' : 'Read-only.')
  }

  const user = session.user
  const payload = session.payload

  if (action === 'save' || action === 'propose') {
    const portal = await portalOf(payload, user, text(form, 'portal'))
    if (!portal) return redirectTo(req, next, 'That portal is not yours.')
    const propose = action === 'propose'
    if (propose && user.role !== 'learner') return redirectTo(req, next, 'Learners propose. The desk publishes.')
    if (!propose && user.role === 'learner') return redirectTo(req, next, 'Ask your imam or the portal admin to publish a gathering.')
    const result = await saveGathering(payload, {
      portalId: portal.id,
      user,
      id: Number(text(form, 'id')) || undefined,
      title: text(form, 'title'),
      kind: text(form, 'kind'),
      audience: text(form, 'audience'),
      startsAt: text(form, 'startsAt'),
      endsAt: text(form, 'endsAt'),
      place: text(form, 'place'),
      mapUrl: text(form, 'mapUrl'),
      capacity: Number(text(form, 'capacity') || 0),
      bring: text(form, 'bring'),
      note: text(form, 'note'),
      hostLabel: text(form, 'hostLabel'),
      lessonId: Number(text(form, 'lesson')) || null,
      courseId: Number(text(form, 'course')) || null,
      taskId: Number(text(form, 'task')) || null,
      door: Number(text(form, 'door')) || null,
      propose,
    })
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, propose ? 'Sent to your imam to look over.' : 'Gathering saved.')
  }

  if (action === 'status') {
    if (user.role === 'learner') return redirectTo(req, next, 'Only the desk can publish a gathering.')
    const portal = await portalOf(payload, user, text(form, 'portal'))
    if (!portal) return redirectTo(req, next, 'That portal is not yours.')
    const status = text(form, 'status') === 'cancelled' ? 'cancelled' : 'published'
    const result = await setGatheringStatus(payload, portal.id, Number(text(form, 'id')), status)
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, status === 'published' ? 'It’s open for people to come.' : 'Called off.')
  }

  if (action === 'rsvp') {
    const row = await gatheringById(payload, Number(text(form, 'id')))
    if (!row) return redirectTo(req, next, 'That gathering could not be found.')
    const choice = text(form, 'choice') as RsvpChoice
    const result = await respondToGathering(payload, {
      gathering: row,
      choice,
      user,
      bringCode: text(form, 'with'),
      remind: form.get('remind') === 'on',
    })
    if (!result.ok) return redirectTo(req, next, result.error)
    const extra = result.promoted ? ' Someone on the list has your place.' : ''
    return redirectTo(req, next, undefined, `${NOTICE[result.status] || 'Saved.'}${extra}`)
  }

  if (action === 'checkin') {
    const row = await gatheringById(payload, Number(text(form, 'id')))
    if (!row) return checkinReply(req, next, 'That gathering could not be found.')
    const method = text(form, 'method') === 'host' ? 'host' : text(form, 'method') === 'code' ? 'code' : 'qr'
    if (method === 'host') {
      if (user.role === 'learner') return checkinReply(req, next, 'Only the host can check someone in by hand.')
      const learnerId = Number(text(form, 'learner'))
      if (!learnerId) return checkinReply(req, next, 'Choose who has arrived.')
      const learner = await payload.findByID({ collection: 'users', id: learnerId, depth: 0, overrideAccess: true }).catch(() => null)
      if (!learner) return checkinReply(req, next, 'That person could not be found.')
      const hosted = await checkIn(payload, { gathering: row, user: learner as typeof user, method: 'host' })
      if (!hosted.ok) return checkinReply(req, next, hosted.error)
      return checkinReply(req, next, undefined, 'Checked in.')
    }
    const result = await checkIn(payload, { gathering: row, user, method, token: text(form, 'token'), code: text(form, 'code') })
    if (!result.ok) return checkinReply(req, next, result.error)
    return checkinReply(req, next, undefined, result.already ? 'You were already checked in.' : 'You’re in. Welcome.')
  }

  if (action === 'reflect') {
    const row = await gatheringById(payload, Number(text(form, 'id')))
    if (!row) return redirectTo(req, next, 'That gathering could not be found.')
    const result = await saveReflection(payload, row, user, text(form, 'body'))
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, 'Saved. You’ll find it in your harvest.')
  }

  if (action === 'photo') {
    const row = await gatheringById(payload, Number(text(form, 'id')))
    if (!row) return redirectTo(req, next, 'That gathering could not be found.')
    const file = form.get('image')
    const result = await savePhoto(payload, row, user, file instanceof File ? file : new File([], ''), text(form, 'caption'), form.get('consent') === 'on')
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, 'Photo kept, with consent.')
  }

  if (action === 'split') {
    const row = await gatheringById(payload, Number(text(form, 'id')))
    if (!row) return redirectTo(req, next, 'That gathering could not be found.')
    const hostId = typeof row.host === 'object' && row.host && 'id' in row.host ? Number((row.host as { id: number }).id) : Number(row.host)
    if (user.role === 'learner' && hostId !== user.id) return redirectTo(req, next, 'The host splits the room.')
    const result = await splitCircles(payload, row)
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, result.circles.length ? `Split into ${result.circles.length === 1 ? 'one circle' : `${result.circles.length} circles`}.` : 'No one is marked as coming yet.')
  }

  if (action === 'welcome') {
    if (user.role === 'learner') return redirectTo(req, next, 'The desk sends the welcome.')
    const portal = await portalOf(payload, user, text(form, 'portal'))
    if (!portal) return redirectTo(req, next, 'That portal is not yours.')
    const sent = await welcomeNewcomers(payload, portal.id, portal.slug || '')
    return redirectTo(req, next, undefined, sent ? `Welcome sent to ${sent}.` : 'No newcomers are waiting.')
  }

  return redirectTo(req, next, 'That action is not known.')
}
