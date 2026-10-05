import { NextResponse } from 'next/server'
import type { Payload } from 'payload'
import { authCookie } from '@/lib/cookies'
import { now } from '@/lib/clock'
import { hashToken, randomToken, cookieNamed, halfCookie, readHalfSession, signHalfSession } from '@/lib/account-crypto'
import {
  ASK_TEACHER,
  canChangeRole,
  canHoldStaffRole,
  canResetByEmail,
  canSetTempPassword,
  canSuspend,
  CONFIRM_MS,
  CONFIRM_STALE,
  EMAIL_CHANGE_MS,
  exportAllowed,
  HALF_SESSION_MS,
  isEmailConfirmed,
  isSuspended,
  JOIN_MAIL_MAX,
  MIN_PASSWORD,
  RESEND_PER_HOUR,
  RESET_STALE,
  SUSPEND_MESSAGE,
  tokenFresh,
  twoFactorNeeded,
} from '@/lib/account-rules'
import { hit, clientIp } from '@/lib/rate-limit'
import { NOTIFY_KINDS, parsePrefs, type NotifyChannel, type NotifyKind, unsubscribeToken } from '@/lib/notify-prefs'
import { backupHash, lookLikeBackup, makeBackupCodes, newTotpSecret, openTotpSecret, sealTotpSecret, takeBackupCode, totpOk, totpUri } from '@/lib/totp'
import { idOf, portalIdOf } from '@/lib/ids'
import { killListHits } from '@/lib/opening-data'
import type { Session, SessionUser } from './context'
import { mailPublicUrl, sendMail, transportBanner } from './mail'
import { buildMyDataZip } from './my-data'
import { eraseUser } from './erase-user'
import { runAccountJobs } from './account-jobs'
import { sendQueuedNotification } from './notify-email'
import { audit } from './viewas'

type AccountUser = SessionUser & {
  emailConfirmedAt?: string | null
  emailConfirmToken?: string | null
  emailConfirmExpiresAt?: string | null
  pendingEmail?: string | null
  pendingEmailToken?: string | null
  pendingEmailExpiresAt?: string | null
  totpSecret?: string | null
  totpEnabledAt?: string | null
  totpPendingSecret?: string | null
  backupCodes?: string[] | null
  suspendedAt?: string | null
  suspendedBy?: unknown
  suspendReason?: string | null
  deletionRequestedAt?: string | null
  mustChangePassword?: boolean | null
  notificationPrefs?: unknown
  lastDataExportAt?: string | null
  tokenVersion?: number | null
  lastConfirmSentAt?: string | null
}

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function originOf(req: Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return host ? `${proto}://${host}` : new URL(req.url).origin
}

async function loadUser(payload: Payload, id: number) {
  return (await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 1 }).catch(() => null)) as AccountUser | null
}

async function findByEmail(payload: Payload, email: string) {
  const found = await payload.find({ collection: 'users', overrideAccess: true, depth: 1, limit: 1, where: { email: { equals: email.toLowerCase() } } })
  return (found.docs[0] as AccountUser | undefined) || null
}

export async function issueConfirmEmail(payload: Payload, user: { id: number; email?: string | null; name?: string | null }, portalName?: string, origin?: string) {
  const token = randomToken()
  const expiresAt = new Date(now().getTime() + CONFIRM_MS).toISOString()
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { emailConfirmToken: hashToken(token), emailConfirmExpiresAt: expiresAt, lastConfirmSentAt: now().toISOString() } as never,
  })
  return sendMail(payload, {
    to: user.email,
    kind: 'confirm',
    vars: { name: user.name || undefined, portalName, buttonUrl: mailPublicUrl(`/confirm?token=${token}`, origin) },
  })
}

export async function afterPasswordChanged(payload: Payload, user: AccountUser, origin?: string) {
  const version = (user.tokenVersion || 0) + 1
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { tokenVersion: version, sessions: [], mustChangePassword: false, passwordChangedAt: now().toISOString() } as never,
  })
  await sendMail(payload, { to: user.email, kind: 'password-changed', vars: { name: user.name || undefined }, })
  await audit(payload, 'account.password-changed', { actor: user.id, target: user.id })
}

async function teacherLinked(payload: Payload, teacher: AccountUser, learner: AccountUser) {
  const teacherCode = idOf(teacher.accessCode)
  const learnerCodeId = idOf(learner.accessCode)
  if (!teacherCode || !learnerCodeId) return false
  const learnerCode = await payload.findByID({ collection: 'access-codes', id: learnerCodeId, overrideAccess: true, depth: 0 }).catch(() => null)
  return idOf((learnerCode as { linkedTeacherCode?: unknown } | null)?.linkedTeacherCode) === teacherCode
}

export async function finishLogin(req: Request, payload: Payload, result: { token: string; user: AccountUser }, next: string) {
  if (isSuspended(result.user)) return redirectTo(req, '/login', SUSPEND_MESSAGE)
  if (result.user.deletionRequestedAt) {
    await payload.update({ collection: 'users', id: result.user.id, overrideAccess: true, data: { deletionRequestedAt: null } as never })
    await sendMail(payload, { to: result.user.email, kind: 'delete-cancelled', vars: { name: result.user.name || undefined } })
  }
  if (result.user.mustChangePassword) {
    const response = redirectTo(req, `/account/password?next=${encodeURIComponent(next)}`)
    response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, result.token, 7200))
    response.headers.append('Set-Cookie', halfCookie(null))
    return response
  }
  const response = redirectTo(req, next)
  response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, result.token, 7200))
  response.headers.append('Set-Cookie', halfCookie(null))
  return response
}

export async function afterPasswordLogin(
  req: Request,
  payload: Payload,
  result: { token?: string | null; user?: AccountUser | null },
  next: string,
) {
  if (!result.token || !result.user) return redirectTo(req, '/login', 'That email or password did not match.')
  if (isSuspended(result.user)) return redirectTo(req, '/login', SUSPEND_MESSAGE)
  if (twoFactorNeeded(result.user)) {
    const setup = !result.user.totpEnabledAt
    const half = signHalfSession({ userId: result.user.id, token: result.token, setup, exp: now().getTime() + HALF_SESSION_MS })
    const response = redirectTo(req, setup ? `/login/setup?next=${encodeURIComponent(next)}` : `/login/code?next=${encodeURIComponent(next)}`)
    response.headers.append('Set-Cookie', halfCookie(half))
    return response
  }
  return finishLogin(req, payload, { token: result.token, user: result.user }, next)
}

export async function prepareForgot(payload: Payload, email: string, origin?: string) {
  const person = await findByEmail(payload, email)
  if (!person) return { shown: 'same' as const }
  if (!canResetByEmail(person)) return { shown: 'same' as const, skipped: ASK_TEACHER }
  return { shown: 'same' as const, person }
}

export { RESET_STALE }

const ACCOUNT_ACTIONS = new Set([
  'change-password',
  'change-email',
  'resend-confirm',
  'request-delete',
  'download-data',
  'save-notify-prefs',
  'setup-totp',
  'confirm-totp',
  'verify-totp',
  'reset-totp',
  'begin-two-step',
  'suspend-person',
  'restore-person',
  'set-temp-password',
  'change-role',
  'send-test-email',
  'email-join-link',
  'portal-email-policy',
  'run-account-jobs',
])

export function isAccountAction(action: string) {
  return ACCOUNT_ACTIONS.has(action)
}

export async function handleAccountAction(req: Request, form: FormData, session: Session) {
  const action = text(form, 'action')
  if (!isAccountAction(action)) return null
  const { payload, user, viewAs } = session
  const next = text(form, 'next') || '/'
  const origin = originOf(req)

  if (action === 'verify-totp' || action === 'confirm-totp' || action === 'setup-totp') {
    return handleTwoStep(req, form, payload, origin)
  }

  if (action === 'run-account-jobs') {
    const key = text(form, 'jobsKey') || req.headers.get('x-hearts-jobs-key') || ''
    if (session.actor?.role !== 'master' && key !== (process.env.HEARTS_JOBS_KEY || '')) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }
    const result = await runAccountJobs(payload)
    return NextResponse.json(result)
  }

  if (!user) return redirectTo(req, '/login', 'Please sign in first.')
  if (viewAs && ['change-password', 'change-email', 'request-delete', 'setup-totp', 'confirm-totp'].includes(action)) {
    return NextResponse.json({ error: 'Read-only while viewing as someone else.' }, { status: 403 })
  }

  if (action === 'change-password') return changePassword(req, form, payload, user, origin)
  if (action === 'change-email') return changeEmail(req, form, payload, user, origin)
  if (action === 'resend-confirm') return resendConfirm(req, payload, user, origin, next)
  if (action === 'request-delete') return requestDelete(req, form, payload, user, origin)
  if (action === 'download-data') return downloadData(req, payload, user, origin, next)
  if (action === 'save-notify-prefs') return savePrefs(req, form, payload, user, next)
  if (action === 'send-test-email') return testEmail(req, payload, user, next)
  if (action === 'suspend-person') return suspendPerson(req, form, payload, user, origin, true)
  if (action === 'restore-person') return suspendPerson(req, form, payload, user, origin, false)
  if (action === 'set-temp-password') return tempPassword(req, form, payload, user, origin)
  if (action === 'change-role') return changeRole(req, form, payload, user)
  if (action === 'email-join-link') return emailJoinLink(req, form, payload, user, origin)
  if (action === 'portal-email-policy') return portalEmailPolicy(req, form, payload, user)
  if (action === 'reset-totp') return resetTotp(req, form, payload, user)
  if (action === 'begin-two-step') {
    const token = cookieNamed(req.headers.get('cookie'), `${payload.config.cookiePrefix}-token`)
    if (!token || (user.role !== 'master' && user.role !== 'portal-admin' && user.role !== 'teacher')) {
      return redirectTo(req, '/login', 'Sign in first.')
    }
    const half = signHalfSession({ userId: user.id, token, setup: true, exp: now().getTime() + HALF_SESSION_MS })
    const response = redirectTo(req, `/login/setup?next=${encodeURIComponent(text(form, 'next') || '/')}`)
    response.headers.append('Set-Cookie', halfCookie(half))
    return response
  }

  return null
}

async function changePassword(req: Request, form: FormData, payload: Payload, user: SessionUser, origin: string) {
  const current = text(form, 'currentPassword')
  const password = text(form, 'password')
  const again = text(form, 'passwordAgain')
  const next = text(form, 'next') || '/'
  if (password.length < MIN_PASSWORD) return redirectTo(req, next, 'Use at least 8 characters for the password.')
  if (password !== again) return redirectTo(req, next, 'The two new passwords did not match.')
  try {
    await payload.login({ collection: 'users', data: { email: user.email, password: current } })
  } catch {
    return redirectTo(req, next, 'That current password did not match.')
  }
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { password, mustChangePassword: false } as never })
  const fresh = await loadUser(payload, user.id)
  if (fresh) await afterPasswordChanged(payload, fresh, origin)
  const signed = await payload.login({ collection: 'users', data: { email: user.email, password } })
  const response = redirectTo(req, next.startsWith('/account/password') ? '/' : next, undefined, 'Your password is updated.')
  if (signed.token) response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, signed.token, 7200))
  return response
}

async function changeEmail(req: Request, form: FormData, payload: Payload, user: SessionUser, origin: string) {
  const next = text(form, 'next') || '/'
  const email = text(form, 'email').toLowerCase()
  if (!email.includes('@')) return redirectTo(req, next, 'Write the new email address.')
  const full = await loadUser(payload, user.id)
  if (!full || !isEmailConfirmed(full)) return redirectTo(req, next, 'Confirm your current email first.')
  const taken = await findByEmail(payload, email)
  if (taken && taken.id !== user.id) return redirectTo(req, next, 'That email already has an account.')
  const token = randomToken()
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { pendingEmail: email, pendingEmailToken: hashToken(token), pendingEmailExpiresAt: new Date(now().getTime() + EMAIL_CHANGE_MS).toISOString() } as never,
  })
  await sendMail(payload, { to: email, kind: 'email-changed-new', vars: { name: user.name || undefined, buttonUrl: mailPublicUrl(`/confirm?token=${token}&email=1`, origin) } })
  await sendMail(payload, { to: user.email, kind: 'email-changed-old', vars: { name: user.name || undefined } })
  await audit(payload, 'account.email-change-requested', { actor: user.id, target: user.id })
  return redirectTo(req, next, undefined, 'Check the new inbox to confirm the change.')
}

async function resendConfirm(req: Request, payload: Payload, user: SessionUser, origin: string, next: string) {
  const ip = clientIp(req)
  const limited = hit(`confirm:${user.id}:${ip || 'x'}`, RESEND_PER_HOUR, 60 * 60_000)
  if (!limited.allowed) return redirectTo(req, next, 'Please wait a little, then ask again.')
  const full = await loadUser(payload, user.id)
  if (!full) return redirectTo(req, next, 'Please sign in first.')
  if (isEmailConfirmed(full)) return redirectTo(req, next, undefined, 'This email is already confirmed.')
  const portal = portalIdOf(full)
  const portalDoc = portal ? await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 }).catch(() => null) : null
  await issueConfirmEmail(payload, full, (portalDoc as { name?: string } | null)?.name, origin)
  return redirectTo(req, next, undefined, 'If that inbox is yours, a new link is on its way.')
}

async function requestDelete(req: Request, form: FormData, payload: Payload, user: SessionUser, origin: string) {
  const next = text(form, 'next') || '/'
  if (text(form, 'confirm') !== 'delete') return redirectTo(req, next, 'Type delete to confirm.')
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { deletionRequestedAt: now().toISOString() } as never })
  await sendMail(payload, { to: user.email, kind: 'delete-requested', vars: { name: user.name || undefined } })
  await audit(payload, 'account.delete-requested', { actor: user.id, target: user.id })
  return redirectTo(req, next, undefined, 'We will delete this account in 14 days. Signing in before then cancels it.')
}

async function downloadData(req: Request, payload: Payload, user: SessionUser, origin: string, next: string) {
  const full = await loadUser(payload, user.id)
  if (!full) return redirectTo(req, next, 'Please sign in first.')
  if (!exportAllowed(full.lastDataExportAt, now())) return redirectTo(req, next, 'You can ask for one download a day.')
  const built = await buildMyDataZip(payload, user.id)
  const url = mailPublicUrl(`/api/hearts/my-data?token=${built.token}`, origin)
  const mailed = await sendMail(payload, { to: user.email, kind: 'data-ready', vars: { name: user.name || undefined, buttonUrl: url } })
  await audit(payload, 'account.data-export', { actor: user.id, target: user.id })
  if (!mailed.sent) return redirectTo(req, `/api/hearts/my-data?token=${built.token}`)
  return redirectTo(req, next, undefined, 'A download link is on its way to your email.')
}

async function savePrefs(req: Request, form: FormData, payload: Payload, user: SessionUser, next: string) {
  const channels = {} as Record<NotifyKind, NotifyChannel>
  for (const kind of NOTIFY_KINDS) {
    const value = text(form, `pref-${kind}`)
    channels[kind] = value === 'email' || value === 'off' || value === 'in-app' ? value : 'in-app'
  }
  const quietNight = form.get('quietNight') === 'on'
  const emailNews = form.get('emailNews') === 'on'
  const current = parsePrefs((await loadUser(payload, user.id))?.notificationPrefs)
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: {
      notificationPrefs: {
        channels,
        quietNight,
        emailNewsAt: emailNews ? current.emailNewsAt || now().toISOString() : null,
      },
      nightAlerts: channels['gather-tomorrow'] !== 'off',
    } as never,
  })
  return redirectTo(req, next, undefined, 'Notification choices saved.')
}

async function testEmail(req: Request, payload: Payload, user: SessionUser, next: string) {
  if (user.role !== 'master') return redirectTo(req, next, 'Only the master desk sends a test email.')
  const mailed = await sendMail(payload, { to: user.email, kind: 'test', vars: { name: user.name || undefined, buttonUrl: mailPublicUrl('/master', originOf(req)) } })
  if (!mailed.sent) return redirectTo(req, next, transportBanner())
  return redirectTo(req, next, undefined, 'A test email is on its way to you.')
}

async function suspendPerson(req: Request, form: FormData, payload: Payload, actor: SessionUser, origin: string, pause: boolean) {
  const next = text(form, 'next') || '/'
  const target = await loadUser(payload, Number(text(form, 'userId')))
  if (!target) return redirectTo(req, next, 'That person could not be found.')
  const refused = canSuspend(actor, target)
  if (refused) return NextResponse.json({ error: refused }, { status: 403 })
  const reason = text(form, 'reason').slice(0, 200)
  if (pause && reason.length < 3) return redirectTo(req, next, 'Write a short reason.')
  if (pause && killListHits(reason).length) return redirectTo(req, next, 'Please word the reason more calmly.')
  await payload.update({
    collection: 'users',
    id: target.id,
    overrideAccess: true,
    data: pause
      ? { suspendedAt: now().toISOString(), suspendedBy: actor.id, suspendReason: reason, sessions: [] }
      : { suspendedAt: null, suspendedBy: null, suspendReason: null },
  } as never)
  await sendMail(payload, { to: target.email, kind: pause ? 'suspended' : 'restored', vars: { name: target.name || undefined, extra: pause ? reason : undefined } })
  await audit(payload, pause ? 'account.suspended' : 'account.restored', { actor: actor.id, actorRole: actor.role, target: target.id, portal: portalIdOf(target), reason })
  return redirectTo(req, next, undefined, pause ? 'That account is paused.' : 'That account is open again.')
}

async function tempPassword(req: Request, form: FormData, payload: Payload, actor: SessionUser, origin: string) {
  const next = text(form, 'next') || '/'
  const target = await loadUser(payload, Number(text(form, 'userId')))
  if (!target) return redirectTo(req, next, 'That person could not be found.')
  const linked = actor.role === 'teacher' ? await teacherLinked(payload, actor, target) : true
  const refused = canSetTempPassword(actor, target, linked)
  if (refused) return NextResponse.json({ error: refused }, { status: 403 })
  const password = text(form, 'password')
  if (password.length < MIN_PASSWORD) return redirectTo(req, next, 'Use at least 8 characters for the temporary password.')
  await payload.update({ collection: 'users', id: target.id, overrideAccess: true, data: { password, mustChangePassword: true, sessions: [], tokenVersion: (target.tokenVersion || 0) + 1 } as never })
  await sendMail(payload, { to: target.email, kind: 'temp-password', vars: { name: target.name || undefined, extra: `Sign in with the password your teacher gave you.`, buttonUrl: mailPublicUrl('/login', origin) } })
  await audit(payload, 'account.temp-password', { actor: actor.id, actorRole: actor.role, target: target.id, portal: portalIdOf(target) })
  return redirectTo(req, next, undefined, 'A temporary password is set. They must choose their own next time they sign in.')
}

async function changeRole(req: Request, form: FormData, payload: Payload, actor: SessionUser) {
  const next = text(form, 'next') || '/'
  const target = await loadUser(payload, Number(text(form, 'userId')))
  const role = text(form, 'role')
  if (!target) return redirectTo(req, next, 'That person could not be found.')
  const refused = canChangeRole(actor, target, role)
  if (refused) return NextResponse.json({ error: refused }, { status: 403 })
  if (!canHoldStaffRole(target, role)) return redirectTo(req, next, 'They need to confirm their email first.')
  await payload.update({ collection: 'users', id: target.id, overrideAccess: true, data: { role } as never })
  await audit(payload, 'account.role-changed', { actor: actor.id, actorRole: actor.role, target: target.id, portal: portalIdOf(target), detail: { role } })
  return redirectTo(req, next, undefined, `They are now a ${role === 'portal-admin' ? 'portal admin' : role}.`)
}

async function emailJoinLink(req: Request, form: FormData, payload: Payload, actor: SessionUser, origin: string) {
  const next = text(form, 'next') || '/'
  if (actor.role === 'learner') return redirectTo(req, next, 'Only staff can email a join link.')
  const codeId = Number(text(form, 'codeId'))
  const code = await payload.findByID({ collection: 'access-codes', id: codeId, overrideAccess: true, depth: 1 }).catch(() => null)
  if (!code) return redirectTo(req, next, 'That code could not be found.')
  if (actor.role !== 'master' && idOf((code as { portal?: unknown }).portal) !== portalIdOf(actor)) {
    return NextResponse.json({ error: 'That code is not in your portal.' }, { status: 403 })
  }
  const raw = text(form, 'emails')
  const emails = [...new Set(raw.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter((item) => item.includes('@')))].slice(0, JOIN_MAIL_MAX)
  if (!emails.length) return redirectTo(req, next, 'Paste at least one email address.')
  const portal = (code as { portal?: { name?: string; slug?: string } | number }).portal
  const portalName = typeof portal === 'object' && portal ? portal.name : 'HEARTS'
  const slug = typeof portal === 'object' && portal ? portal.slug : ''
  const join = mailPublicUrl(`/join?code=${encodeURIComponent(String((code as { code?: string }).code || ''))}`, origin)
  let sent = 0
  for (const to of emails) {
    const result = await sendMail(payload, {
      to,
      kind: 'join-link',
      vars: { portalName, buttonUrl: join },
      unsubscribeUrl: mailPublicUrl(`/unsubscribe?kind=join-link&email=${encodeURIComponent(to)}`, origin),
    })
    if (result.sent) sent += 1
  }
  await audit(payload, 'account.join-link-emailed', { actor: actor.id, actorRole: actor.role, portal: idOf((code as { portal?: unknown }).portal), detail: { count: emails.length, sent, codeId } })
  return redirectTo(req, next, undefined, `Sent to ${sent} ${sent === 1 ? 'address' : 'addresses'}.`)
}

async function portalEmailPolicy(req: Request, form: FormData, payload: Payload, actor: SessionUser) {
  const next = text(form, 'next') || '/'
  if (actor.role !== 'master' && actor.role !== 'portal-admin') return redirectTo(req, next, 'Only a portal admin can change this.')
  const slug = text(form, 'portalSlug')
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: slug } } })
  const portal = found.docs[0] as { id: number } | undefined
  if (!portal) return redirectTo(req, next, 'That portal could not be found.')
  if (actor.role !== 'master' && portal.id !== portalIdOf(actor)) return NextResponse.json({ error: 'That portal is not yours.' }, { status: 403 })
  await payload.update({ collection: 'portals', id: portal.id, overrideAccess: true, data: { requireEmailConfirm: form.get('requireEmailConfirm') === 'on' } as never })
  return redirectTo(req, next, undefined, 'Email setting saved.')
}

async function resetTotp(req: Request, form: FormData, payload: Payload, actor: SessionUser) {
  const next = text(form, 'next') || '/'
  if (actor.role !== 'master') return redirectTo(req, next, 'Only the master can reset two-step sign-in.')
  const target = await loadUser(payload, Number(text(form, 'userId')))
  if (!target) return redirectTo(req, next, 'That person could not be found.')
  const reason = text(form, 'reason').slice(0, 200)
  if (reason.length < 3) return redirectTo(req, next, 'Write a short reason.')
  await payload.update({
    collection: 'users',
    id: target.id,
    overrideAccess: true,
    data: { totpSecret: null, totpEnabledAt: null, totpPendingSecret: null, backupCodes: [] },
  } as never)
  await sendMail(payload, { to: target.email, kind: 'two-step-reset', vars: { name: target.name || undefined } })
  await audit(payload, 'account.2fa-reset', { actor: actor.id, actorRole: actor.role, target: target.id, reason })
  return redirectTo(req, next, undefined, 'Two-step sign-in is cleared. They will set it up next time.')
}

async function handleTwoStep(req: Request, form: FormData, payload: Payload, origin: string) {
  const action = text(form, 'action')
  const next = text(form, 'next') || '/'
  const half = readHalfSession(cookieNamed(req.headers.get('cookie'), 'hearts_half'))
  if (!half) return redirectTo(req, '/login', 'Please sign in again, then enter your code.')
  const user = await loadUser(payload, half.userId)
  if (!user || isSuspended(user)) return redirectTo(req, '/login', SUSPEND_MESSAGE)

  if (action === 'setup-totp') {
    const secret = newTotpSecret()
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { totpPendingSecret: sealTotpSecret(secret) } as never })
    return redirectTo(req, `/login/setup?next=${encodeURIComponent(next)}`)
  }

  if (action === 'confirm-totp') {
    const pending = user.totpPendingSecret ? openTotpSecret(user.totpPendingSecret) : ''
    if (!pending || !totpOk(text(form, 'code'), pending)) return redirectTo(req, `/login/setup?next=${encodeURIComponent(next)}`, 'That code did not match. Try the next one from the app.')
    const backups = makeBackupCodes()
    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: { totpSecret: sealTotpSecret(pending), totpEnabledAt: now().toISOString(), totpPendingSecret: null, backupCodes: backups.hashed },
    } as never)
    const dest = `/login/setup?next=${encodeURIComponent(next)}&backup=${encodeURIComponent(backups.plain.join(','))}`
    return finishLogin(req, payload, { token: half.token, user: { ...user, totpEnabledAt: now().toISOString() } }, dest)
  }

  if (action === 'verify-totp') {
    const code = text(form, 'code')
    let ok = false
    if (user.totpSecret && totpOk(code, openTotpSecret(user.totpSecret))) ok = true
    else if (lookLikeBackup(code) && user.backupCodes?.length) {
      const left = takeBackupCode(user.backupCodes, code)
      if (left) {
        ok = true
        await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { backupCodes: left } as never })
      }
    }
    if (!ok) return redirectTo(req, `/login/code?next=${encodeURIComponent(next)}`, 'That code did not match.')
    return finishLogin(req, payload, { token: half.token, user }, next)
  }

  return redirectTo(req, '/login')
}

export async function confirmEmailToken(payload: Payload, token: string) {
  const hashed = hashToken(token)
  const byConfirm = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { emailConfirmToken: { equals: hashed } } })
  const byPending = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { pendingEmailToken: { equals: hashed } } })
  const person = (byConfirm.docs[0] || byPending.docs[0]) as AccountUser | undefined
  if (!person) return { ok: false as const, error: CONFIRM_STALE }
  if (byPending.docs[0] && person.pendingEmail) {
    if (!tokenFresh(person.pendingEmailExpiresAt, now())) return { ok: false as const, error: CONFIRM_STALE }
    const taken = await findByEmail(payload, person.pendingEmail)
    if (taken && taken.id !== person.id) return { ok: false as const, error: 'That email already has an account.' }
    await payload.update({
      collection: 'users',
      id: person.id,
      overrideAccess: true,
      data: {
        email: person.pendingEmail,
        emailConfirmedAt: now().toISOString(),
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
      } as never,
    })
    await audit(payload, 'account.email-changed', { actor: person.id, target: person.id })
    return { ok: true as const, notice: 'Your email is updated.' }
  }
  if (!tokenFresh(person.emailConfirmExpiresAt, now())) return { ok: false as const, error: CONFIRM_STALE }
  await payload.update({
    collection: 'users',
    id: person.id,
    overrideAccess: true,
    data: { emailConfirmedAt: now().toISOString(), emailConfirmToken: null, emailConfirmExpiresAt: null } as never,
  })
  return { ok: true as const, notice: 'Thank you. Your email is confirmed.' }
}

export async function applyUnsubscribe(payload: Payload, userId: number, kind: string, token: string) {
  if (token !== unsubscribeToken(userId, kind === 'all' ? 'all' : (kind as NotifyKind)) && token !== unsubscribeToken(userId, 'all')) {
    return { ok: false as const, error: 'That unsubscribe link is not valid.' }
  }
  const person = await loadUser(payload, userId)
  if (!person) return { ok: false as const, error: 'That unsubscribe link is not valid.' }
  const prefs = parsePrefs(person.notificationPrefs, person.nightAlerts)
  if (kind === 'all') {
    for (const key of NOTIFY_KINDS) if (prefs.channels[key] === 'email') prefs.channels[key] = 'in-app'
  } else if (NOTIFY_KINDS.includes(kind as NotifyKind) && prefs.channels[kind as NotifyKind] === 'email') {
    prefs.channels[kind as NotifyKind] = 'in-app'
  }
  await payload.update({ collection: 'users', id: userId, overrideAccess: true, data: { notificationPrefs: prefs } as never })
  return { ok: true as const }
}

export function setupTotpState(email: string, pendingBlob?: string | null) {
  if (!pendingBlob) return null
  const secret = openTotpSecret(pendingBlob)
  return { secret, uri: totpUri(email, secret) }
}

export { backupHash }
