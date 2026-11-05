import { getSession } from '@/server/context'
import { json } from '@/server/api'
import { learnerCanOpenTalk } from '@/server/talk-part'

export const dynamic = 'force-dynamic'

/** Whether Full talk can open this part. A missing course or part is `open: false`, not a 404. */
export async function GET(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ open: false })
  const url = new URL(req.url)
  const courseId = Number(url.searchParams.get('course'))
  const lessonId = Number(url.searchParams.get('lesson'))
  const open = await learnerCanOpenTalk(session.payload, session.user, courseId, lessonId)
  return json({ open })
}
