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

/** A new account from a join code. Learners still see Welcome. A teacher opens Teach, not the learner feed. */
export function afterJoinPath(slug: string, codeRole: string | null | undefined) {
  if (codeRole === 'learner' || codeRole === 'parent') return `${portalAppPath(slug)}/welcome`
  if (codeRole === 'teacher') return teacherDeskPath(slug)
  return portalDeskPath(slug)
}

export function deskAppHref(brandHref: string) {
  if (brandHref.endsWith('/admin')) return brandHref.slice(0, -'/admin'.length) || '/'
  return null
}
