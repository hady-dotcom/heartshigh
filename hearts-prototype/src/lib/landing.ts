/** Where a person should land after join or sign-in. Teachers use the learner app on a phone. */

export function isAppRole(role: string | null | undefined) {
  return role === 'learner' || role === 'parent' || role === 'teacher'
}

export function portalAppPath(slug: string) {
  return `/p/${slug}`
}

export function portalDeskPath(slug: string) {
  return `/p/${slug}/admin`
}

/** Sign-in with next=/ goes to the app for learners, parents and teachers; desk for portal admins. */
export function portalHomePath(slug: string, role: string | null | undefined) {
  return isAppRole(role) ? portalAppPath(slug) : portalDeskPath(slug)
}

/** A new account from a join code. Learners still see Welcome; teachers open the app. */
export function afterJoinPath(slug: string, codeRole: string | null | undefined) {
  if (codeRole === 'learner' || codeRole === 'parent') return `${portalAppPath(slug)}/welcome`
  if (codeRole === 'teacher') return portalAppPath(slug)
  return portalDeskPath(slug)
}

export function deskAppHref(brandHref: string) {
  if (brandHref.endsWith('/admin')) return brandHref.slice(0, -'/admin'.length) || '/'
  return null
}
