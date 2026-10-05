import { ANSWER_VOICE } from './human-voice'
import { authorTextProblems } from './opening-data'

// Hady Core circle answers: written answers that sit in a question's swarm beside real learners' shared answers, so
// nobody meets an empty "What others said". They live in their own collection and are never counted as answers.

export const CIRCLE_TONES = ['warm', 'honest', 'practical', 'searching', 'quiet'] as const
export const CIRCLE_LENGTHS = ['short', 'medium', 'long'] as const
export type CircleTone = (typeof CIRCLE_TONES)[number]
export type CircleLength = (typeof CIRCLE_LENGTHS)[number]

export const CIRCLE_LABEL_DEFAULT = 'From the Hady Core circle'
export const CIRCLE_THRESHOLD_DEFAULT = 8
export const CIRCLE_MAX_COUNT = 12
/** At most this many circle answers sit in one swarm, however many are switched on. */
export const CIRCLE_MAX_SHOWN = 6
export const CIRCLE_BODY_MAX = 600
export const CIRCLE_NAME_MAX = 40

export const TONE_LABELS: Record<CircleTone, string> = { warm: 'Warm', honest: 'Honest', practical: 'Practical', searching: 'Searching', quiet: 'Quiet' }
export const LENGTH_LABELS: Record<CircleLength, string> = { short: 'Short (a line)', medium: 'Medium (two or three lines)', long: 'Long (a short paragraph)' }

export type CirclePoint = { prompt: string; kind: string; options?: string[]; context?: string }
export type CircleDraft = { name: string; body: string; tone: CircleTone; length: CircleLength }

const NAMES = ['Amina', 'Yusuf', 'Maryam', 'Bilal', 'Hana', 'Idris', 'Safiya', 'Omar', 'Zainab', 'Ibrahim', 'Layla', 'Musa', 'Noor', 'Hamza', 'Sara', 'Tariq', 'Aisha', 'Khalid', 'Ruqayyah', 'Sami']

// Opening lines by tone; middles and endings add length. Kept clear of the kill list ("should", "fix", "struggle"...).
const OPENERS: Record<CircleTone, string[]> = {
  warm: ['Yeah, this one got me.', 'I smiled. Reminded me of home.', 'He put that kindly.', 'Thought of my nan straight away.'],
  honest: ["Honestly, I hadn't thought about this till now.", "I'll be straight. Hard one to answer.", "If I'm honest, I keep putting this off.", 'I nearly skipped this, then came back.'],
  practical: ['Wrote it on a sticky note by the kettle.', 'Set a reminder for after fajr.', 'Tried it on the bus this morning.', 'Picked one small thing. Did it the same day.'],
  searching: ['Still turning this over.', "Haven't got a neat answer.", 'More of a question than an answer, for me.', 'Keep coming back to the words he used.'],
  quiet: ["Slow down. That's it.", 'A small yes.', 'Not much tonight. This stayed, though.', 'Sitting with it.'],
}
const MIDDLES: Record<CircleTone, string[]> = {
  warm: ['Thought of the people who make room for me without being asked.', 'Thought of my mum. She never makes a fuss.'],
  honest: ['Days are full. This is the first thing that slips.', 'I talk about it more than I live it. Caught me out.'],
  practical: ["Two minutes. That's it, so I'll actually do it.", "Tied it to making tea, so I don't forget."],
  searching: ['What does this even look like on a Tuesday?', 'Want to get what he meant before I say more.'],
  quiet: ['Wrote down the line about the heart.', 'Listened to that bit twice on the way to work.'],
}
const ENDINGS: Record<CircleTone, string[]> = {
  warm: ['Hope it stays with me this week.', 'Glad I caught this one.'],
  honest: ["I'll try again tomorrow and see.", "Writing it here so I don't forget I said it."],
  practical: ['Day two went better than day one.', "Small. But it's a start."],
  searching: ["I'll come back after the next bit.", "Maybe I'll only get it by doing it."],
  quiet: ["That's all for now.", 'Ameen.'],
}
const CHOICE_REASONS: Record<CircleTone, string> = {
  warm: 'Kindest way I could read what he said.',
  honest: "Went back and forth. This is the one I'll stand by.",
  practical: "It's the one I can actually do this week.",
  searching: 'Not sure. It matched the bit I replayed.',
  quiet: 'It just fitted.',
}
const TASK_OPENERS: Record<CircleTone, string> = {
  warm: 'Did it with my little brother. Easier that way.',
  honest: 'Missed the first day. Managed the second.',
  practical: "Did it straight after maghrib so it wouldn't slip.",
  searching: 'Tried it once. I was rushing.',
  quiet: 'Done, quietly.',
}

/** A tone and a length for each of `count` answers, spread round-robin over the ones chosen. */
export function circleSpread(count: number, tones: readonly CircleTone[], lengths: readonly CircleLength[]) {
  const toneList = tones.length ? tones : CIRCLE_TONES
  const lengthList = lengths.length ? lengths : CIRCLE_LENGTHS
  return Array.from({ length: Math.max(0, Math.min(CIRCLE_MAX_COUNT, Math.floor(count))) }, (_, index) => ({
    tone: toneList[index % toneList.length],
    length: lengthList[Math.floor(index / toneList.length + index) % lengthList.length],
  }))
}

function pick<T>(items: readonly T[], at: number) {
  return items[((at % items.length) + items.length) % items.length]
}

/** The built-in drafts, used when no AI key is set or the AI reply does not pass the checks. Deterministic per seed. */
export function mockCircleAnswers(point: CirclePoint, count: number, tones: readonly CircleTone[], lengths: readonly CircleLength[], seed = 0): CircleDraft[] {
  const options = (point.options || []).filter(Boolean)
  return circleSpread(count, tones, lengths).map(({ tone, length }, index) => {
    const at = seed + index
    let lead = pick(OPENERS[tone], at)
    if (point.kind === 'multiple_choice' && options.length) lead = `I went with “${pick(options, at)}”. ${CHOICE_REASONS[tone]}`
    else if (point.kind === 'task') lead = TASK_OPENERS[tone]
    const parts = [lead]
    if (length !== 'short') parts.push(pick(MIDDLES[tone], at))
    if (length === 'long') parts.push(pick(ENDINGS[tone], at))
    return { name: pick(NAMES, at * 7 + 3), body: parts.join(' '), tone, length }
  })
}

/** Problems with a circle answer, in the same words as the editor's checks. Empty when it may be shown. */
export function circleProblems(name: string, body: string) {
  const problems = authorTextProblems([
    ['The answer', body],
    ['The name', name],
  ])
  if (!body.trim()) problems.unshift('Write the answer first.')
  if (body.length > CIRCLE_BODY_MAX) problems.push(`Keep the answer under ${CIRCLE_BODY_MAX} characters.`)
  if (name.length > CIRCLE_NAME_MAX) problems.push(`Keep the name under ${CIRCLE_NAME_MAX} characters.`)
  return problems
}

/** Drafts from an AI reply ({"answers":[{"name","text","tone","length"}]}), keeping only those that pass the checks. */
export function parseCircleReply(reply: string, spread: { tone: CircleTone; length: CircleLength }[]): CircleDraft[] {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) return []
  let parsed: { answers?: { name?: unknown; text?: unknown; body?: unknown; tone?: unknown; length?: unknown }[] }
  try {
    parsed = JSON.parse(reply.slice(start, end + 1))
  } catch {
    return []
  }
  const kept: CircleDraft[] = []
  for (const [index, row] of (parsed.answers || []).entries()) {
    const body = String(row.text ?? row.body ?? '').trim()
    const name = String(row.name ?? '').trim().slice(0, CIRCLE_NAME_MAX) || pick(NAMES, index)
    if (circleProblems(name, body).length) continue
    const fallback = spread[index % Math.max(1, spread.length)] || { tone: 'warm', length: 'short' }
    const tone = (CIRCLE_TONES as readonly string[]).includes(String(row.tone)) ? (row.tone as CircleTone) : fallback.tone
    const length = (CIRCLE_LENGTHS as readonly string[]).includes(String(row.length)) ? (row.length as CircleLength) : fallback.length
    kept.push({ name, body, tone, length })
  }
  return kept.slice(0, spread.length)
}

export function circleRequest(point: CirclePoint, spread: { tone: CircleTone; length: CircleLength }[]) {
  const system = [
    'You write short answers that ordinary British Muslim learners might share under a question after watching an Islamic talk. The label on these is From the Hady Core circle.',
    ANSWER_VOICE,
    'No preaching, no clichés, no emojis, no HTML.',
    'Never use these words: should, must, need to, fix, improve, struggle, test, quiz, score, result, level, type, fear, anxiety, anger, pride, gratitude, sometimes, often, rarely.',
    'Lengths: short is one sentence, medium is two sentences, long is three or four. Do not make them the same length.',
    'Return JSON only: {"answers":[{"name":"a first name","tone":"...","length":"...","text":"..."}]}.',
  ].join('\n')
  const lines = [
    `Question (${point.kind}): ${point.prompt}`,
    point.options?.length ? `Choices: ${point.options.join(' | ')}` : '',
    point.context ? `What the speaker says around this moment: ${point.context.slice(0, 1500)}` : '',
    `Write ${spread.length} answers, one for each line below, each from a different person:`,
    ...spread.map((row, index) => `${index + 1}. tone ${row.tone}, length ${row.length}`),
  ]
  return { system, user: lines.filter(Boolean).join('\n') }
}

function hash(text: string) {
  let value = 2166136261
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619)
  return value >>> 0
}

/** How many circle answers a swarm shows: all of them (up to the cap) with no real answers, none at the threshold. */
export function circleShown(available: number, realAnswers: number, threshold = CIRCLE_THRESHOLD_DEFAULT) {
  const cap = Math.min(available, CIRCLE_MAX_SHOWN)
  if (threshold <= 0 || realAnswers >= threshold) return 0
  return Math.min(cap, Math.ceil(cap * (1 - realAnswers / threshold)))
}

/**
 * The circle answers one learner sees beside `real` shared answers, mixed in among them. Which ones, and where they sit,
 * are fixed per learner and question, so a reload does not reshuffle the list, while different learners see different ones.
 */
export function mixSwarm<R, C>(real: R[], circle: C[], seed: string, threshold = CIRCLE_THRESHOLD_DEFAULT): (R | C)[] {
  const shown = circleShown(circle.length, real.length, threshold)
  const ranked = circle.map((item, index) => ({ item, key: hash(`${seed}:${index}`) })).sort((a, b) => a.key - b.key).slice(0, shown)
  const mixed: (R | C)[] = [...real]
  for (const [index, row] of ranked.entries()) {
    const slot = real.length ? (hash(`${seed}:slot:${index}`) % (mixed.length + 1)) : mixed.length
    mixed.splice(slot, 0, row.item)
  }
  return mixed
}
