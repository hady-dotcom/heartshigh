import { randomBytes } from 'node:crypto'
import { portalIdOf } from '@/lib/ids'

/** Desk actions on a learner account. Move is master-only. */
export type LearnerAction = 'reset' | 'move' | 'pause' | 'unpause' | 'remove' | 'delete' | 'read'

export type ActorScope = { role: string; portalId: number | null }
export type LearnerScope = { role: string; portalId: number | null }

export const BULK_LIMIT = 25

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** A short password the desk can read out once. No look-alike characters. */
export function temporaryPassword(bytes: Uint8Array = randomBytes(12)) {
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

export function actorScope(user: { role?: string | null; tenants?: { tenant?: unknown }[] } | null | undefined): ActorScope {
  return { role: user?.role || '', portalId: portalIdOf(user) }
}

/**
 * Portal admins act only on learners in their own portal.
 * The master desk acts on every portal. Teachers can look, not change the account.
 * Returns a sentence when the action is refused, or null when it is allowed.
 */
export function learnerActionRefusal(actor: ActorScope, learner: LearnerScope, action: LearnerAction): string | null {
  if (learner.role !== 'learner') return 'That person is not a learner.'
  if (actor.role === 'master') return null
  if (actor.role !== 'portal-admin') return 'Only a portal admin or the master desk can do this.'
  if (action === 'move') return 'Only the master desk can move someone to another portal.'
  if (!actor.portalId || actor.portalId !== learner.portalId) return 'That learner is in another portal.'
  return null
}

/** Teachers and portal admins can open a learner in their own portal. The master desk can open any learner. */
export function canReadLearner(actor: ActorScope, learner: LearnerScope) {
  if (learner.role !== 'learner') return false
  if (actor.role === 'master') return true
  if (actor.role !== 'portal-admin' && actor.role !== 'teacher') return false
  return actor.portalId != null && actor.portalId === learner.portalId
}

export function managesLearnerAccounts(role: string) {
  return role === 'master' || role === 'portal-admin'
}

export function planActionRefusal(actor: ActorScope, planPortalId: number | null, _action: 'edit' | 'delete' = 'edit'): string | null {
  if (actor.role === 'master') return null
  if (actor.role !== 'portal-admin' && actor.role !== 'teacher') return 'Only the desk can change a study plan.'
  if (!actor.portalId || actor.portalId !== planPortalId) return 'That plan is in another portal.'
  return null
}

export function diaryDeleteRefusal(actor: ActorScope, entryPortalId: number | null): string | null {
  if (actor.role === 'master') return null
  if (actor.role !== 'portal-admin') return 'Only a portal admin or the master desk can delete a diary entry.'
  if (!actor.portalId || actor.portalId !== entryPortalId) return 'That diary is in another portal.'
  return null
}

/**
 * Words are shown only when the learner shared the entry and did not mark the answer private.
 * Private rows stay with the learner: the desk still sees who, where and when, and can delete.
 */
export function diaryShowsWords(
  entry: { consent?: boolean | null },
  answer?: { keepPrivate?: boolean | null } | null,
) {
  if (answer?.keepPrivate) return false
  return Boolean(entry.consent)
}

export function nameMatches(typed: string, name: string) {
  const wanted = name.trim()
  return wanted.length > 0 && typed.trim() === wanted
}

export function matchesLearnerSearch(name: string, email: string, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return `${name} ${email}`.toLowerCase().includes(needle)
}

export function tooManyBulk(count: number) {
  if (count < 1) return 'Tick at least one person.'
  if (count > BULK_LIMIT) return `Tick up to ${BULK_LIMIT} people at a time.`
  return null
}

/** A plan that only belonged to this learner is deleted. A shared plan keeps the other people. */
export function planAfterLearnerGone(
  plan: { ownerId: number | null; learnerIds: number[] },
  learnerId: number,
): 'delete' | { learnerIds: number[]; ownerId: number | null } {
  const learnerIds = plan.learnerIds.filter((id) => id !== learnerId)
  const ownerId = plan.ownerId === learnerId ? null : plan.ownerId
  if (!learnerIds.length) return 'delete'
  return { learnerIds, ownerId }
}

export function anonymisedSubject(subject: string, learnerId: number, email?: string | null) {
  const id = String(learnerId)
  const value = subject.trim()
  if (value === id || value === `learner:${id}`) return 'removed'
  if (email && value.toLowerCase() === email.toLowerCase()) return 'removed'
  return value
}

/** Drop anything in an analytics blob that still names the person. The row itself stays, so the counts stay. */
export function anonymiseProps(
  props: unknown,
  hints: { id: number; email?: string | null; name?: string | null },
): Record<string, unknown> | null {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null
  const email = hints.email?.trim().toLowerCase() || ''
  const name = hints.name?.trim() || ''
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (email && lower.includes(email)) continue
      if (name && value.includes(name)) continue
      if (value === String(hints.id) || value === `learner:${hints.id}`) continue
      out[key] = value
      continue
    }
    if (typeof value === 'number' && value === hints.id && /user|learner|subject|email|name/i.test(key)) continue
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}
