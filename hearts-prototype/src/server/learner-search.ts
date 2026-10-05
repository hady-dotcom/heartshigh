import { adoptedCourseIds, visibleCourseIds, type SessionUser } from './context'
import { searchDocs, type SearchDoc } from '@/lib/learner-search'
import type { FeatureSource } from '@/lib/features'
import { displayTalkTitle } from '@/lib/talk-title'
import { slugify } from './learner'

type Payload = Awaited<ReturnType<typeof import('./context').getSession>>['payload']

export async function searchPortal(payload: Payload, user: SessionUser, portal: FeatureSource & { id: number; slug?: string }, base: string, query: string) {
  const courseIds = user.role === 'master' ? await adoptedCourseIds(payload, portal.id) : await visibleCourseIds(payload, user)
  if (!courseIds.length) return []
  const [courses, lessons] = await Promise.all([
    payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: courseIds } } }),
    payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 400, where: { course: { in: courseIds } } }),
  ])
  const docs: SearchDoc[] = []
  const speakers = new Map<string, { name: string; href: string }>()
  for (const course of courses.docs as { id: number; title?: string; speaker?: string }[]) {
    docs.push({
      kind: 'course',
      id: course.id,
      title: course.title || 'Course',
      speaker: course.speaker || '',
      href: `${base}/course/${course.id}`,
    })
    if (course.speaker) speakers.set(slugify(course.speaker), { name: course.speaker, href: `${base}/speaker/${slugify(course.speaker)}` })
  }
  for (const lesson of lessons.docs as {
    id: number
    title?: string
    sourceTitle?: string
    speaker?: string
    course?: unknown
    youtubeId?: string
    vimeoId?: string
    transcript?: string | null
    order?: number
  }[]) {
    const courseId = typeof lesson.course === 'object' && lesson.course && 'id' in lesson.course ? Number((lesson.course as { id: number }).id) : Number(lesson.course || 0)
    const course = courses.docs.find((row) => (row as { id: number }).id === courseId) as { title?: string } | undefined
    docs.push({
      kind: 'talk',
      id: lesson.id,
      title: displayTalkTitle({
        title: lesson.title || '',
        sourceTitle: lesson.sourceTitle || '',
        courseTitle: course?.title || '',
        part: Number(lesson.order || 1),
        youtubeId: lesson.youtubeId || '',
        vimeoId: lesson.vimeoId || '',
      }),
      speaker: lesson.speaker || '',
      courseTitle: course?.title || '',
      transcript: String(lesson.transcript || '').slice(0, 50_000),
      href: `${base}/course/${courseId}?part=${lesson.id}`,
    })
    if (lesson.speaker) speakers.set(slugify(lesson.speaker), { name: lesson.speaker, href: `${base}/speaker/${slugify(lesson.speaker)}` })
  }
  for (const [slug, speaker] of speakers) {
    docs.push({ kind: 'speaker', id: slug, title: speaker.name, href: speaker.href })
  }
  void portal
  return searchDocs(docs, query)
}
