import type { Payload } from 'payload'
import { idOf } from '../lib/ids'
import { LONG_SITTINGS, planSeriesMoves, type LibraryLesson } from '../lib/series-group'

const slugOf = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

type Doc = Record<string, unknown> & { id: number }

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

async function ensureCourse(payload: Payload, title: string, speaker: string, summary: string) {
  const token = `GROUP-${slugOf(title)}`
  const existing = (await one(payload, 'courses', { importToken: { equals: token } })) || (await one(payload, 'courses', { title: { equals: title } }))
  if (existing) {
    return (await payload.update({
      collection: 'courses',
      id: existing.id,
      overrideAccess: true,
      data: { title, speaker: (existing.speaker as string) || speaker, summary: (existing.summary as string) || summary, visibility: 'published', importable: true, isPublic: true } as never,
    })) as unknown as Doc
  }
  return (await payload.create({
    collection: 'courses',
    overrideAccess: true,
    data: { title, speaker, summary, origin: 'master', importable: true, isPublic: true, importToken: token, visibility: 'published' } as never,
  })) as unknown as Doc
}

async function ensureUnit(payload: Payload, courseId: number) {
  const existing = await one(payload, 'units', { course: { equals: courseId } })
  if (existing) return existing
  return (await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Talks', course: courseId, order: 1 } as never })) as unknown as Doc
}

/** Apply the series grouping plan. Used by seed only. Never a production write. */
export async function applySeriesGroups(payload: Payload) {
  const courses = ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string; speaker?: string }[])
  const lessons = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as {
    id: number
    title?: string
    course?: number | { id: number }
    durationSeconds?: number
    youtubeId?: string
    order?: number
    speaker?: string
  }[])
  const library: LibraryLesson[] = lessons.map((lesson) => {
    const courseId = idOf(lesson.course) || 0
    const course = courses.find((row) => row.id === courseId)
    return {
      id: lesson.id,
      title: String(lesson.title || ''),
      courseId,
      courseTitle: String(course?.title || ''),
      durationSeconds: Number(lesson.durationSeconds || 0),
      youtubeId: lesson.youtubeId || '',
      order: Number(lesson.order || 0),
    }
  })
  const plan = planSeriesMoves(library)
  const courseByTitle = new Map<string, Doc>()
  for (const group of plan.groups) {
    const speaker = library.find((row) => group.lessonIds.includes(row.id))?.title || 'HEARTS'
    const first = lessons.find((row) => row.id === group.lessonIds[0])
    const summary = group.title === LONG_SITTINGS
      ? 'Ten long talks from the library, grouped so a week of study days can share them out.'
      : `${group.title}: every long sitting of this series that is in the library.`
    const course = await ensureCourse(payload, group.title, String(first?.speaker || speaker), summary)
    courseByTitle.set(group.title, course)
    const unit = await ensureUnit(payload, course.id)
    for (const [index, lessonId] of group.lessonIds.entries()) {
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        overrideAccess: true,
        data: { course: course.id, unit: unit.id, order: index + 1 } as never,
      })
      const cuts = await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 400, where: { lesson: { equals: lessonId } } })
      for (const cut of cuts.docs) {
        await payload.update({ collection: 'cuts', id: cut.id, overrideAccess: true, data: { course: course.id } as never })
      }
    }
  }

  for (const empty of plan.emptyCourses) {
    const still = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 1, where: { course: { equals: empty.id } } })).docs || [])
    if (still.length) continue
    await payload.update({ collection: 'courses', id: empty.id, overrideAccess: true, data: { visibility: 'draft', importable: false, isPublic: false } as never })
  }

  const kept = [...courseByTitle.values()].map((course) => course.id)
  const packs = ((await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 20 })).docs as { id: number; title?: string; courses?: unknown[] }[])
  for (const pack of packs) {
    const current = ((pack.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const emptied = new Set(plan.emptyCourses.map((row) => row.id))
    const next = [...new Set([...current.filter((id) => !emptied.has(id)), ...kept])]
    if (pack.title === 'One Names class') {
      const names = courseByTitle.get('The Names')
      await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: names ? [names.id] : next } as never })
      continue
    }
    if (next.length !== current.length || next.some((id, index) => id !== current[index])) {
      await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: next } as never })
    }
  }

  const groupedIds = [...courseByTitle.values()].map((course) => course.id)
  const people = ((await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 200 })).docs as { id: number; courseList?: unknown }[])
  for (const person of people) {
    const list = Array.isArray(person.courseList) ? person.courseList.map(Number).filter(Boolean) : null
    if (!list || !groupedIds.some((id) => !list.includes(id))) continue
    await payload.update({ collection: 'users', id: person.id, overrideAccess: true, data: { courseList: [...new Set([...list, ...groupedIds])] } as never })
  }
  console.log(`Grouped series: ${plan.groups.map((group) => `${group.title} (${group.lessonIds.length})`).join(', ') || 'none'}. ${plan.moves.length} talks moved.`)
  return { plan, courseIds: groupedIds }
}
