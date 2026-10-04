import { notFound } from 'next/navigation'
import { adoptedCourseIds } from '@/server/context'
import { defaultFeatures, featuresOf, type FeatureSource } from '@/lib/features'
import { portalDisplayName } from '@/lib/portal-name'
import { PortalStudio } from '@/components/desk/portal-studio'
import { rows, str } from '../common'
import type { MasterCtx } from './master'
import { MasterFrame } from './master'

async function libraryCourses(payload: MasterCtx['payload']) {
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'master' } }, { importable: { not_equals: false } }] }, { sort: 'title', limit: 500 })
  return courses.map((course) => ({ id: course.id, title: str(course.title) }))
}

export async function PortalCreateScreen(ctx: MasterCtx) {
  const courses = await libraryCourses(ctx.payload)
  return (
    <MasterFrame ctx={ctx} active="portals" title="Open a portal" intro="Choose the name, the courses from the library, and which features this community will have." testId="portal-create">
      <PortalStudio mode="create" action="create-portal" next="/master" courses={courses} features={defaultFeatures()} />
    </MasterFrame>
  )
}

export async function PortalEditScreen(ctx: MasterCtx, slug: string) {
  const portal = (await rows(ctx.payload, 'portals', { slug: { equals: slug } }, { limit: 1 }))[0]
  if (!portal) notFound()
  const [courses, selected] = await Promise.all([libraryCourses(ctx.payload), adoptedCourseIds(ctx.payload, portal.id)])
  return (
    <MasterFrame
      ctx={ctx}
      active="portals"
      title={`Features for ${portalDisplayName(portal)}`}
      intro="Switch parts on in stages. Saving takes effect at once for learners and for the desk."
      testId="portal-edit"
    >
      <PortalStudio
        mode="edit"
        action="portal-features"
        next={`/master/portals/${str(portal.slug)}`}
        name={str(portal.name)}
        slug={str(portal.slug)}
        kind={str(portal.kind) || 'mosque'}
        welcome={str(portal.welcome)}
        courses={courses}
        selectedCourses={selected}
        features={featuresOf(portal as FeatureSource)}
      />
    </MasterFrame>
  )
}
