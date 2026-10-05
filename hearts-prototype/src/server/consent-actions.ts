import { NextResponse } from 'next/server'
import { now } from '@/lib/clock'
import { childShareRefusal } from '@/lib/child-safety'
import { consentAllowedAction, parseAgeBand } from '@/lib/consent'
import { isLegalKind, nextLegalVersion, type LegalKind } from '@/lib/legal'
import { portalIdOf } from '@/lib/ids'
import { slugProblem } from '@/lib/text-safety'
import type { Session, SessionUser } from './context'
import { audit } from './viewas'
import {
  childState,
  codeIsForChildren,
  currentLegalPages,
  ensureLegalPages,
  grantCurrentConsents,
  hashToken,
  learnerNeedsConsent,
  loadAgeProfile,
  loadPortalContacts,
  newGuardianToken,
  publishedLegal,
  recordConsent,
} from './consent'

type Payload = Session['payload']

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function safeNext(next: string) {
  const value = (next || '/').trim() || '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const url = new URL(safeNext(path), host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function wantsJson(req: Request) {
  const accept = req.headers.get('accept') || ''
  return accept.includes('application/json') && !accept.includes('text/html')
}

function refuse(req: Request, message: string, next = '/') {
  if (wantsJson(req)) return NextResponse.json({ error: message }, { status: 403 })
  return redirectTo(req, next, message)
}

function portalHome(user: SessionUser, slug?: string) {
  if (user.role === 'master') return '/master'
  if (!slug) return '/'
  return user.role === 'learner' ? `/p/${slug}` : `/p/${slug}/admin`
}

async function portalSlug(payload: Payload, user: SessionUser) {
  const id = portalIdOf(user)
  if (!id) return ''
  const doc = await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)
  return (doc as { slug?: string } | null)?.slug || ''
}

export async function applyChildAnswerRules(payload: Payload, user: SessionUser, input: { shareWithLearners?: boolean; shareWithTeacher?: boolean; keepPrivate?: boolean }) {
  const defaults = await (await import('./consent')).childDefaultsFor(payload, user.id)
  const next = { ...input }
  if (!defaults.mayShareWithLearners) next.shareWithLearners = false
  if (!defaults.answersSavedForTeachers) {
    next.shareWithTeacher = false
    next.keepPrivate = true
  }
  const error = childShareRefusal(defaults, {
    shareWithLearners: Boolean(input.shareWithLearners),
    shareWithTeacher: Boolean(input.shareWithTeacher) && !defaults.answersSavedForTeachers,
  })
  return { input: next, defaults, error }
}

export async function refuseUnconsented(req: Request, session: Session, action: string) {
  const { payload, user } = session
  if (!user || consentAllowedAction(action) || user.role !== 'learner') return null
  if (!(await learnerNeedsConsent(payload, user))) return null
  const slug = await portalSlug(payload, user)
  const next = slug ? `/p/${slug}/consent` : '/privacy'
  if (wantsJson(req)) return NextResponse.json({ error: 'Please agree first.', next }, { status: 403 })
  return redirectTo(req, next)
}

export async function refuseChildAction(req: Request, session: Session, action: string, form: FormData) {
  const { payload, user } = session
  if (!user || user.role !== 'learner') return null
  const defaults = await (await import('./consent')).childDefaultsFor(payload, user.id)
  const slug = await portalSlug(payload, user)
  const next = text(form, 'next') || (slug ? `/p/${slug}` : '/')
  if (action === 'me-pref' && text(form, 'name') === 'shareWithLearners' && form.get('on') === 'on' && !defaults.mayShareWithLearners) {
    return refuse(req, childShareRefusal(defaults, { shareWithLearners: true }) || 'That stay off for you.', next)
  }
  if (action === 'watch-opt-in' && form.get('shareWatch') === 'on' && !defaults.mayShareWatchHistory) {
    return refuse(req, childShareRefusal(defaults, { shareWatch: true }) || 'Watch history stays on this phone.', next)
  }
  if (action === 'answer' && !defaults.answersSavedForTeachers && (form.get('shareWithTeacher') === 'on' || form.get('shareWithLearners') === 'on')) {
    return refuse(req, childShareRefusal(defaults, { shareWithTeacher: true }) || 'Your answers stay with you until a grown-up agrees.', next)
  }
  return null
}

async function handleAcceptConsent(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user) return redirectTo(req, '/login', 'Please sign in first.')
  const agreed = form.get('agree') === 'on'
  if (!agreed) return redirectTo(req, text(form, 'next') || '/', 'Tick the box if you agree.')
  const ageBand = parseAgeBand(text(form, 'ageBand'))
  if (!ageBand) return redirectTo(req, text(form, 'next') || '/', 'Tell us which age band you are in.')
  const portalId = portalIdOf(user)
  const slug = await portalSlug(payload, user)
  const pages = await currentLegalPages(payload)
  for (const page of pages.filter((item) => item.kind === 'privacy' || item.kind === 'terms')) {
    await recordConsent(payload, { userId: user.id, portalId, kind: page.kind, version: page.version, req })
  }
  const { doc } = await loadAgeProfile(payload, user.id)
  const school = portalId ? await loadPortalContacts(payload, portalId) : null
  const waiting = ageBand === 'under-13' && !school?.schoolOfflineConsent
  const data = {
    user: user.id,
    portal: portalId || undefined,
    ageBand,
    waitingForGuardian: waiting,
  }
  if (doc) await payload.update({ collection: 'age-profiles', id: doc.id, overrideAccess: true, data })
  else await payload.create({ collection: 'age-profiles', overrideAccess: true, data: data as never })
  if (ageBand === 'under-13' && waiting) {
    return redirectTo(req, `/p/${slug}/consent?need=guardian`, undefined, 'A grown-up still needs to agree for you.')
  }
  if (ageBand === 'under-13' && school?.schoolOfflineConsent) {
    return redirectTo(req, `/p/${slug}/consent?need=school`, undefined, 'Your school will tick that a grown-up has agreed.')
  }
  const after = safeNext(text(form, 'after') || (slug ? `/p/${slug}` : '/'))
  return redirectTo(req, after, undefined, 'Thank you. You can begin.')
}

async function handleRequestGuardian(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user) return redirectTo(req, '/login', 'Please sign in first.')
  const email = text(form, 'guardianEmail').toLowerCase()
  if (!email || !email.includes('@')) return redirectTo(req, text(form, 'next') || '/', 'We need a grown-up’s email.')
  const portalId = portalIdOf(user)
  const slug = await portalSlug(payload, user)
  const { token, hash, expiresAt } = newGuardianToken()
  const { doc } = await loadAgeProfile(payload, user.id)
  const data = { guardianEmail: email, guardianTokenHash: hash, guardianTokenExpiresAt: expiresAt, waitingForGuardian: true, ageBand: 'under-13' as const, user: user.id, portal: portalId || undefined }
  if (doc) await payload.update({ collection: 'age-profiles', id: doc.id, overrideAccess: true, data })
  else await payload.create({ collection: 'age-profiles', overrideAccess: true, data: data as never })
  const origin = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const link = `${origin ? `${proto}://${origin}` : ''}/guardian?token=${encodeURIComponent(token)}`
  const sent = await sendGuardianMail(email, user.name || 'your child', link)
  const test = process.env.HEARTS_E2E === '1' || process.env.HEARTS_TEST_CLOCK === '1'
  const notice = sent ? 'We have written to a grown-up.' : 'Email is not on, so the grown-up link is on this page.'
  const extra = !sent && test ? `&guardian=${encodeURIComponent(token)}` : ''
  return redirectTo(req, `/p/${slug}/consent?need=guardian${extra}`, undefined, notice)
}

async function sendGuardianMail(to: string, childName: string, link: string) {
  const transportOn = Boolean(process.env.SMTP_URL || process.env.RESEND_API_KEY)
  if (!transportOn) {
    console.info('email not sent: transport off', { to, kind: 'guardian-consent' })
    return false
  }
  try {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    await payload.sendEmail({
      to,
      subject: 'A child needs you to agree on HEARTS',
      html: `<p>Assalamu alaikum.</p><p>${childName} would like to use HEARTS, a free Islamic learning app. Please read the short note and agree if you are happy for them to join.</p><p><a href="${link}">I agree for my child</a></p>`,
      text: `A child (${childName}) would like to use HEARTS. Open this link if you agree: ${link}`,
    })
    return true
  } catch {
    console.info('email not sent: transport off', { to, kind: 'guardian-consent' })
    return false
  }
}

async function handleConfirmGuardian(req: Request, form: FormData, session: Session) {
  const { payload } = session
  const token = text(form, 'token')
  if (!token) return redirectTo(req, '/guardian', 'That link is not valid any more.')
  const hash = hashToken(token)
  const found = await payload.find({
    collection: 'age-profiles',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { guardianTokenHash: { equals: hash } },
  })
  const row = found.docs[0] as { id: number; user?: unknown; portal?: unknown; guardianTokenExpiresAt?: string | null; guardianEmail?: string | null } | undefined
  if (!row) return redirectTo(req, '/guardian', 'That link is not valid any more.')
  if (row.guardianTokenExpiresAt && new Date(row.guardianTokenExpiresAt).getTime() < now().getTime()) {
    return redirectTo(req, '/guardian', 'That link is not valid any more. Ask the child to send it again.')
  }
  const userId = typeof row.user === 'object' && row.user && 'id' in row.user ? Number((row.user as { id: number }).id) : Number(row.user)
  const portalId = typeof row.portal === 'object' && row.portal && 'id' in row.portal ? Number((row.portal as { id: number }).id) : Number(row.portal || 0)
  await payload.update({
    collection: 'age-profiles',
    id: row.id,
    overrideAccess: true,
    data: { waitingForGuardian: false, guardianAcceptedAt: now().toISOString(), guardianTokenHash: null, guardianTokenExpiresAt: null },
  })
  const pages = await currentLegalPages(payload)
  for (const page of pages.filter((item) => item.kind === 'privacy' || item.kind === 'terms')) {
    await recordConsent(payload, {
      userId,
      portalId: portalId || null,
      kind: page.kind,
      version: page.version,
      req,
      byGuardian: true,
      guardianEmail: row.guardianEmail || undefined,
    })
  }
  await recordConsent(payload, {
    userId,
    portalId: portalId || null,
    kind: 'guardian',
    version: pages.find((page) => page.kind === 'privacy')?.version || 'guardian',
    req,
    byGuardian: true,
    guardianEmail: row.guardianEmail || undefined,
  })
  return redirectTo(req, '/guardian?done=1', undefined, 'Thank you. Your child can begin.')
}

async function handleStaffGuardian(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin' && user.role !== 'teacher')) {
    return refuse(req, 'That page is for the portal team.')
  }
  const learnerId = Number(text(form, 'learner'))
  if (!learnerId) return redirectTo(req, text(form, 'next') || '/', 'Name the learner.')
  const { doc, age } = await loadAgeProfile(payload, learnerId)
  const portalId = portalIdOf(user) || Number(text(form, 'portalId') || 0)
  const data = {
    user: learnerId,
    portal: portalId || undefined,
    ageBand: age?.ageBand || 'under-13',
    waitingForGuardian: false,
    schoolOfflineAt: now().toISOString(),
    schoolOfflineBy: user.id,
    schoolOfflineNote: text(form, 'note').slice(0, 200),
  }
  if (doc) await payload.update({ collection: 'age-profiles', id: doc.id, overrideAccess: true, data })
  else await payload.create({ collection: 'age-profiles', overrideAccess: true, data: data as never })
  const pages = await currentLegalPages(payload)
  for (const page of pages.filter((item) => item.kind === 'privacy' || item.kind === 'terms')) {
    await recordConsent(payload, { userId: learnerId, portalId, kind: page.kind, version: page.version, req, staffActor: user.id, note: 'school-offline' })
  }
  await recordConsent(payload, { userId: learnerId, portalId, kind: 'guardian', version: pages[0]?.version || 'school', req, staffActor: user.id, note: 'school-offline' })
  await audit(payload, 'consent.school_offline', { actor: user.id, target: learnerId, portal: portalId, reason: text(form, 'note').slice(0, 200) })
  return redirectTo(req, text(form, 'next') || '/', undefined, 'Guardian consent is recorded.')
}

async function handleContacts(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return refuse(req, 'That page is for the portal team.')
  const portalId = user.role === 'master' ? Number(text(form, 'portalId')) : portalIdOf(user)
  if (!portalId) return redirectTo(req, text(form, 'next') || '/', 'Name the portal.')
  const privacyName = text(form, 'privacyName')
  const privacyEmail = text(form, 'privacyEmail')
  const safeguardingName = text(form, 'safeguardingName')
  const safeguardingEmail = text(form, 'safeguardingEmail')
  const safeguardingPhone = text(form, 'safeguardingPhone')
  if (!privacyName || !privacyEmail || !safeguardingName || !safeguardingEmail || !safeguardingPhone) {
    return redirectTo(req, text(form, 'next') || '/', 'Name the privacy contact and the safeguarding lead, with an email and a phone.')
  }
  const existing = await loadPortalContacts(payload, portalId)
  const data = {
    portal: portalId,
    privacyName,
    privacyEmail,
    safeguardingName,
    safeguardingEmail,
    safeguardingPhone,
    schoolOfflineConsent: form.get('schoolOfflineConsent') === 'on',
  }
  if (existing) await payload.update({ collection: 'portal-contacts', id: existing.id, overrideAccess: true, data })
  else await payload.create({ collection: 'portal-contacts', overrideAccess: true, data: data as never })
  await audit(payload, 'portal.contacts', { actor: user.id, portal: portalId, detail: { fields: ['privacy', 'safeguarding'] } })
  return redirectTo(req, text(form, 'next') || '/', undefined, 'Contacts saved.')
}

async function handleChildrenSettings(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return refuse(req, 'That page is for the portal team.')
  const portalId = user.role === 'master' ? Number(text(form, 'portalId')) : portalIdOf(user)
  if (!portalId) return redirectTo(req, text(form, 'next') || '/', 'Name the portal.')
  const existing = await loadPortalContacts(payload, portalId)
  const data = { portal: portalId, schoolOfflineConsent: form.get('schoolOfflineConsent') === 'on' }
  if (existing) await payload.update({ collection: 'portal-contacts', id: existing.id, overrideAccess: true, data })
  else await payload.create({ collection: 'portal-contacts', overrideAccess: true, data: data as never })
  await audit(payload, 'portal.children', { actor: user.id, portal: portalId, detail: { schoolOfflineConsent: data.schoolOfflineConsent } })
  return redirectTo(req, text(form, 'next') || '/', undefined, 'Children settings saved.')
}

async function upsertChildCodeFlag(payload: Payload, codeId: number, on: boolean) {
  const found = await payload.find({ collection: 'child-code-flags', overrideAccess: true, limit: 1, where: { accessCode: { equals: codeId } } })
  if (found.docs[0]) await payload.update({ collection: 'child-code-flags', id: (found.docs[0] as { id: number }).id, overrideAccess: true, data: { forChildren: on } })
  else await payload.create({ collection: 'child-code-flags', overrideAccess: true, data: { accessCode: codeId, forChildren: on } as never })
}

async function handleMarkChildCode(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return refuse(req, 'That page is for the portal team.')
  const codeId = Number(text(form, 'accessCode'))
  if (!codeId) return redirectTo(req, text(form, 'next') || '/', 'Name the code.')
  const on = form.get('forChildren') === 'on'
  await upsertChildCodeFlag(payload, codeId, on)
  return redirectTo(req, text(form, 'next') || '/', undefined, on ? 'This code is marked for children.' : 'This code is no longer marked for children.')
}

async function handleMarkChildCodes(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return refuse(req, 'That page is for the portal team.')
  const ids = text(form, 'codeIds')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((id) => id > 0)
  const on = new Set(form.getAll('childCodes').map((value) => Number(value)).filter((id) => id > 0))
  for (const codeId of ids) await upsertChildCodeFlag(payload, codeId, on.has(codeId))
  return redirectTo(req, text(form, 'next') || '/', undefined, 'Children codes saved.')
}

async function handleSaveLegal(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || user.role !== 'master') return refuse(req, 'Only the master desk can edit these pages.')
  const kind = text(form, 'kind')
  if (!isLegalKind(kind)) return redirectTo(req, '/master/legal', 'Name the page.')
  const title = text(form, 'title')
  const summary = text(form, 'summary')
  const body = text(form, 'body')
  const version = text(form, 'version') || nextLegalVersion('')
  if (!title || !summary || !body) return redirectTo(req, '/master/legal', 'A title, a one-line summary and the full text are needed.')
  const id = Number(text(form, 'id'))
  const data = {
    kind,
    version,
    title,
    summary,
    body,
    published: false,
    draftForAdviserReview: form.get('draftForAdviserReview') !== 'off',
    updatedLabel: text(form, 'updatedLabel') || now().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
  if (id) await payload.update({ collection: 'legal-pages', id, overrideAccess: true, data })
  else await payload.create({ collection: 'legal-pages', overrideAccess: true, data: data as never })
  return redirectTo(req, text(form, 'next') || '/master/legal', undefined, 'Draft saved. It is marked for adviser review.')
}

async function handlePublishLegal(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || user.role !== 'master') return refuse(req, 'Only the master desk can publish these pages.')
  const id = Number(text(form, 'id'))
  if (!id) return redirectTo(req, '/master/legal', 'Name the page.')
  const current = await payload.findByID({ collection: 'legal-pages', id, overrideAccess: true, depth: 0 })
  const version = text(form, 'version') || nextLegalVersion(String((current as { version?: string }).version || ''))
  await payload.update({
    collection: 'legal-pages',
    id,
    overrideAccess: true,
    data: { published: true, version, draftForAdviserReview: form.get('draftForAdviserReview') !== 'off' },
  })
  await audit(payload, 'legal.publish', { actor: user.id, detail: { id, version, kind: (current as { kind?: string }).kind } })
  return redirectTo(req, text(form, 'next') || '/master/legal', undefined, 'Published. People who already agreed will be asked again.')
}

async function handlePortalAgreement(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) return refuse(req, 'That page is for the portal team.')
  if (form.get('agree') !== 'on') return redirectTo(req, text(form, 'next') || '/', 'Tick the box if you agree.')
  const name = text(form, 'agreementName')
  if (!name) return redirectTo(req, text(form, 'next') || '/', 'Type the name of the person who agrees.')
  const portalId = user.role === 'master' ? Number(text(form, 'portalId')) : portalIdOf(user)
  if (!portalId) return redirectTo(req, text(form, 'next') || '/', 'Name the portal.')
  const page = await publishedLegal(payload, 'portal-agreement')
  const existing = await loadPortalContacts(payload, portalId)
  const data = {
    portal: portalId,
    agreementAcceptedAt: now().toISOString(),
    agreementName: name,
    agreementVersion: page?.version || 'draft',
  }
  if (existing) await payload.update({ collection: 'portal-contacts', id: existing.id, overrideAccess: true, data })
  else await payload.create({ collection: 'portal-contacts', overrideAccess: true, data: data as never })
  await recordConsent(payload, {
    userId: user.id,
    portalId,
    kind: 'portal-agreement',
    version: page?.version || 'draft',
    req,
    note: name,
  })
  return redirectTo(req, text(form, 'next') || '/', undefined, 'Agreement recorded.')
}

async function handleHelpRequest(req: Request, form: FormData, session: Session) {
  const { payload, user } = session
  if (!user) return redirectTo(req, '/login', 'Please sign in first.')
  const kind = text(form, 'kind')
  if (kind !== 'broken' && kind !== 'learning' && kind !== 'worrying') return redirectTo(req, text(form, 'next') || '/', 'Choose one of the three doors.')
  const portalId = portalIdOf(user)
  if (!portalId) return redirectTo(req, text(form, 'next') || '/', 'That note needs a portal.')
  await payload.create({
    collection: 'help-requests',
    overrideAccess: true,
    data: {
      user: user.id,
      portal: portalId,
      kind,
      page: text(form, 'page').slice(0, 200),
      device: (req.headers.get('user-agent') || '').slice(0, 180),
      note: text(form, 'note').slice(0, 1000),
      status: kind === 'learning' ? 'sent' : 'open',
      happenedAt: now().toISOString(),
    } as never,
  })
  const thanks =
    kind === 'worrying'
      ? 'Thank you. A person will look at this.'
      : kind === 'learning'
        ? 'Your teacher will see this note.'
        : 'Thank you. HEARTS will look at what broke.'
  return redirectTo(req, text(form, 'next') || '/', undefined, thanks)
}

const ACTIONS = new Set([
  'accept-consent',
  'request-guardian',
  'confirm-guardian',
  'staff-guardian-consent',
  'save-portal-contacts',
  'save-children-settings',
  'mark-child-code',
  'mark-child-codes',
  'save-legal-page',
  'publish-legal-page',
  'portal-agreement',
  'help-request',
])

/**
 * Lane B dispatch. Called first from handleForm.
 * Handles consent actions, then refuses learner actions until the current versions are agreed.
 */
export async function handleConsentActions(req: Request, form: FormData, session: Session) {
  const action = text(form, 'action')
  if (ACTIONS.has(action)) {
    if (action === 'accept-consent') return handleAcceptConsent(req, form, session)
    if (action === 'request-guardian') return handleRequestGuardian(req, form, session)
    if (action === 'confirm-guardian') return handleConfirmGuardian(req, form, session)
    if (action === 'staff-guardian-consent') return handleStaffGuardian(req, form, session)
    if (action === 'save-portal-contacts') return handleContacts(req, form, session)
    if (action === 'save-children-settings') return handleChildrenSettings(req, form, session)
    if (action === 'mark-child-code') return handleMarkChildCode(req, form, session)
    if (action === 'mark-child-codes') return handleMarkChildCodes(req, form, session)
    if (action === 'save-legal-page') return handleSaveLegal(req, form, session)
    if (action === 'publish-legal-page') return handlePublishLegal(req, form, session)
    if (action === 'portal-agreement') return handlePortalAgreement(req, form, session)
    if (action === 'help-request') return handleHelpRequest(req, form, session)
  }
  const blocked = await refuseUnconsented(req, session, action)
  if (blocked) return blocked
  return refuseChildAction(req, session, action, form)
}

export { codeIsForChildren, ensureLegalPages, grantCurrentConsents, learnerNeedsConsent }
