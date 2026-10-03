// Which part of the library a master-sheet request may read or change, from the signed-in desk user and the form.
import { idOf, portalIdOf } from '@/lib/ids'
import { getSession, loadPortal } from '@/server/context'
import { scopeFrom, type SheetScope } from '@/server/master-sheet'

export async function resolveScope(form: FormData | URLSearchParams): Promise<{ scope: SheetScope } | { error: string; status: number }> {
  const { payload, user, viewAs } = await getSession()
  if (!user) return { error: 'Sign in first.', status: 401 }
  if (viewAs) return { error: 'Sign out of view-as before using the master sheet.', status: 403 }
  if (user.role !== 'master' && user.role !== 'portal-admin') return { error: 'The master sheet is for the master desk and portal admins.', status: 403 }
  const value = (key: string) => String(form.get(key) || '')
  const desk = user.role === 'portal-admin' ? 'portal' : value('desk') === 'portal' ? 'portal' : 'master'
  let portalId: number | null = user.role === 'portal-admin' ? portalIdOf(user) : null
  const slug = value('portal') || value('portalSlug')
  if (desk === 'portal' || value('scope') === 'portal') {
    if (user.role === 'master') {
      const portal = slug ? await loadPortal(payload, slug) : null
      if (!portal && value('portalId')) portalId = Number(value('portalId')) || null
      else if (!portal) return { error: 'Name the portal this sheet belongs to.', status: 400 }
      else portalId = portal.id
    }
    if (!portalId) return { error: 'Your account is not in a portal.', status: 403 }
  }
  if (user.role === 'portal-admin' && value('scope') === 'library') return { error: 'Portal admins cannot import the master library.', status: 403 }
  const courseId = Number(value('course') || value('courseId')) || null
  const asked = value('scope') || (value('kind') === 'export' ? 'library' : value('kind'))
  const kind = courseId && (asked === 'course' || value('kind') === 'export') ? 'course' : asked
  const scope = scopeFrom(kind, portalId, courseId, desk)
  if (scope.kind === 'course') {
    if (!courseId) return { error: 'Choose a course.', status: 400 }
    const course = await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!course) return { error: 'That course was not found.', status: 404 }
    const origin = (course as { origin?: string }).origin
    const coursePortal = idOf((course as { portal?: unknown }).portal)
    if (user.role === 'portal-admin' && (origin !== 'local' || coursePortal !== portalIdOf(user))) return { error: 'Portal admins can only use courses made in their own portal.', status: 403 }
    scope.portalId = origin === 'local' ? coursePortal : null
    scope.courseId = courseId
  }
  if (user.role === 'portal-admin' && scope.kind === 'library') return { error: 'Portal admins cannot import the master library.', status: 403 }
  return { scope }
}
