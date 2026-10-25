import { portalIdOf } from './ids'

/** Where a person should land after join or sign-in. */

export function isAppRole(role: string | null | undefined) {
  return role === 'learner' || role === 'parent'
}

export function portalAppPath(slug: string) {
  return `/p/${slug}`
}

export function portalDeskPath(slug: string) {
  return `/p/${slug}/admin`
}

/** Teach is the teacher's own desk. The learner feed stays one link away. */
export function teacherDeskPath(slug: string) {
  return `${portalDeskPath(slug)}/teach`
}

/** Sign-in with next=/ goes to the app for learners and parents, Teach for teachers, and the desk for portal admins. */
export function portalHomePath(slug: string, role: string | null | undefined) {
  if (role === 'teacher') return teacherDeskPath(slug)
  return isAppRole(role) ? portalAppPath(slug) : portalDeskPath(slug)
}

/** A new account from a join code. Learners still see Welcome. A sequenced course opens the first film. A teacher opens Teach, not the learner feed. */
export function afterJoinPath(slug: string, codeRole: string | null | undefined, shape?: 'hearts' | 'sequence') {
  if ((codeRole === 'learner' || codeRole === 'parent') && shape === 'sequence') return `${portalAppPath(slug)}?open=1`
  if (codeRole === 'learner' || codeRole === 'parent') return `${portalAppPath(slug)}/welcome`
  if (codeRole === 'teacher') return teacherDeskPath(slug)
  return portalDeskPath(slug)
}

export function deskAppHref(brandHref: string) {
  if (brandHref.endsWith('/admin')) return brandHref.slice(0, -'/admin'.length) || '/'
  return null
}

/** A readable role for the door, when the signed-in person opened a desk that is not theirs. */
export function accountRoleLabel(role: string | null | undefined) {
  if (role === 'master') return 'Master'
  if (role === 'portal-admin') return 'Portal admin'
  if (role === 'teacher') return 'Teacher'
  if (role === 'parent') return 'Parent'
  if (role === 'learner') return 'Learner'
  return role || 'Learner'
}

/** Shown on the front door instead of a bare “not yours” error. */
export function signedInElsewhere(name: string | null | undefined, role: string | null | undefined) {
  const who = (name || '').trim() || 'this account'
  return `You're signed in as ${who} (${accountRoleLabel(role)}). Sign in as someone else`
}

/** A teacher or portal admin of this portal, while they are in the learner app. */
export function staffDeskHref(
  user: { role?: string | null; tenants?: { tenant?: unknown }[] } | null | undefined,
  portal: { id: number; slug: string } | null | undefined,
) {
  if (!user || !portal) return null
  if (user.role !== 'teacher' && user.role !== 'portal-admin') return null
  if (portalIdOf(user) !== portal.id) return null
  return user.role === 'teacher' ? teacherDeskPath(portal.slug) : portalDeskPath(portal.slug)
}
