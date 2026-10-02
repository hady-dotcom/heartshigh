import { cuesToSentences, formatTimestamp, parseTranscript, type Sentence } from './transcript'

export type ClauseCard = {
  number: number
  fragment: string
  core: string
  teaching: string
}

export type ExtractCut = {
  id: string
  start: number
  end: number
  timestamp: string
  endTimestamp: string
  hook: string
  turn: string
  land: string
  verbatimQuote: string
  fullContext: string
  theme: string
  device: Device
  whyItAllures: string
  bestClause: number | null
  clauseFragment: string
  hangStrength: 'strong' | 'medium' | 'stretch' | 'no_clean_hang'
  whyHang: string
  seatHint: string
  stage2Form: string
  currencyNote: string
  quoteConfidence: 'high' | 'medium' | 'low'
  exemplarAffinity: string
  kind: 'dual' | 'allure-only' | 'curriculum-extra'
}

export type LadderItem = {
  kind: 'hors' | 'appetiser'
  start: number
  end: number
  quote: string
  cutId: string
}

export type ExtractResult = {
  thesis: string
  cuts: ExtractCut[]
  ladder: LadderItem[]
  engine: 'deterministic' | 'llm'
  notes: string[]
}

type Device =
  | 'repeated_thesis'
  | 'verse_application'
  | 'contrast'
  | 'puzzle_solution'
  | 'story_turn'
  | 'qa'

const DEVICE_WEIGHT: Record<Device, number> = {
  repeated_thesis: 5,
  verse_application: 4,
  contrast: 4,
  puzzle_solution: 3.5,
  story_turn: 3,
  qa: 2.5,
}

const HANGS: { clause: number; phrases: RegExp[]; why: string }[] = [
  { clause: 2, phrases: [/we were sitting/i, /gathered/i, /company here/i, /rite/i], why: 'The line is about the circle itself, the we of the sitting.' },
  { clause: 3, phrases: [/messenger/i, /bring ease/i, /commissioned/i, /salawat/i, /like the prophet/i], why: 'It hangs on being with the Messenger, and on the ease he was sent with.' },
  { clause: 4, phrases: [/appeared/i, /stranger/i, /walk-?in/i, /semi-truck/i, /newcomer/i, /coming into/i, /sent her/i], why: 'The teaching is how a circle receives the one who just appeared.' },
  { clause: 6, phrases: [/overlooked/i, /full attention/i, /easygoing person you pass/i], why: 'Character here is how you attend to someone who is easy to miss.' },
  { clause: 13, phrases: [/condition of ease/i, /tell me about islam/i, /not committing a sin/i, /rules and regulations/i, /classified/i], why: 'Islam is named as classified acts, and ease is the spirit of approach, not the erasure of them.' },
  { clause: 15, phrases: [/fajr/i, /the prayer/i, /salat|salah/i, /qibla/i], why: 'The line is doing the work of establishing the prayer.' },
  { clause: 22, phrases: [/believe in allah/i, /who allah is/i, /ar-?rabb/i, /\brabb\b/i, /you don't tell god/i, /god tells you/i, /al-?nur/i, /source of (all )?light/i], why: 'The line is about who Allah is, not a side remark that happens to say the name.' },
  { clause: 24, phrases: [/qur'?an/i, /the book/i, /ayah|verse/i], why: 'It treats revelation as something to be received, which is the books clause.' },
  { clause: 25, phrases: [/his messengers/i, /moses/i, /never uptight/i, /messengers/i], why: 'A messengerly pattern: truth without harshness, or the story of a messenger.' },
  { clause: 26, phrases: [/day of judgment/i, /last day/i, /akhira/i, /light on the day/i], why: 'Last things stay inside iman. The line is about that day, not a date for the Hour.' },
  { clause: 29, phrases: [/ihsan/i, /\bnafs\b/i, /bullied into devotion/i, /lower self/i, /excellence/i], why: 'Ihsan here is lived, and the lower self is not allowed to rename itself as ease.' },
  { clause: 30, phrases: [/as though you see/i, /worship/i, /become the light/i, /make me nur/i], why: 'The act is done as seeing, or as becoming light for someone else.' },
  { clause: 31, phrases: [/he sees you/i, /easygoing/i, /approachable/i, /when nobody is watching/i], why: 'Character under being seen: the disposition that remains when praise is absent.' },
  { clause: 34, phrases: [/marriage/i, /household/i, /best of marriages/i], why: 'The household seat under the Hour, not a signs checklist.' },
  { clause: 41, phrases: [/your religion/i, /conceive of religion/i, /language of hardship/i, /teach you your religion/i], why: 'The trunk: what kind of religion was being taught, not a dump of later volumes.' },
]

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word))
}

const STOP = new Set('the and that this with from your you are was were for have has had not but they them his her she its our out about into just like what when there then than been being would could should really very gonna going know mean means said says say'.split(' '))

function deviceOf(sentence: Sentence, repeated: boolean): Device | null {
  const text = sentence.text
  if (repeated) return 'repeated_thesis'
  if (/allah says|qur'?an says|the verse|he recited|allah subhanahu/i.test(text) && words(text).length > 8) return 'verse_application'
  if (/\?/.test(text) && /because|so |that is|it means|the answer|means that/i.test(text)) return 'puzzle_solution'
  if (/never|don't|do not|not what|rather|but the|isn't|is not|no one who/i.test(text)) return 'contrast'
  if (/she said|he said|one day|story|walked in|sent her|let me tell/i.test(text)) return 'story_turn'
  if (/question from|someone asked|they asked/i.test(text)) return 'qa'
  return null
}

function repetitionMap(sentences: Sentence[]) {
  const counts = new Map<string, number>()
  for (const sentence of sentences) {
    const key = words(sentence.text).slice(0, 8).join(' ')
    if (key.split(' ').length < 5) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

function plantedTokens(sentences: Sentence[]) {
  const counts = new Map<string, number>()
  for (const sentence of sentences) {
    const seen = new Set(words(sentence.text).filter((word) => word.length >= 4))
    for (const word of seen) counts.set(word, (counts.get(word) || 0) + 1)
  }
  const planted = new Set<string>()
  for (const [word, count] of counts) {
    if (count >= 4 && word.length >= 5) planted.add(word)
    if (count >= 6 && word.length >= 4) planted.add(word)
  }
  return planted
}

function scoreSentence(sentence: Sentence, repeated: boolean, planted: Set<string>) {
  let device = deviceOf(sentence, repeated)
  const plantedHit = words(sentence.text).some((word) => planted.has(word))
  if (!device && plantedHit) device = 'repeated_thesis'
  if (!device) return { device: null as Device | null, score: 0 }
  const count = sentence.text.split(/\s+/).length
  let score = DEVICE_WEIGHT[device]
  if (count >= 8 && count <= 32) score += 2
  else if (count < 6 || count > 40) score -= 2
  if (/^(as i|so anyway|as i was|like i said|you know,)/i.test(sentence.text)) score -= 4
  if (repeated) score += 2
  if (plantedHit) score += 3
  if (/semi-truck|easygoing|bullied into devotion|bring ease|day of judgment|ar-?rabb/i.test(sentence.text)) score += 2
  return { device, score }
}

function windowFor(sentences: Sentence[], landIndex: number) {
  const land = sentences[landIndex]
  const targetStart = Math.max(0, land.end - 170)
  let startIndex = landIndex
  for (let index = landIndex; index >= 0; index--) {
    if (sentences[index].start <= targetStart) {
      startIndex = index
      break
    }
    startIndex = index
  }
  while (startIndex < landIndex && /^(and|but|so|because|that|which)\b/i.test(sentences[startIndex].text)) {
    startIndex += 1
  }
  return { startIndex, endIndex: landIndex }
}

function pickTheme(text: string, device: Device) {
  if (/ease|harsh|nafs|easygoing|hardship/i.test(text)) return 'Ease and harshness in the deen'
  if (/nur|light|heart/i.test(text)) return 'Light and the heart'
  if (/rabb|nurtur|lord/i.test(text)) return 'Who your Lord is'
  if (/prayer|salah|fajr/i.test(text)) return 'Prayer'
  if (/marriage|household/i.test(text)) return 'The household'
  if (/prophet|messenger/i.test(text)) return 'Prophetic manners'
  if (device === 'story_turn') return 'A story turning'
  return 'A living idea'
}

function hangFor(text: string, clauses: ClauseCard[]) {
  let best: { clause: number; hits: number; why: string } | null = null
  for (const row of HANGS) {
    const hits = row.phrases.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0)
    if (hits > 0 && (!best || hits > best.hits)) best = { clause: row.clause, hits, why: row.why }
  }
  if (!best) {
    return {
      bestClause: null as number | null,
      fragment: '',
      hangStrength: 'no_clean_hang' as const,
      whyHang: 'No clause teaching honestly claims this line. Left without a course hang.',
    }
  }
  const card = clauses.find((clause) => clause.number === best!.clause)
  const strength = best.hits >= 2 ? 'strong' : 'medium'
  return {
    bestClause: best.clause,
    fragment: card?.fragment || '',
    hangStrength: strength as 'strong' | 'medium',
    whyHang: best.why,
  }
}

function stageForm(duration: number) {
  if (duration < 70) return 'C2 crumb'
  if (duration < 120) return 'constellation bit'
  if (duration < 180) return 'mid sit'
  return 'long sit bait'
}

export function dualExtract(raw: string, clauses: ClauseCard[] = []): ExtractResult {
  const parsed = parseTranscript(raw)
  const notes: string[] = []
  if (!parsed.cues.length) {
    return {
      thesis: '',
      cuts: [],
      ladder: [],
      engine: 'deterministic',
      notes: ['No speech found in the transcript.'],
    }
  }
  if (!parsed.timed) notes.push('No timestamps were found. Times are estimated and confidence is low.')
  if (parsed.estimated) notes.push('Timestamps are estimated or recovered. Check the audio before you ship a cut.')

  const sentences = cuesToSentences(parsed.cues)
  const counts = repetitionMap(sentences)
  const planted = plantedTokens(sentences)
  const ranked = sentences
    .map((sentence, index) => {
      const key = words(sentence.text).slice(0, 8).join(' ')
      const repeated = (counts.get(key) || 0) >= 2
      const scored = scoreSentence(sentence, repeated, planted)
      return { index, sentence, ...scored, repeated }
    })
    .filter((row) => row.device && row.score >= 3)
    .sort((a, b) => b.score - a.score)

  const chosen: typeof ranked = []
  for (const row of ranked) {
    const landEnd = row.sentence.end
    const overlaps = chosen.some((other) => Math.abs(other.sentence.end - landEnd) < 100)
    if (overlaps) continue
    chosen.push(row)
    if (chosen.length >= 12) break
  }
  chosen.sort((a, b) => a.sentence.start - b.sentence.start)

  const confidence: ExtractCut['quoteConfidence'] = !parsed.timed || parsed.estimated ? 'low' : 'high'
  const cuts: ExtractCut[] = chosen.map((row, ordinal) => {
    const window = windowFor(sentences, row.index)
    const slice = sentences.slice(window.startIndex, window.endIndex + 1)
    const hookSentence = slice[0]
    const landSentence = slice[slice.length - 1]
    const mid = slice[Math.min(slice.length - 1, Math.max(1, Math.floor(slice.length * 0.55)))]
    const turnSentence = mid.text === landSentence.text ? slice[Math.max(0, slice.length - 2)] : mid
    const duration = Math.max(1, landSentence.end - hookSentence.start)
    const context = slice
      .slice(0, 4)
      .map((sentence) => sentence.text)
      .join(' ')
    const hang = hangFor(`${hookSentence.text} ${landSentence.text}`, clauses)
    const gateA = duration >= 20 && hookSentence.text !== landSentence.text
    const gateB = hang.hangStrength === 'strong' || hang.hangStrength === 'medium'
    let kind: ExtractCut['kind'] = 'dual'
    if (gateA && gateB) kind = 'dual'
    else if (gateA) kind = 'allure-only'
    else if (gateB) kind = 'curriculum-extra'
    const theme = pickTheme(landSentence.text, row.device!)
    return {
      id: `C${String(ordinal + 1).padStart(2, '0')}`,
      start: hookSentence.start,
      end: landSentence.end,
      timestamp: formatTimestamp(landSentence.start),
      endTimestamp: formatTimestamp(landSentence.end),
      hook: hookSentence.text,
      turn: turnSentence.text,
      land: landSentence.text,
      verbatimQuote: landSentence.text,
      fullContext: context,
      theme,
      device: row.device!,
      whyItAllures:
        row.device === 'repeated_thesis'
          ? 'The speaker plants this line more than once, so a stranger can feel the point without the hour.'
          : 'A cold listener can hear a complete turn: something opens, shifts, and lands.',
      bestClause: hang.bestClause,
      clauseFragment: hang.fragment,
      hangStrength: hang.hangStrength,
      whyHang: hang.whyHang,
      seatHint: hang.bestClause ? 'Seat hint follows the clause card. Page numbers only where the map already printed them.' : 'seat TBD — teacher brief',
      stage2Form: stageForm(duration),
      currencyNote: hang.bestClause
        ? `Soft-banks a chapter night around clause ${hang.bestClause}, without a score or a lock.`
        : 'An allure crumb only. It does not claim course currency.',
      quoteConfidence: confidence,
      exemplarAffinity: row.repeated ? 'high — repeated thesis, close to the loved-line pattern' : 'medium — a complete cold line, new theme allowed',
      kind,
    }
  })

  const thesis = cuts.find((cut) => cut.device === 'repeated_thesis')?.land || cuts[0]?.land || ''
  const ladder = ladderFrom(cuts)
  return { thesis, cuts, ladder, engine: 'deterministic', notes }
}

function ladderFrom(cuts: ExtractCut[]): LadderItem[] {
  const items: LadderItem[] = []
  for (const cut of cuts.slice(0, 6)) {
    const horsStart = Math.max(cut.start, cut.end - 18)
    items.push({
      kind: 'hors',
      start: horsStart,
      end: Math.max(horsStart + 15, Math.min(cut.end, horsStart + 20)),
      quote: cut.land,
      cutId: cut.id,
    })
    const appetiserStart = Math.max(cut.start, cut.end - 90)
    const appetiserEnd = Math.max(appetiserStart + 30, Math.min(cut.end, appetiserStart + 180))
    items.push({
      kind: 'appetiser',
      start: appetiserStart,
      end: appetiserEnd,
      quote: cut.turn || cut.land,
      cutId: cut.id,
    })
  }
  return items
}

export function youtubeIdFromUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id && /^[\w-]{11}$/.test(id) ? id : null
      }
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0]) && parts[1] && /^[\w-]{11}$/.test(parts[1])) {
        return parts[1]
      }
    }
    return null
  } catch {
    return null
  }
}
