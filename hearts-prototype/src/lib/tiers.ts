// Three tiers per talk: the hors d'oeuvre (15 to 20 seconds), the appetiser (up to about 3 minutes, hook, turn and
// land) and the main (the whole talk from 0:00, with pop-ups). Drafts come from the transcript in "line mode": the
// captions are cut into short spoken lines, and every quote is one of those lines, word for word. A person still has
// to check each draft before it counts as checked.
import { formatTimestamp, type Cue } from './transcript'

export const HORS_MIN = 15
export const HORS_MAX = 20
export const APPETISER_MAX = 180
export const DRAFT_NOTE = 'Draft, needs a human check. Times and lines come from the captions by machine.'

type Word = { at: number; text: string }

function stamp(token: string) {
  const match = token.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/)
  if (!match) return null
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number((match[4] || '0').padEnd(3, '0')) / 1000
}

const MARKER = /^(\[[^\]]*\]|>>|-)$/

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'" }
const decode = (text: string) => text.replace(/&(nbsp|amp|quot|apos|lt|gt|#39);/g, (_, name: string) => ENTITIES[name])

function wordsOfLine(line: string, start: number, end: number, rolling: boolean): Word[] {
  if (rolling && line.includes('<')) {
    const out: Word[] = []
    let at = start
    for (const part of line.split(/(<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>)/)) {
      const tag = part.match(/^<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})>$/)
      if (tag) {
        at = stamp(tag[1]) ?? at
        continue
      }
      for (const word of decode(part.replace(/<\/?c[^>]*>/g, '')).split(/\s+/).filter(Boolean)) out.push({ at, text: word })
    }
    return out
  }
  const tokens = decode(line.replace(/<[^>]+>/g, '')).split(/\s+/).filter(Boolean)
  return tokens.map((text, index) => ({ at: start + ((end - start) * index) / Math.max(1, tokens.length), text }))
}

/** Every spoken word with the moment it starts, from a YouTube caption file (rolling auto captions or plain cues). */
export function wordTimeline(raw: string): Word[] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const rolling = /<c>/.test(text)
  const blocks: { start: number; end: number; lines: string[] }[] = []
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const arrow = lines.findIndex((line) => line.includes('-->'))
    if (arrow === -1) continue
    const [startRaw, endRaw] = lines[arrow].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const start = stamp(startRaw)
    const end = stamp(endRaw)
    if (start === null || end === null) continue
    const spoken = lines.slice(arrow + 1).map((line) => line.trim()).filter(Boolean)
    if (!spoken.length) continue
    // Rolling captions repeat the previous line above the new one, and flash each line for 10 ms when it scrolls.
    if (rolling && end - start < 0.05) continue
    blocks.push({ start, end, lines: rolling ? [spoken[spoken.length - 1]] : spoken })
  }
  // Plain cues often overlap; the words keep the file's order and are spread up to the next cue.
  blocks.sort((a, b) => a.start - b.start)
  const words: Word[] = []
  for (const [index, block] of blocks.entries()) {
    const until = rolling ? block.end : Math.max(block.start + 0.2, Math.min(block.end, blocks[index + 1]?.start ?? block.end))
    const joined = block.lines.filter((line) => !/^foreign$/i.test(line))
    const fresh = rolling ? joined : [joined.join(' ')]
    for (const line of fresh) words.push(...wordsOfLine(line.replace(/\[[^\]]*\]/g, ' '), block.start, until, rolling).filter((word) => !MARKER.test(word.text)))
  }
  for (let index = 1; index < words.length; index++) if (words[index].at < words[index - 1].at) words[index].at = words[index - 1].at
  return words
}

/** Short spoken lines: a break at a pause, at the end of a sentence, or every 16 words. */
export function linesFromWords(words: Word[], talkEnd?: number): Cue[] {
  const lines: Cue[] = []
  let current: Word[] = []
  const flush = (nextAt?: number) => {
    if (!current.length) return
    const last = current[current.length - 1]
    lines.push({ start: current[0].at, end: nextAt ?? last.at + 0.8, text: current.map((word) => word.text).join(' ') })
    current = []
  }
  for (const [index, word] of words.entries()) {
    const previous = words[index - 1]
    if (current.length && previous && word.at - previous.at > 1.2) flush(word.at)
    current.push(word)
    const sentenceEnd = /[.?!]["”']?$/.test(word.text) && current.length >= 4
    if (sentenceEnd || current.length >= 16) flush(words[index + 1]?.at)
  }
  flush(talkEnd)
  return lines.map((line) => ({ ...line, end: Math.max(line.end, line.start + 0.4) }))
}

function vttStamp(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

/** A plain WebVTT file of the lines, with no repeats, for the seed and the lesson's transcript field. */
export function cleanVtt(raw: string, note = '') {
  const lines = linesFromWords(wordTimeline(raw))
  const head = ['WEBVTT', ...(note ? ['', `NOTE ${note}`] : [])]
  return [...head, '', ...lines.map((line) => `${vttStamp(line.start)} --> ${vttStamp(line.end)}\n${line.text}\n`)].join('\n')
}

export function lastSecond(cues: Cue[]) {
  return cues.length ? Math.ceil(Math.max(...cues.map((cue) => cue.end))) : 0
}

export type TierDraft = {
  hors: { start: number; end: number; quote: string }
  appetiser: { start: number; end: number }
  hook: string
  turn: string
  land: string
  popups: { second: number; quote: string; prompt: string }[]
  duration: number
  note: string
}

const STOP = new Set(
  'the and that this with from your you are was were for have has had not but they them his her she its our out about into just like what when there then than been being would could should really very gonna going know mean means said says say okay yeah right uh um so all one can will get got because their thing things also some more who how why which over these those even make made want way'.split(' '),
)
const plainWords = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))

const NOISE = /subscribe|description|donat|qr code|the link|thank you for watching|patreon|sponsor|notification|comment below|like and share|launchgood|\bclick\b|follow us/i
const TURNING = /\b(but|however|rather|instead|actually|the problem|the question|isn't|is not|don't|do not|never|not just|not only)\b/i
const TEACHING = /\b(allah|prophet|qur'?an|heart|dua|mercy|trust|patience|grateful|gratitude|prayer|forgive|soul|light|love|peace|anger|time|humility|purpose)\b/i

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Line mode. The land is the line that best carries the talk's repeated words; the appetiser runs from a pause up to
 * 3 minutes before it to the end of the land; the hors d'oeuvre is 15 to 20 seconds from the start of the land.
 * Pop-ups are other strong lines spread across the main, outside the appetiser.
 */
export function draftTiers(lines: Cue[], durationHint?: number | null): TierDraft | null {
  const usable = lines.filter((line) => line.text.split(/\s+/).length >= 3)
  if (usable.length < 3) return null
  const duration = Math.max(durationHint || 0, lastSecond(lines))
  const counts = new Map<string, number>()
  for (const line of usable) for (const word of new Set(plainWords(line.text))) counts.set(word, (counts.get(word) || 0) + 1)
  const planted = new Set([...counts.entries()].filter(([, count]) => count >= Math.max(3, Math.round(usable.length / 60))).map(([word]) => word))
  const score = (line: Cue) => {
    const size = line.text.split(/\s+/).length
    if (NOISE.test(line.text)) return -10
    let total = plainWords(line.text).filter((word) => planted.has(word)).length * 2
    if (size >= 8 && size <= 18) total += 3
    else if (size < 6) total -= 3
    if (TEACHING.test(line.text)) total += 2
    if (TURNING.test(line.text)) total += 1
    if (/^(and|so|but|or|uh|um|like|because)\b/i.test(line.text)) total -= 2
    // The first seconds are usually a greeting and the last are thanks or a call to give.
    if (line.start < Math.min(20, duration * 0.08)) total -= 4
    if (line.end > duration * 0.95) total -= 6
    return total
  }
  const ranked = usable.map((line, index) => ({ line, index, score: score(line) })).sort((a, b) => b.score - a.score || a.line.start - b.line.start)
  const landRow = ranked.find((row) => row.line.start >= Math.min(30, duration * 0.15) && row.line.end >= Math.min(usable[0].start + 60, duration * 0.6)) || ranked[0]
  const land = landRow.line

  const windowLength = Math.min(APPETISER_MAX - 5, Math.max(45, duration < 200 ? duration : 150))
  const target = Math.max(0, land.end - windowLength)
  let hookIndex = landRow.index
  for (let index = landRow.index; index >= 0; index--) {
    if (usable[index].start < target) break
    hookIndex = index
  }
  const pauseBefore = (index: number) => index === 0 || usable[index].start - usable[index - 1].end > 0.6
  const opener = (index: number) => pauseBefore(index) && !/^(and|but|so|or|because|uh|um)\b/i.test(usable[index].text)
  const sized = (index: number) => usable[index].text.split(/\s+/).length >= 5
  const reach = usable[hookIndex].start + 30
  let snapped = hookIndex
  for (let index = hookIndex; index < landRow.index && usable[index].start <= reach; index++) {
    if (opener(index) && sized(index)) {
      snapped = index
      break
    }
  }
  if (snapped === hookIndex) while (snapped < landRow.index - 1 && !sized(snapped)) snapped += 1
  const hook = usable[snapped]
  const appetiserStart = Math.floor(hook.start)
  const appetiserEnd = Math.min(Math.ceil(land.end), appetiserStart + APPETISER_MAX, duration || Infinity)
  const middle = usable.slice(snapped + 1, landRow.index)
  const turn = middle.find((line) => TURNING.test(line.text) && line.text.split(/\s+/).length >= 5) || middle[Math.floor(middle.length / 2)] || hook

  const horsEnd = Math.min(Math.floor(land.start) + HORS_MAX, Math.max(Math.floor(land.start) + HORS_MIN, Math.ceil(land.end)), duration || Infinity)
  const horsStart = Math.max(0, Math.min(Math.floor(land.start), horsEnd - HORS_MIN))

  const popups: TierDraft['popups'] = []
  const addPopup = (line: Cue) => {
    const quote = capitalise(line.text)
    popups.push({ second: Math.min(Math.ceil(line.end), Math.max(0, duration - 1)), quote, prompt: `The speaker says: “${quote}” What does that line ask of you this week?` })
  }
  const thirds = [0, 1, 2].map((part) => [duration * (part / 3), duration * ((part + 1) / 3)])
  for (const [from, to] of thirds) {
    const pick = ranked.find(
      (row) =>
        row.score > 0 &&
        row.line.start >= from &&
        row.line.end <= to &&
        (row.line.end < appetiserStart || row.line.start > appetiserEnd) &&
        row.line.text.split(/\s+/).length >= 7 &&
        !popups.some((other) => Math.abs(other.second - row.line.end) < 60),
    )
    if (pick) addPopup(pick.line)
  }
  // Short talks are mostly appetiser; the main still plays them whole, so a pop-up may sit inside that stretch.
  for (const row of ranked) {
    if (popups.length >= 2) break
    const gap = Math.max(20, duration / 6)
    if (row.score > 0 && row.line.text.split(/\s+/).length >= 7 && !popups.some((other) => Math.abs(other.second - row.line.end) < gap)) addPopup(row.line)
  }
  popups.sort((a, b) => a.second - b.second)
  return {
    hors: { start: horsStart, end: horsEnd, quote: capitalise(land.text) },
    appetiser: { start: appetiserStart, end: appetiserEnd },
    hook: capitalise(hook.text),
    turn: capitalise(turn.text),
    land: capitalise(land.text),
    popups: popups.slice(0, 3),
    duration,
    note: `${DRAFT_NOTE} Appetiser ${formatTimestamp(appetiserStart)} to ${formatTimestamp(appetiserEnd)}.`,
  }
}

const matchWord = (word: string) => word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '')

/**
 * A transcript whose `**[m:ss]**` marks were estimated gets real times from the talk's captions: each line is found
 * in the caption words by its opening words, and lines that cannot be found are placed between their neighbours.
 */
export function alignToCaptions(marked: string, captions: string) {
  const words = wordTimeline(captions).map((word) => ({ at: word.at, key: matchWord(word.text) })).filter((word) => word.key)
  const pattern = /\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*/g
  const marks = [...marked.matchAll(pattern)]
  if (!marks.length || !words.length) return { text: marked, matched: 0, total: marks.length }
  const found: (number | null)[] = []
  let cursor = 0
  for (const [index, mark] of marks.entries()) {
    const from = mark.index! + mark[0].length
    const to = marks[index + 1]?.index ?? marked.length
    const opening = marked.slice(from, to).split(/\s+/).map(matchWord).filter(Boolean).slice(0, 6)
    let hit: number | null = null
    if (opening.length >= 3) {
      const limit = Math.min(words.length - opening.length, cursor + 1500)
      for (let at = cursor; at <= limit; at++) {
        let same = 0
        for (let k = 0; k < opening.length; k++) if (words[at + k]?.key === opening[k]) same += 1
        if (same >= Math.max(3, opening.length - 1)) {
          hit = at
          break
        }
      }
    }
    found.push(hit === null ? null : words[hit].at)
    if (hit !== null) cursor = hit + 1
  }
  const times = found.map((value, index) => {
    if (value !== null) return value
    const before = found.slice(0, index).reverse().find((item) => item !== null) ?? 0
    const after = found.slice(index + 1).find((item) => item !== null) ?? words[words.length - 1].at
    return before + (after - before) / 2
  })
  for (let index = 1; index < times.length; index++) times[index] = Math.max(times[index], times[index - 1])
  let position = 0
  const text = marked.replace(pattern, () => `**[${formatTimestamp(Math.floor(times[position++]))}]**`)
  return { text, matched: found.filter((value) => value !== null).length, total: marks.length }
}

/** The shape rules for a tier record, in plain English, or null when it holds. */
export function tierProblem(tier: Record<string, unknown>) {
  const num = (key: string) => Number(tier[key])
  const [hs, he, as, ae] = [num('horsStart'), num('horsEnd'), num('appetiserStart'), num('appetiserEnd')]
  if ([hs, he, as, ae].some((value) => !Number.isFinite(value) || value < 0)) return 'Every in and out point needs a time of 0 seconds or more.'
  if (he - hs < HORS_MIN || he - hs > HORS_MAX) return `The hors d'oeuvre runs ${Math.round(he - hs)} seconds. Keep it between ${HORS_MIN} and ${HORS_MAX}.`
  if (ae <= as) return 'The appetiser has to end after it starts.'
  if (ae - as > APPETISER_MAX + 15) return `The appetiser runs ${formatTimestamp(ae - as)}. Keep it to about 3 minutes.`
  return null
}

export type TimingRow = { label: string; start: number; end?: number | null }

/** Things that fall outside the talk: a cut, pop-up or tier that starts or ends after the real duration. */
export function timingProblems(duration: number | null | undefined, rows: TimingRow[]) {
  if (!duration || duration <= 0) return rows.length ? [`No duration is known, so ${rows.length} timed item(s) cannot be checked.`] : []
  const problems: string[] = []
  for (const row of rows) {
    const end = row.end ?? row.start
    if (row.start < 0 || row.start > duration) problems.push(`${row.label} starts at ${formatTimestamp(row.start)}, outside the ${formatTimestamp(duration)} talk.`)
    else if (end > duration + 1) problems.push(`${row.label} ends at ${formatTimestamp(end)}, after the ${formatTimestamp(duration)} talk.`)
    else if (end < row.start) problems.push(`${row.label} ends before it starts.`)
  }
  return problems
}
