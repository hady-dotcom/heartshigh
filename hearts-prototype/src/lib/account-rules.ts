import { isProduction, type Env } from './env'

export const CONFIRM_MS = 7 * 86_400_000
export const RESET_MS = 60 * 60_000
export const EMAIL_CHANGE_MS = 24 * 60 * 60_000
export const DATA_EXPORT_MS = 24 * 60 * 60_000
export const DELETE_WAIT_MS = 14 * 86_400_000
export const HALF_SESSION_MS = 10 * 60_000
export const RESEND_PER_HOUR = 3
export const EXPORT_PER_DAY = 1
export const JOIN_MAIL_MAX = 200
export const NOTIFY_DEBOUNCE_MS = 60 * 60_000
export const QUIET_START = 22
export const QUIET_END = 7
export const MIN_PASSWORD = 8

export type AccountRole = 'master' | 'portal-admin' | 'teacher' | 'learner'

export type AccountPerson = {
  id: number
  email?: string | null
  name?: string | null
  role?: AccountRole | string | null
  emailConfirmedAt?: string | null
  suspendedAt?: string | null
  removed?: boolean | null
  totpEnabledAt?: string | null
  mustChangePassword?: boolean | null
  deletionRequestedAt?: string | null
  lastDataExportAt?: string | null
  tenants?: { tenant?: unknown }[]
}

export function isSuspended(person: { suspendedAt?: string | null; removed?: boolean | null } | null | undefined) {
  return Boolean(person?.suspendedAt) || Boolean(person?.removed)
}

export function isEmailConfirmed(person: { emailConfirmedAt?: string | null } | null | undefined) {
  return Boolean(person?.emailConfirmedAt)
}

export function twoFactorRole(role?: string | null) {
  return role === 'master' || role === 'portal-admin'
}

/** Challenge after password when the person has enrolled, or when production (or HEARTS_REQUIRE_2FA) requires it. */
export function twoFactorNeeded(person: AccountPerson | null | undefined, env: Env = process.env) {
  if (!person) return false
  if (person.totpEnabledAt) return twoFactorRole(person.role) || person.role === 'teacher'
  if (!twoFactorRole(person.role)) return false
  if (env.HEARTS_E2E === '1' || env.HEARTS_TEST_CLOCK === '1') return env.HEARTS_REQUIRE_2FA === '1'
  if (isProduction(env)) return true
  return env.HEARTS_REQUIRE_2FA === '1'
}

export function canResetByEmail(person: AccountPerson | null | undefined) {
  if (!person || isSuspended(person)) return false
  return isEmailConfirmed(person)
}

export function canHoldStaffRole(person: AccountPerson | null | undefined, role: string) {
  if (role === 'learner') return true
  return isEmailConfirmed(person)
}

export function samePortal(actor: AccountPerson, target: AccountPerson) {
  const actorPortal = portalId(actor)
  const targetPortal = portalId(target)
  return Boolean(actorPortal && targetPortal && actorPortal === targetPortal)
}

export function portalId(person: AccountPerson | null | undefined) {
  const row = person?.tenants?.[0]
  if (!row?.tenant) return null
  if (typeof row.tenant === 'number') return row.tenant
  if (typeof row.tenant === 'object' && row.tenant && 'id' in row.tenant) return Number((row.tenant as { id: number }).id)
  return Number(row.tenant) || null
}

export function canSuspend(actor: AccountPerson, target: AccountPerson) {
  if (!actor || !target || actor.id === target.id) return 'You cannot pause your own account.'
  if (target.role === 'master') return 'The master account cannot be paused.'
  if (actor.role === 'master') return null
  if (actor.role === 'portal-admin') {
    if (!samePortal(actor, target)) return 'That person is in another portal.'
    return null
  }
  return 'Only a portal admin or the master can pause an account.'
}

export function canRestore(actor: AccountPerson, target: AccountPerson) {
  return canSuspend(actor, target)
}

export function canSetTempPassword(actor: AccountPerson, target: AccountPerson, teacherLinked: boolean) {
  if (!actor || !target) return 'There is nobody with that id.'
  if (actor.id === target.id) return 'Use Change password for your own account.'
  if (target.role === 'master') return 'The master password is not set from here.'
  if (actor.role === 'master') return null
  if (actor.role === 'portal-admin') {
    if (!samePortal(actor, target)) return 'That person is in another portal.'
    return null
  }
  if (actor.role === 'teacher') {
    if (target.role !== 'learner') return 'Teachers can only set a password for their own learners.'
    if (!teacherLinked) return 'That learner is not linked to you.'
    return null
  }
  return 'You cannot set a password for someone else.'
}

export function canChangeRole(actor: AccountPerson, target: AccountPerson, nextRole: string) {
  if (!['learner', 'teacher', 'portal-admin'].includes(nextRole)) return 'That role is not used here.'
  if (!actor || !target) return 'There is nobody with that id.'
  if (target.role === 'master' || nextRole === 'master') return 'The master role is not changed from here.'
  if (actor.id === target.id) return 'You cannot change your own role.'
  if (nextRole !== 'learner' && !isEmailConfirmed(target)) return 'They need to confirm their email before they can hold that role.'
  if (actor.role === 'master') return null
  if (actor.role === 'portal-admin') {
    if (!samePortal(actor, target)) return 'That person is in another portal.'
    if (nextRole === 'portal-admin') return 'A portal admin can promote up to teacher only.'
    return null
  }
  return 'Only a portal admin or the master can change a role.'
}

export function hourInZone(at: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(at),
  )
  return Number.isFinite(hour) ? hour : at.getUTCHours()
}

export function isQuietHour(at: Date, timeZone: string) {
  const hour = hourInZone(at, timeZone)
  return hour >= QUIET_START || hour < QUIET_END
}

export function deleteDueAt(requestedAt: string | Date) {
  return new Date(new Date(requestedAt).getTime() + DELETE_WAIT_MS)
}

export function deleteIsDue(requestedAt: string | Date, now: Date) {
  return now.getTime() >= deleteDueAt(requestedAt).getTime()
}

export function exportAllowed(lastAt: string | null | undefined, now: Date) {
  if (!lastAt) return true
  return now.getTime() - new Date(lastAt).getTime() >= 86_400_000
}

export function tokenFresh(expiresAt: string | null | undefined, now: Date) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() > now.getTime()
}

export const SUSPEND_MESSAGE = 'This account is paused. Please speak to your masjid or school.'

/** Timed pause line for the sign-in flash and the paused email. */
export function pausedSinceMessage(when?: string | null) {
  const time = (when || '').trim()
  if (!time) return SUSPEND_MESSAGE
  return `This account is paused since ${time}. Please speak to your masjid or school.`
}
export const RESET_STALE = 'That reset link is not valid any more.'
export const CONFIRM_STALE = 'That confirmation link is not valid any more. Ask for a new one.'
export const ASK_TEACHER = 'Ask your teacher to set a password for you.'
