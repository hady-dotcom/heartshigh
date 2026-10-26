/** Parents whose names stand in for shared answers. Real 2021 names are never used. */
export const SWARM_PARENTS = [
  { name: 'Amina Khan', email: 'amina.khan@hady.home', kid: 'my daughter', age: 7, aside: 'Her brother is 4 and copies everything' },
  { name: 'Daniel Okonkwo', email: 'daniel.okonkwo@hady.home', kid: 'my son', age: 11, aside: 'He shares a room with his sister' },
  { name: 'Sophie Brennan', email: 'sophie.brennan@hady.home', kid: 'the twins', age: 6, aside: 'They set each other off' },
  { name: 'Yusuf Rahman', email: 'yusuf.rahman@hady.home', kid: 'my girl', age: 9, aside: 'I am on late shifts this month' },
  { name: 'Leah Morgan', email: 'leah.morgan@hady.home', kid: 'my boy', age: 5, aside: 'We only started in September' },
  { name: 'Omar Farooq', email: 'omar.farooq@hady.home', kid: 'the boys', age: 8, aside: 'The older one is 13 and will not be told' },
  { name: 'Priya Shah', email: 'priya.shah@hady.home', kid: 'my daughter', age: 10, aside: 'She stays at her gran some weeks' },
  { name: 'Tom Gallagher', email: 'tom.gallagher@hady.home', kid: 'my lad', age: 14, aside: 'He wants the door shut' },
] as const

export type SwarmParent = (typeof SWARM_PARENTS)[number]

export type PlannedAnswer = {
  name: string
  email: string
  body: string
  source: 'real' | 'written'
}

const STOP = new Set('the a an of to and or your you how what would with for this that from into about their have been when where which does did are was were will can could should our my we they them then than just very really quite'.split(' '))

export function questionMatchKey(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Same question, or one wording contains the other. The old video number is not used. */
export function questionsMatch(left: string, right: string) {
  const a = questionMatchKey(left)
  const b = questionMatchKey(right)
  if (!a || !b) return false
  if (a === b) return true
  const short = a.length < b.length ? a : b
  const long = a.length < b.length ? b : a
  return short.length >= 48 && long.includes(short)
}

export function isBlankPrompt(prompt: string) {
  const key = questionMatchKey(prompt)
  return !key || key === 'n a' || key === 'na'
}

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}

function anchorOf(prompt: string) {
  const words = String(prompt || '')
    .replace(/\([^)]*\bwords?\b[^)]*\)/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))
  return words.slice(0, 4).join(' ') || 'the film'
}

function tidy(text: string) {
  return text.replace(/\s+/g, ' ').replace(/\s+([?.!,])/g, '$1').trim()
}

type Voice = { anchor: string; kid: string; age: number; aside: string }

const VOICES: ((row: Voice) => string)[] = [
  ({ kid, age, anchor }) => `Asked ${kid} about ${anchor}. At ${age} they mostly shrugged and went back to the tablet.`,
  ({ aside, anchor }) => `${aside}. ${anchor} is going to have to wait until the weekend, if we get one.`,
  ({ anchor }) => `I only caught half of it. The bit on ${anchor} I want to play again.`,
  ({ kid, anchor }) => `${kid} said it was boring. I still think ${anchor} is the bit we actually need.`,
  ({ age, anchor }) => `Gave it about ${age} minutes, which is our usual limit. ${anchor} did not stick.`,
  ({ anchor, aside }) => `Note to self: ${anchor}. ${aside}.`,
  ({ anchor }) => `Not really there yet. We are still stuck on ${anchor} from last week.`,
  ({ kid, anchor }) => `Did this in the car because ${kid} talks more there. ${anchor} came out muddled but at least they talked.`,
  ({ anchor }) => `Wrote ${anchor} on a scrap of paper and stuck it on the fridge. Nobody looked.`,
  ({ kid, age, anchor }) => `${kid} is ${age}. ${anchor} sounds sensible and then the evening falls apart.`,
  ({ anchor }) => `Ok so ${anchor}. I think. Might have missed the point of the film.`,
  ({ aside, anchor }) => `${aside}, so I did not get far with ${anchor}.`,
  ({ kid, anchor }) => `We had a go after tea. ${kid} lasted until ${anchor} came up, then wanted a snack.`,
  ({ anchor }) => `${anchor}? In our house that turns into a row.`,
  ({ kid, anchor }) => `I let ${kid} answer first. They said something about ${anchor} that I had not thought of.`,
  ({ anchor, aside }) => `Short version, ${anchor} is unfinished. ${aside}.`,
  ({ kid, anchor }) => `Tried explaining ${anchor} while I was cooking. ${kid} heard about half.`,
  ({ anchor }) => `Watched it twice. Second time ${anchor} made more sense, still not sure what to do tomorrow.`,
  ({ age, anchor, aside }) => `Our ${age} year old blanked. ${anchor}. ${aside}.`,
  ({ kid, anchor }) => `Put ${anchor} in my notes and forgot until ${kid} asked what we were doing.`,
]

export function writtenAnswer(prompt: string, parent: SwarmParent, salt = 0) {
  const anchor = anchorOf(prompt)
  const voice = VOICES[(hash(`${prompt}|${parent.email}|${salt}`) + salt) % VOICES.length]
  return tidy(voice({ anchor, kid: parent.kid, age: parent.age, aside: parent.aside }))
}

function pickReal(texts: string[], want: number) {
  const unique = [...new Map(texts.map((text) => tidy(text)).filter(Boolean).map((text) => [text.toLowerCase(), text])).values()]
  if (!unique.length || want <= 0) return []
  const byLength = [...unique].sort((a, b) => a.length - b.length)
  const picked: string[] = []
  const push = (text: string) => {
    if (picked.length < want && !picked.includes(text)) picked.push(text)
  }
  push(byLength[0])
  push(byLength[byLength.length - 1])
  const middle = [...unique].sort((a, b) => Math.abs(a.length - 120) - Math.abs(b.length - 120))
  for (const text of middle) push(text)
  return picked
}

/** Four to eight answers. Real 2021 lines come first. Gaps are written in that parent's voice. */
export function planQuestionSwarm(input: { prompt: string; real: { question: string; text: string }[]; parents?: readonly SwarmParent[] }): PlannedAnswer[] {
  if (isBlankPrompt(input.prompt)) return []
  const parents = input.parents?.length ? input.parents : SWARM_PARENTS
  const target = 4 + (hash(questionMatchKey(input.prompt)) % 5)
  const matched = input.real.filter((row) => questionsMatch(input.prompt, row.question)).map((row) => row.text)
  const real = pickReal(matched, Math.min(target, parents.length))
  const start = hash(input.prompt) % parents.length
  const answers: PlannedAnswer[] = []
  const used = new Set<string>()
  for (let index = 0; index < parents.length && answers.length < target; index += 1) {
    const parent = parents[(start + index) % parents.length]
    if (used.has(parent.email)) continue
    const body = index < real.length ? real[index] : writtenAnswer(input.prompt, parent, index)
    if (!body || answers.some((row) => row.body.toLowerCase() === body.toLowerCase())) continue
    used.add(parent.email)
    answers.push({ name: parent.name, email: parent.email, body: body.slice(0, 1800), source: index < real.length ? 'real' : 'written' })
  }
  return answers
}
