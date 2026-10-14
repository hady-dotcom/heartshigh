import type { Payload } from 'payload'
import { feedbackDemoSeedAllowed } from '@/lib/feedback'

type Doc = Record<string, unknown> & { id: number }

const SHARED = 'Phone went in the other room after isha. Then I sat with my uncle. He was half asleep.'
const PRIVATE = "Just for me. I'm not putting this where anyone else can read it."
const HAMZA = "On the bus home I clocked I hadn't said salaam to the man next to me. Did it the next morning. Felt a bit late."
const LEEDS = "Walked to fajr with my brother. We didn't rush the last bit. It was cold, though."
const CIRCLE = "Tea on Thursday if you're about. I'll bring the biscuits."
const REPLY = 'Love this. The bit with your uncle made me smile. Thursday?'
const WEAK = 'Did you like the talk?'
const MARKER = SHARED

async function one(payload: Payload, collection: 'users' | 'answers' | 'engagement-points' | 'lessons' | 'messages' | 'portals', where: Record<string, unknown>) {
  const found = await payload.find({ collection, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

/**
 * Sample answers for the feedback desk. Hearts demo only: not production, and not a starters load.
 * Safe to run again. It does not publish a question rewrite.
 */
export async function seedFeedbackDemo(payload: Payload, opts: { startersOnly?: boolean } = {}) {
  if (!feedbackDemoSeedAllowed(process.env, Boolean(opts.startersOnly))) return
  if (await one(payload, 'answers', { body: { equals: MARKER } })) return
  const maryam = await one(payload, 'users', { email: { equals: 'elm-learner@hearts.test' } })
  const hamza = await one(payload, 'users', { email: { equals: 'elm-learner2@hearts.test' } })
  const yusuf = await one(payload, 'users', { email: { equals: 'leeds-learner@hearts.test' } })
  const elm = await one(payload, 'portals', { slug: { equals: 'east-london' } })
  const leeds = await one(payload, 'portals', { slug: { equals: 'leeds' } })
  if (!maryam || !hamza || !elm) return
  const points = (await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 30,
    sort: 'second',
    where: { status: { not_equals: 'rejected' } },
  })).docs as unknown as Doc[]
  const usable = points.filter((point) => point.prompt && point.lesson)
  const popup = usable.find((point) => point.kind === 'question' || point.kind === 'multiple_choice') || usable[0]
  const reflection = usable.find((point) => point.kind === 'reflection' && point.id !== popup?.id) || usable[1] || popup
  const task = usable.find((point) => point.kind === 'task') || null
  if (!popup || !reflection) {
    console.log('Feedback demo: no questions to hang sample answers on.')
    return
  }
  const now = Date.now()
  const day = (ago: number) => new Date(now - ago * 86_400_000).toISOString()
  async function answer(input: { point: Doc; user: Doc; portal: number; body: string; choice?: string; keepPrivate?: boolean; share?: boolean; ago: number }) {
    const lesson = Number(input.point.lesson)
    const created = (await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: {
        point: input.point.id,
        user: input.user.id,
        lesson,
        body: input.body,
        choice: input.choice || '',
        portal: input.portal,
        keepPrivate: Boolean(input.keepPrivate),
        shareWithTeacher: Boolean(input.share) && !input.keepPrivate,
        answeredAt: day(input.ago),
      } as never,
    })) as unknown as Doc
    if (input.share && !input.keepPrivate) {
      const lessonDoc = await payload.findByID({ collection: 'lessons', id: lesson, depth: 0, overrideAccess: true }).catch(() => null)
      await payload.create({
        collection: 'workbook-entries',
        overrideAccess: true,
        data: {
          user: input.user.id,
          answer: created.id,
          lesson,
          course: (lessonDoc as { course?: number } | null)?.course,
          body: input.body,
          consent: true,
          portal: input.portal,
          teacherReply: input.body === SHARED ? REPLY : '',
        } as never,
      })
    }
    return created
  }
  await answer({ point: popup, user: maryam, portal: elm.id, body: SHARED, choice: popup.kind === 'multiple_choice' ? String((popup.options as string[] | undefined)?.[0] || '') : '', share: true, ago: 2 })
  await answer({ point: reflection, user: maryam, portal: elm.id, body: PRIVATE, keepPrivate: true, ago: 3 })
  await answer({ point: reflection, user: hamza, portal: elm.id, body: HAMZA, share: true, ago: 1 })
  if (task) await answer({ point: task, user: hamza, portal: elm.id, body: 'Left my phone in the kitchen for one meal. Told my sister why. She laughed.', share: true, ago: 4 })
  if (yusuf && leeds) await answer({ point: popup, user: yusuf, portal: leeds.id, body: LEEDS, choice: popup.kind === 'multiple_choice' ? String((popup.options as string[] | undefined)?.[0] || '') : '', share: true, ago: 2 })
  await payload.create({
    collection: 'messages',
    overrideAccess: true,
    data: { body: CIRCLE, author: maryam.id, portal: elm.id } as never,
  })
  const lessonId = Number(popup.lesson)
  const existingWeak = await one(payload, 'engagement-points', { prompt: { equals: WEAK } })
  if (!existingWeak) {
    await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      data: {
        lesson: lessonId,
        second: 12,
        kind: 'question',
        family: 'popup',
        prompt: WEAK,
        triggerType: 'timestamp',
        timing: 'immediate',
        status: 'draft',
        draftNote: 'Imported with the talk.',
        options: [],
      } as never,
    })
  }
  console.log('Feedback demo: sample answers are on the East London and Leeds desks.')
}
