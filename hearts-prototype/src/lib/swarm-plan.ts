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

function tidy(text: string) {
  return text.replace(/\s+/g, ' ').replace(/\s+([?.!,])/g, '$1').trim()
}

/** Same letters as a stored answer, so a real 2021 line can be told from a generated one. */
export function keptAnswerKey(text: string) {
  return tidy(text).toLowerCase()
}

export function isRealAnswerBody(body: string, realTexts: readonly string[]) {
  const key = keptAnswerKey(body)
  if (!key) return false
  return realTexts.some((text) => keptAnswerKey(text) === key)
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

/** Real 2021 lines only. Nothing is invented or built from the question's words. */
export function planQuestionSwarm(input: { prompt: string; real: { question: string; text: string }[]; parents?: readonly SwarmParent[] }): PlannedAnswer[] {
  if (isBlankPrompt(input.prompt)) return []
  const parents = input.parents?.length ? input.parents : SWARM_PARENTS
  const matched = input.real.filter((row) => questionsMatch(input.prompt, row.question)).map((row) => row.text)
  const real = pickReal(matched, Math.min(8, parents.length))
  return real.map((body, index) => {
    const parent = parents[index % parents.length]
    return { name: parent.name, email: parent.email, body: body.slice(0, 1800), source: 'real' as const }
  })
}
