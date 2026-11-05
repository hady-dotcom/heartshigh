import { requireMaster } from '@/server/context'
import { rows, str } from '@/screens/common'
import { BringInBody } from '@/screens/desk/bring-in'
import { MasterFrame } from '@/screens/desk/master'

export default async function BringInPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; preview?: string; lessons?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  const courses = await rows(payload, 'courses', { origin: { equals: 'master' } }, { sort: 'title', limit: 500 })
  return (
    <MasterFrame ctx={{ payload, user, query }} active="bring-in" title="Bring in" intro="Paste YouTube links, a playlist or a channel. Films arrive as drafts. Learners see a talk only after you publish it." testId="master-bring-in" showOnPhone>
      <BringInBody
        payload={payload}
        user={user}
        next="/master/bring-in"
        courses={courses.map((course) => ({ id: course.id, title: str(course.title), speaker: str(course.speaker) }))}
        query={query}
      />
    </MasterFrame>
  )
}
