import { str } from '../common'
import type { Ctx } from '../common'
import { CreatorForm } from './creator'
import { AdminFrame } from './overview'

export async function PortalCreatorScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const courses = await payload.find({
    collection: 'courses', overrideAccess: true, depth: 0, limit: 500, sort: 'title',
    where: { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] },
  })
  return (
    <AdminFrame ctx={ctx} active="create" title="Sheet creator" intro="Build a draft sheet for a course in this portal. The master library stays as it is, and nothing goes live until you apply the preview." testId="portal-creator">
      <CreatorForm
        courses={courses.docs.map((course) => ({ id: course.id, title: str((course as { title?: string }).title) }))}
        endpoint="/api/hearts/sheet/create"
        next={`${base}/admin/sheet`}
      />
    </AdminFrame>
  )
}
