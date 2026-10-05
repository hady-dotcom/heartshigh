import type { Payload } from 'payload'
import { idOf, portalIdOf } from '../../lib/ids'
import type { SessionUser } from '../context'
import type { PersonMode } from './types'

export type PersonDoc = {
  id: number
  name?: string | null
  email?: string | null
  role?: string | null
  tenants?: { tenant?: unknown }[]
}

export function tenantsOf(person: PersonDoc) {
  return (person.tenants || []).map((row) => idOf(row.tenant)).filter((id): id is number => Boolean(id))
}

export async function countMasters(payload: Payload) {
  const found = await payload.count({ collection: 'users', overrideAccess: true, where: { role: { equals: 'master' } } })
  return found.totalDocs
}

export function refusePortalDelete(actor: SessionUser | null) {
  if (!actor) return 'Please sign in first.'
  if (actor.role !== 'master') return 'Only the master desk can delete a portal.'
  return null
}

export async function refusePersonDelete(
  payload: Payload,
  actor: SessionUser | null,
  target: PersonDoc | null,
  portalId: number | null,
  mode: PersonMode,
) {
  if (!actor) return 'Please sign in first.'
  if (!target) return 'That person could not be found.'
  if (actor.role === 'teacher' || actor.role === 'learner') return 'Your role cannot delete people.'
  if (target.role === 'master' && actor.role !== 'master') return 'A portal desk cannot delete a master admin.'
  if (target.role === 'master' && (await countMasters(payload)) <= 1) return 'The last master admin cannot be deleted.'
  if (actor.role === 'portal-admin') {
    const mine = portalIdOf(actor)
    if (!mine) return 'Your account is not in a portal.'
    if (portalId && mine !== portalId) return 'That person is in another portal.'
    if (!tenantsOf(target).includes(mine)) return 'That person is not in your portal.'
    if (mode === 'account' && tenantsOf(target).some((id) => id !== mine)) {
      return 'This account is also in another portal. Take them off this portal, or ask the master desk to wipe the whole account.'
    }
  }
  if (actor.role === 'master' && portalId && mode === 'portal' && !tenantsOf(target).includes(portalId)) {
    return 'That person is not in this portal.'
  }
  return null
}

export async function refuseSelfDelete(payload: Payload, actor: SessionUser | null) {
  if (!actor) return 'Please sign in first.'
  if (actor.role === 'master' && (await countMasters(payload)) <= 1) return 'The last master admin cannot be deleted.'
  return null
}

export function confirmMatches(typed: string, expected: string) {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase() && Boolean(expected.trim())
}
