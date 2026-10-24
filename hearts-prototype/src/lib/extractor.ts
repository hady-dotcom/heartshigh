import { doorCode, doorNumberOfClause } from './doors'
import { cuesToSentences, formatTimestamp, looksUnpunctuated, parseTranscript, type Sentence } from './transcript'

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
  { clause: 13, phrases: [/condition of ease/i, /tell me about islam/i, /not committing a sin/i, /rules and regulations/i, /classified/i], why: 'Islam is named as a set of acts, and ease is how you approach them while the acts themselves remain.' },
  { clause: 15, phrases: [/fajr/i, /the prayer/i, /salat|salah/i, /qibla/i], why: 'The line is doing the work of establishing the prayer.' },
  { clause: 22, phrases: [/believe in allah/i, /who allah is/i, /ar-?rabb/i, /\brabb\b/i, /you don't tell god/i, /god tells you/i, /al-?nur/i, /source of (all )?light/i], why: 'The line is about who Allah is, which is the heart of belief in Allah.' },
  { clause: 24, phrases: [/qur'?an/i, /the book/i, /ayah|verse/i], why: 'It treats revelation as something to be received, which is the books clause.' },
  { clause: 25, phrases: [/his messengers/i, /moses/i, /never uptight/i, /messengers/i], why: 'A messengerly pattern: truth without harshness, or the story of a messenger.' },
  { clause: 26, phrases: [/day of judgment/i, /last day/i, /akhira/i, /light on the day/i], why: 'Last things stay inside iman. The line is about the Last Day itself.' },
  { clause: 29, phrases: [/ihsan/i, /\bnafs\b/i, /bullied into devotion/i, /lower self/i, /excellence/i], why: 'Ihsan here is lived, and the lower self is not allowed to rename itself as ease.' },
  { clause: 30, phrases: [/as though you see/i, /worship/i, /become the light/i, /make me nur/i], why: 'The act is done as seeing, or as becoming light for someone else.' },
  { clause: 31, phrases: [/he sees you/i, /easygoing/i, /approachable/i, /when nobody is watching/i], why: 'Character under being seen: the disposition that remains when praise is absent.' },
  { clause: 34, phrases: [/marriage/i, /household/i, /best of marriages/i], why: 'The household seat under the Hour, about how a home is lived.' },
  { clause: 41, phrases: [/your religion/i, /conceive of religion/i, /language of hardship/i, /teach you your religion/i], why: 'The trunk: the kind of religion that was being taught.' },
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
  if (/\b(you're like|he's like|she's like|i'm like|yo\b|subhanallah\.?$)/i.test(sentence.text)) score -= 4
  if (/^(he|she|they) (said|says|goes)\b/i.test(sentence.text) || /^[A-Z][a-z]+ (said|says),/.test(sentence.text)) score -= 2
  if (/^(mikael|mikaeel),/i.test(sentence.text)) score -= 5
  if (repeated) score += 2
  if (plantedHit) score += 3
  if (/semi-truck|easygoing|bullied into devotion|bring ease|day of judgment|ar-?rabb/i.test(sentence.text)) score += 2
  return { device, score }
}

function windowFor(sentences: Sentence[], landIndex: number) {
  const land = sentences[landIndex]
  const targetStart = Math.max(0, land.cueEnd - 175)
  let startIndex = landIndex
  for (let index = landIndex; index >= 0; index--) {
    startIndex = index
    if (sentences[index].cueStart <= targetStart) break
  }
  const opener = (sentence: Sentence) =>
    sentence.complete && !/^(and|but|so|because|that|which|or|then|like)\b/i.test(sentence.text) && /^[A-Z"“']/.test(sentence.text)
  while (startIndex < landIndex && !opener(sentences[startIndex])) startIndex += 1
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

export function transcriptConfidence(raw: string, parsed: { timed: boolean; estimated: boolean }): ExtractCut['quoteConfidence'] {
  if (!parsed.timed || parsed.estimated) return 'low'
  if (/recovery|verify quotes|ocr/i.test(raw.slice(0, 800))) return 'medium'
  return 'high'
}

export function dualExtract(raw: string, clauses: ClauseCard[] = []): ExtractResult {
  const parsed = parseTranscript(raw)
  const notes: string[] = []
  if (!parsed.cues.length) {
    return { thesis: '', cuts: [], ladder: [], engine: 'deterministic', notes: ['No speech found in the transcript.'] }
  }
  if (!parsed.timed) notes.push('No timestamps were found. Times are estimated and confidence is low.')
  if (parsed.estimated) notes.push('The file says its timestamps are estimated. Check the audio before you use a cut.')

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
    .filter((row) => row.device && row.score >= 5 && row.sentence.complete && row.sentence.text.split(/\s+/).length >= 7)
    .sort((a, b) => b.score - a.score)

  const chosen: typeof ranked = []
  for (const row of ranked) {
    const overlaps = chosen.some((other) => Math.abs(other.sentence.cueEnd - row.sentence.cueEnd) < 100)
    if (overlaps) continue
    chosen.push(row)
    if (chosen.length >= 14) break
  }
  chosen.sort((a, b) => a.sentence.start - b.sentence.start)

  const confidence = transcriptConfidence(raw, parsed)
  const cuts: ExtractCut[] = []
  for (const row of chosen) {
    const window = windowFor(sentences, row.index)
    const slice = sentences.slice(window.startIndex, window.endIndex + 1)
    const hookSentence = slice[0]
    const landSentence = slice[slice.length - 1]
    const middle = slice.slice(1, -1).filter((sentence) => sentence.complete)
    const turnSentence =
      middle.find((sentence) => deviceOf(sentence, false) === 'contrast' || /\b(but|however|rather|instead|and then)\b/i.test(sentence.text)) ||
      middle[Math.floor(middle.length / 2)] ||
      null
    const start = hookSentence.cueStart
    const end = Math.max(landSentence.cueEnd, start + 1)
    const duration = end - start
    const landAt = slice.length - 1
    const context = slice
      .slice(Math.max(0, landAt - 3), landAt + 1)
      .map((sentence) => sentence.text)
      .join(' ')
    const hang = hangFor(`${hookSentence.text} ${turnSentence?.text || ''} ${landSentence.text}`, clauses)
    if (duration < 60 || cuts.some((cut) => cut.start === start || cut.hook === hookSentence.text)) continue
    const gateA = Boolean(turnSentence) && hookSentence.text !== landSentence.text
    const gateB = hang.hangStrength === 'strong' || hang.hangStrength === 'medium'
    let kind: ExtractCut['kind'] | null = null
    if (gateA && gateB) kind = 'dual'
    else if (gateA) kind = 'allure-only'
    else if (gateB) kind = 'curriculum-extra'
    if (!kind || !turnSentence) continue
    cuts.push({
      id: `C${String(cuts.length + 1).padStart(2, '0')}`,
      start,
      end,
      timestamp: formatTimestamp(landSentence.cueStart),
      endTimestamp: formatTimestamp(landSentence.cueEnd),
      hook: hookSentence.text,
      turn: turnSentence.text,
      land: landSentence.text,
      verbatimQuote: landSentence.text,
      fullContext: context,
      theme: pickTheme(`${turnSentence.text} ${landSentence.text}`, row.device!),
      device: row.device!,
      whyItAllures:
        row.device === 'repeated_thesis'
          ? 'The speaker comes back to this line more than once, so a newcomer can feel the point without the whole hour.'
          : 'Someone hearing it cold can follow it: it opens, shifts, and lands in under three minutes.',
      bestClause: hang.bestClause,
      clauseFragment: hang.fragment,
      hangStrength: hang.hangStrength,
      whyHang: hang.whyHang,
      seatHint: hang.bestClause ? 'Seat follows the clause card. Choose it when you confirm the tag.' : 'seat TBD, teacher brief',
      stage2Form: stageForm(duration),
      currencyNote: hang.bestClause
        ? `Counts towards a chapter night in door ${doorCode(doorNumberOfClause(hang.bestClause) || 0)} (clause ${hang.bestClause}). No score and no lock.`
        : 'A short clip only. It does not count towards the course.',
      quoteConfidence: confidence,
      exemplarAffinity: row.repeated ? 'high: a repeated line, close to the loved-line pattern' : 'medium: a complete line that works cold',
      kind,
    })
  }

  const thesis = cuts.find((cut) => cut.device === 'repeated_thesis')?.land || cuts[0]?.land || ''
  const unpunctuated = looksUnpunctuated(parsed.cues)
  if (unpunctuated && cuts.length) {
    notes.push('These captions have no full stops. Clips were grouped by pauses and by length. Read them before you approve.')
  }
  if (!cuts.length) {
    notes.push(
      unpunctuated
        ? 'No clips were found. These captions have no full stops, so the extractor grouped them by pauses and still found no hook, turn and landing. Add punctuation, or upload a punctuated transcript, then run the extractor again.'
        : 'No clips were found. The extractor looks for a hook, a turn and a landing line of at least a minute. Check the transcript, then run it again.',
    )
  }
  return { thesis, cuts, ladder: ladderFrom(cuts, sentences), engine: 'deterministic', notes }
}

/** Approved clips stay when the extractor runs again. Drafts and set-aside rows are replaced. */
export function rowsKeptOnExtract<T extends { status?: string | null }>(rows: T[]) {
  return {
    keep: rows.filter((row) => row.status === 'approved'),
    drop: rows.filter((row) => row.status !== 'approved'),
  }
}

/** Drop a new draft whose start and end match a clip that is already approved. Approving both would show the same moment twice. */
export function draftsSkippingApproved<T extends { start: number; end: number }>(drafts: T[], approved: { start: number; end: number }[]) {
  const taken = new Set(approved.map((row) => `${Math.round(Number(row.start))}-${Math.round(Number(row.end))}`))
  return drafts.filter((row) => !taken.has(`${Math.round(Number(row.start))}-${Math.round(Number(row.end))}`))
}

/**
 * Hors d'oeuvre: 15 to 20 seconds from the start of the line the land sits in, moved back if it would run past the
 * appetiser, so it always plays inside it.
 * Appetiser: 30 seconds to 3 minutes, from the turn's line to the end of the land's line.
 * Both carry the land line as their caption, word for word.
 */
export function ladderFrom(cuts: ExtractCut[], sentences: Sentence[]): LadderItem[] {
  const items: LadderItem[] = []
  for (const cut of cuts) {
    const land = sentences.find((sentence) => sentence.text === cut.land && sentence.cueEnd === cut.end) || sentences.find((sentence) => sentence.text === cut.land)
    const turn = sentences.find((sentence) => sentence.text === cut.turn && sentence.cueStart >= cut.start)
    const landStart = land?.cueStart ?? Math.max(cut.start, cut.end - 20)
    const horsLength = Math.min(20, Math.max(15, (land?.cueEnd ?? landStart + 15) - landStart))
    const appetiserStart = Math.min(turn?.cueStart ?? cut.start, Math.max(cut.start, cut.end - 30), landStart)
    const appetiserEnd = Math.min(appetiserStart + 180, Math.max(appetiserStart + 30, cut.end))
    const horsStart = Math.max(appetiserStart, Math.min(landStart, appetiserEnd - horsLength))
    items.push({ kind: 'hors', start: horsStart, end: Math.min(appetiserEnd, horsStart + horsLength), quote: cut.land, cutId: cut.id })
    items.push({ kind: 'appetiser', start: appetiserStart, end: appetiserEnd, quote: cut.land, cutId: cut.id })
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
