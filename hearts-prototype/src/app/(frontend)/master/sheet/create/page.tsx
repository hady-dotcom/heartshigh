import { rows, str } from '@/screens/common'
import { CreatorForm } from '@/screens/desk/creator'
import { DeskFrame, masterNav } from '@/screens/desk/shell'
import { requireMaster } from '@/server/context'

export const dynamic = 'force-dynamic'

export default async function MasterCreatorPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { payload, user } = await requireMaster()
  const query = await searchParams
  const courses = await rows(payload, 'courses', { origin: { equals: 'master' } }, { sort: 'title', limit: 500 })
  return (
    <DeskFrame payload={payload} user={user} title="Sheet creator" intro="Name a topic and the desk drafts a master sheet. You still preview and apply it before anything reaches learners." active="create" nav={masterNav()} brand="Hudhud" subBrand="Master desk" brandHref="/master" query={query} testId="master-creator">
      <CreatorForm courses={courses.map((course) => ({ id: course.id, title: str(course.title) }))} endpoint="/api/hearts/sheet/create" next="/master/sheet" />
    </DeskFrame>
  )
}
