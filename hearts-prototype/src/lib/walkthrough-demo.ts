// Pure rules and copy for the hearts-demo afternoon walkthrough seed.
// Existing accounts keep the password they already have. Nothing here wipes a portal.

import { answersForPoint } from './circle-fill'
import { circleProblems, type CircleDraft } from './circle'
import { bannedPhraseHits } from './human-voice'
import { LEARNER_ZONE, dateKeyInZone, weekStrip } from './week'

export const WALKTHROUGH_PORTAL_SLUG = 'hearts-demo'
export const WALKTHROUGH_PORTAL_NAME = 'HEARTS demo'
export const WALKTHROUGH_CODE_LABEL = 'hearts-demo-learner'
export const WALKTHROUGH_CODE_PREFIX = 'HEARTSDE'
export const WALKTHROUGH_PLAN_NAME = 'Walkthrough week'

export const WALKTHROUGH_LEARNER_EMAIL = 'walkthrough@hearts.foundation'
export const WALKTHROUGH_LEARNER_NAME = 'Amina Yusuf'
export const EXISTING_DEMO_LEARNER_EMAIL = 'demo-learner@hearts.foundation'
/** Live production walkthrough account. Never wipe; fill only. Password stays as Leon set it. */
export const AFTERNOON_WALK_EMAIL = 'afternoon.walk.demo+1005@example.com'
export const AFTERNOON_WALK_NAME = 'Afternoon Walk'

export const EXISTING_FILL_EMAILS = [AFTERNOON_WALK_EMAIL, EXISTING_DEMO_LEARNER_EMAIL] as const

/** Printed only when this run creates the walkthrough account. */
export const DEFAULT_WALKTHROUGH_PASSWORD = 'walkthrough-afternoon'

export const WALKTHROUGH_TIME_ZONE = LEARNER_ZONE

export function passwordForNewWalkthrough(isNew: boolean, env: { HEARTS_DEMO_WALKTHROUGH_PASSWORD?: string } = process.env as { HEARTS_DEMO_WALKTHROUGH_PASSWORD?: string }) {
  if (!isNew) return null
  const fromEnv = (env.HEARTS_DEMO_WALKTHROUGH_PASSWORD || '').trim()
  return fromEnv.length >= 12 ? fromEnv : DEFAULT_WALKTHROUGH_PASSWORD
}

/** The walkthrough seed may only write the hearts-demo portal. Production is allowed. */
export function walkthroughDemoGuard(slug: string | null | undefined) {
  if (slug !== WALKTHROUGH_PORTAL_SLUG) return 'The walkthrough seed only writes the hearts-demo portal. Nothing else was touched.'
  return null
}

export type CourseKey = 'ar-rabb' | 'prophet' | 'nur' | 'sheltered' | 'starter'

type CourseNeedle = {
  key: CourseKey
  needles: string[]
  tokens?: string[]
  youtube?: string[]
  complete: boolean
}

/** Key demo talks first, then other starters so the feed and Garden look used. */
export const COURSE_NEEDLES: CourseNeedle[] = [
  { key: 'ar-rabb', complete: true, needles: ['ar-rabb', 'ar rabb', 'names class 19', 'who is truly nurturing'], tokens: ['AR-RABB'], youtube: ['ECaTWkof57E'] },
  { key: 'prophet', complete: true, needles: ['live like the prophet'], tokens: ['FAHMY-S6'], youtube: ['TLCGBj4AlB0'] },
  { key: 'nur', complete: true, needles: ['al-nur', 'an-nur', 'an-nūr', 'names class 20', 'why you feel empty'], tokens: ['AL-NUR'], youtube: ['NIR88RRpat4'] },
  { key: 'sheltered', complete: true, needles: ['divinely sheltered', 'divinely-sheltered', 'divine shelter'] },
  { key: 'starter', complete: true, needles: ['cure for anxiety', 'on mosques, companionship', 'best islamic approach to wealth', 'allah chose you', 'gratitude is the greatest blessing', 'using your time wisely', 'which people receive', 'what is dua', 'prophetic dua', 'o allah, i am your servant'] },
]

export function foldTitle(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim()
}

export function matchCourseKey(input: { title?: string | null; importToken?: string | null; youtubeId?: string | null }): CourseKey | null {
  const title = foldTitle(String(input.title || ''))
  const token = String(input.importToken || '').trim().toUpperCase()
  const youtube = String(input.youtubeId || '').trim()
  for (const row of COURSE_NEEDLES) {
    if (token && row.tokens?.includes(token)) return row.key
    if (youtube && row.youtube?.includes(youtube)) return row.key
    if (row.needles.some((needle) => title.includes(foldTitle(needle)))) return row.key
  }
  return null
}

export function isKeyDemoCourse(key: CourseKey | null) {
  return key === 'ar-rabb' || key === 'prophet' || key === 'nur' || key === 'sheltered'
}

/** Multi-part courses already on Afternoon Walk, such as Prophetic Duas 4/7. Finish every part. */
export function isFullSeriesTitle(title: string) {
  const folded = foldTitle(title)
  return folded.includes('prophetic dua') || folded.includes('divinely shelter')
}

export function finishEveryLesson(key: CourseKey | null, courseTitle: string, lessonTitle: string) {
  return isKeyDemoCourse(key) || isFullSeriesTitle(`${courseTitle} ${lessonTitle}`)
}

/** Opening taps for Amina. Private rows stay private. */
export const WALKTHROUGH_OPENING: { sceneKey: string; optionKey: string }[] = [
  { sceneKey: 'extra', optionKey: 'pause' },
  { sceneKey: 'queue', optionKey: 'let-go' },
  { sceneKey: 'thumb', optionKey: 'talk' },
  { sceneKey: 'visitor', optionKey: 'wudu' },
  { sceneKey: 'news', optionKey: 'family' },
  { sceneKey: 'doors', optionKey: 'close' },
]

export const WALKTHROUGH_STARTING_CLAUSE = 22

export type RitualDraft = { note: string }

export const WALKTHROUGH_RITUALS: RitualDraft[] = [
  { note: 'Held the door for the woman with the pram at Lidl.' },
  { note: 'Texted Mum after maghrib instead of opening the phone.' },
  { note: 'Said salaam to the neighbour at number 14. I usually walk past.' },
  { note: 'Left the last biscuit. My brother did not notice.' },
  { note: 'Put the phone in the kitchen before I sat down with the talk.' },
  { note: 'Made tea for the man on the till who looked done in.' },
  { note: 'Sat in the car for a minute before I went in, like Dad used to.' },
  { note: 'Put a glass of water out for the next person after taraweeh.' },
]

export type LearnerAnswerDraft = {
  prompt?: string
  body: string
  choice?: string
  keepPrivate: boolean
  shareWithTeacher: boolean
  shareWithLearners: boolean
}

/**
 * Amina's own workbook answers. Private ones stay off the swarm.
 * These are learner words, not circle copy, so they may use ordinary speech.
 */
export const WALKTHROUGH_LEARNER_ANSWERS: LearnerAnswerDraft[] = [
  {
    prompt: 'Which one manner of the Prophet would you like to carry with you this week?',
    body: 'The greeting. I walked past the man at number 14 twice this week and said nothing. Tomorrow I will stop.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    prompt: "What is one thing you have that you could see as Allah's rather than yours?",
    body: 'The spare room. I keep calling it mine. We only rent it. The light in the morning is the bit I did not pay for.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    prompt: 'What does the Shaykh say is the first sign that light is entering the heart?',
    body: '',
    choice: 'You start to incline towards the Akhira',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    prompt: 'When did you last feel the change that comes in Ramadan? What did it feel like?',
    body: 'Last year, the last ten nights. The kids were asleep and I sat on the stairs with a glass of water. I did not want Fajr to come yet.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    prompt: 'Call on Allah by the name Al-Nur once a day this week. Note one moment it changed how you saw something.',
    body: 'Missed Monday. Did Tuesday after maghrib, washing up. The tap was loud and I still said it. The pile of plates looked like a pile of plates, not a verdict.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: false,
  },
  {
    body: 'I have not told anyone this. On the 47 I was short with a woman who had a pram. I keep seeing her face when the talk mentions kindness.',
    keepPrivate: true,
    shareWithTeacher: false,
    shareWithLearners: false,
  },
  {
    body: 'Wrote it on the back of a receipt and left it in the kitchen. That is as far as I got today.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    body: 'Thought of Dad while he was talking. He used to sit in the car for a minute before coming in. I do that now.',
    keepPrivate: false,
    shareWithTeacher: false,
    shareWithLearners: true,
  },
  {
    body: 'The bit about the morning. I treat those hours as mine to spend. They are not.',
    keepPrivate: true,
    shareWithTeacher: false,
    shareWithLearners: false,
  },
  {
    body: 'Tried it once before work, at the lights. The grey street was the same street. I noticed the tree by the station.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    body: 'My sister rang and I nearly rushed her off. I waited. She was only telling me about the baby’s cough.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: false,
  },
  {
    body: 'Iftar at my aunt’s last Ramadan. Everyone was hungry and still kind. That is the bit I carry.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    body: 'Not for the swarm. I still get tight in the chest on Sunday nights. This talk did not take that away. It named it.',
    keepPrivate: true,
    shareWithTeacher: false,
    shareWithLearners: false,
  },
  {
    body: 'Smiling first. At the shop this morning the man on the till looked tired, so I smiled before I asked for the bread.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
  {
    body: 'Sending salawat after Fajr, before I pick up the phone. I managed three days. Thursday I forgot.',
    keepPrivate: false,
    shareWithTeacher: false,
    shareWithLearners: true,
  },
  {
    body: 'These two hands. I was washing up and it landed. I did not make them.',
    keepPrivate: false,
    shareWithTeacher: true,
    shareWithLearners: true,
  },
]

/** Extra circle voices for the demo portal only. First names; the swarm shows initials. */
export const WALKTHROUGH_CIRCLE_EXTRAS: CircleDraft[] = [
  { name: 'Ruqayyah', tone: 'honest', length: 'short', body: 'I walked past the corner shop twice and said nothing. Tomorrow I will stop.' },
  { name: 'Bilal', tone: 'practical', length: 'medium', body: 'Wrote it on a receipt and left it by the kettle. Tried it once before work. That is as far as I got.' },
  { name: 'Hana', tone: 'quiet', length: 'short', body: 'Sat with this after maghrib. The house was finally still.' },
  { name: 'Omar', tone: 'warm', length: 'medium', body: 'Thought of my dad in the car, waiting a minute before he came in. I do that now.' },
  { name: 'Safiya', tone: 'searching', length: 'long', body: 'Still turning this over. On the 47 I had a half answer, then I lost it at my stop. I will listen to that minute again tomorrow.' },
  { name: 'Idris', tone: 'practical', length: 'short', body: 'Set a reminder for after fajr. Did it once. Phone stayed in the kitchen.' },
  { name: 'Layla', tone: 'warm', length: 'medium', body: 'Iftar at my aunt’s. Everyone was hungry and still kind. That is the bit I remember.' },
  { name: 'Hamza', tone: 'honest', length: 'medium', body: 'I nearly skipped this. Then I thought of last Ramadan. I was still late for things, and the month still felt different.' },
]

function foldPrompt(text: string) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}

export function learnerAnswerForPoint(prompt: string, index: number): LearnerAnswerDraft {
  const wanted = foldPrompt(prompt)
  const exact = WALKTHROUGH_LEARNER_ANSWERS.find((row) => row.prompt && foldPrompt(row.prompt) === wanted)
  if (exact) return exact
  const fallbacks = WALKTHROUGH_LEARNER_ANSWERS.filter((row) => !row.prompt)
  return fallbacks[index % fallbacks.length]
}

export function circleDraftsForPoint(point: { prompt: string; kind: string; options?: string[] }): CircleDraft[] {
  const written = answersForPoint(point)
  const extras = WALKTHROUGH_CIRCLE_EXTRAS.slice(0, 3)
  const names = new Set(written.map((row) => row.name))
  const extra = extras.filter((row) => !names.has(row.name))
  return [...written, ...extra].slice(0, 8)
}

export type WeekLesson = { id: number; title: string }

/** A few sittings on this week so My week is not an empty strip. */
export function walkthroughWeekSlots(now: Date, lessons: WeekLesson[], zone = WALKTHROUGH_TIME_ZONE) {
  const days = weekStrip(now, zone)
  const todayIndex = days.findIndex((day) => day.today)
  const picks = lessons.slice(0, 4)
  const offsets = [0, 1, 2, 4]
  return picks.map((lesson, index) => {
    const day = days[Math.min(days.length - 1, Math.max(0, todayIndex + (offsets[index] ?? index)))]
    return { date: day?.key || dateKeyInZone(now, zone), lessonId: lesson.id, title: lesson.title }
  }).filter((slot) => slot.date)
}

export function walkthroughVoiceProblems() {
  const problems: string[] = []
  for (const row of [...WALKTHROUGH_LEARNER_ANSWERS, ...WALKTHROUGH_RITUALS.map((ritual) => ({ body: ritual.note }))]) {
    const banned = bannedPhraseHits(row.body || '')
    if (banned.length) problems.push(`Walkthrough copy uses a stock phrase: ${banned.join(', ')}.`)
  }
  for (const draft of WALKTHROUGH_CIRCLE_EXTRAS) {
    const circle = circleProblems(draft.name, draft.body)
    if (circle.length) problems.push(`${draft.name}: ${circle.join(' ')}`)
    if (!draft.body.trim().endsWith('.') && !draft.body.trim().endsWith('?')) problems.push(`${draft.name} is missing a full stop.`)
    const banned = bannedPhraseHits(draft.body)
    if (banned.length) problems.push(`${draft.name} uses a stock phrase: ${banned.join(', ')}.`)
  }
  return problems
}
