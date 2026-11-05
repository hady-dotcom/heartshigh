export type Cue = { start: number; end: number; text: string }

export function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim()
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

function stampToSeconds(token: string) {
  const [clock] = token.split('.')
  return parseTimestamp(clock) ?? 0
}

export function parseTranscript(raw: string): { cues: Cue[]; timed: boolean; estimated: boolean } {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const estimated = /timestamps:?\**:?\s*estimated/i.test(text.slice(0, 800))
  const vtt = parseVtt(text)
  if (vtt.length) return { cues: tidyCues(vtt), timed: true, estimated }
  const srt = parseSrt(text)
  if (srt.length) return { cues: tidyCues(srt), timed: true, estimated }
  const marked = parseMarked(text)
  if (marked.length) return { cues: tidyCues(marked), timed: true, estimated }
  const bracketed = parseBracketed(text)
  if (bracketed.length) return { cues: tidyCues(bracketed), timed: true, estimated }
  const plain = parsePlain(text)
  return { cues: plain, timed: false, estimated: true }
}

function parseVtt(text: string): Cue[] {
  if (!/^WEBVTT/m.test(text) && !/-->/.test(text.slice(0, 400)) && !text.includes('-->')) return []
  if (!text.includes('-->')) return []
  const cues: Cue[] = []
  const blocks = text.split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const arrow = lines.findIndex((line) => line.includes('-->'))
    if (arrow === -1) continue
    const [startRaw, endRaw] = lines[arrow].split('-->').map((part) => part.trim().split(' ')[0])
    const spoken = lines.slice(arrow + 1).join(' ').replace(/<[^>]+>/g, '').trim()
    if (!spoken) continue
    cues.push({ start: stampToSeconds(startRaw), end: stampToSeconds(endRaw), text: spoken })
  }
  return cues
}

function parseSrt(text: string): Cue[] {
  if (!/^\d+\s*$/m.test(text) || !text.includes('-->')) return []
  return parseVtt(text)
}

/** Talk-gatherer files: a `# key: value` header, then one `[h:mm:ss] words` line per cue. */
function parseBracketed(text: string): Cue[] {
  const cues: Cue[] = []
  for (const line of text.split('\n')) {
    if (/^\s*#/.test(line)) continue
    const match = line.match(/^\s*\[(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\]\s*(.*?)\s*$/)
    if (!match) continue
    const start = parseTimestamp(match[1]) ?? 0
    const spoken = match[2].replace(/\s+/g, ' ').trim()
    if (!spoken) continue
    cues.push({ start, end: start, text: spoken })
  }
  for (let index = 0; index < cues.length; index++) {
    const next = cues[index + 1]
    cues[index].end = next ? Math.max(cues[index].start + 0.4, next.start) : cues[index].start + 4
  }
  return cues
}

/**
 * YouTube auto-captions often repeat the tail of the previous line. Drop that overlap
 * and keep each cue's own start and end, so the timing is not flattened into one block.
 */
/**
 * YouTube cues often start before the previous cue has finished.
 * The previous cue ends when the next one starts. A cue that was still inside the previous window
 * keeps that window's end, so no speech time is dropped.
 */
export function closeOverlappingCues(cues: Cue[]): Cue[] {
  const out = cues.map((cue) => ({ ...cue }))
  for (let index = 0; index < out.length - 1; index++) {
    const prev = out[index]
    const next = out[index + 1]
    if (prev.end <= next.start) continue
    const prevEnd = prev.end
    prev.end = Math.max(prev.start, next.start)
    if (next.end < prevEnd) next.end = prevEnd
  }
  return out
}

function tidyCues(cues: Cue[]) {
  return closeOverlappingCues(dedupeRolling(cues))
}

export function dedupeRolling(cues: Cue[]): Cue[] {
  const out: Cue[] = []
  for (const cue of cues) {
    const text = cue.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const prev = out[out.length - 1]
    if (!prev) {
      out.push({ ...cue, text })
      continue
    }
    if (prev.text.toLowerCase() === text.toLowerCase()) {
      prev.end = Math.max(prev.end, cue.end)
      continue
    }
    const overlap = rollingOverlap(prev.text, text)
    if (!overlap) {
      out.push({ ...cue, text })
      continue
    }
    const fresh = text.split(/\s+/).slice(overlap).join(' ').trim()
    if (!fresh) {
      prev.end = Math.max(prev.end, cue.end)
      continue
    }
    out.push({ ...cue, text: fresh })
  }
  return out
}

function rollingOverlap(prev: string, next: string) {
  const left = prev.split(/\s+/).filter(Boolean)
  const right = next.split(/\s+/).filter(Boolean)
  const max = Math.min(left.length, right.length, 16)
  for (let count = max; count >= 4; count--) {
    const tail = left.slice(-count).join(' ').toLowerCase()
    const head = right.slice(0, count).join(' ').toLowerCase()
    if (tail === head) return count
  }
  return 0
}

function parseMarked(text: string): Cue[] {
  const pattern = /\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*\s*([\s\S]*?)(?=\*\*\[|$)/g
  const cues: Cue[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    const start = parseTimestamp(match[1]) ?? 0
    const spoken = match[2].replace(/\s+/g, ' ').trim()
    if (spoken) cues.push({ start, end: start, text: spoken })
  }
  for (let index = 0; index < cues.length; index++) {
    const next = cues[index + 1]
    cues[index].end = next ? Math.max(cues[index].start + 1, next.start) : cues[index].start + 8
  }
  return cues
}

function parsePlain(text: string): Cue[] {
  const cleaned = text
    .replace(/^#.+$/gm, '')
    .replace(/\*\*[^*]+\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []
  const sentences = cleaned.split(/(?<=[.?!])\s+/).filter((sentence) => sentence.split(' ').length > 3)
  const wordsPerSecond = 2.4
  let cursor = 0
  return sentences.map((sentence) => {
    const words = sentence.split(' ').length
    const start = cursor
    const end = start + Math.max(4, words / wordsPerSecond)
    cursor = end
    return { start, end, text: sentence.trim() }
  })
}

/**
 * `start`/`end` are estimated inside a cue. `cueStart`/`cueEnd` are the real marks from the file.
 * `complete` is false for a piece that does not start a sentence or does not finish one.
 */
export type Sentence = { start: number; end: number; text: string; cueStart: number; cueEnd: number; complete: boolean }

function splitSpoken(text: string): { text: string; complete: boolean }[] {
  const pieces = text
    .split(/(?<=[.?!])\s+/)
    .flatMap((piece) => {
      const words = piece.trim().split(/\s+/).filter(Boolean)
      if (words.length <= 40) return [{ text: words.join(' '), complete: /[.?!]["”']?$/.test(piece.trim()) }]
      const chunks: { text: string; complete: boolean }[] = []
      for (let index = 0; index < words.length; index += 30) chunks.push({ text: words.slice(index, index + 30).join(' '), complete: false })
      return chunks
    })
  return pieces.map((piece) => ({ ...piece, text: piece.text.trim() })).filter((piece) => piece.text.split(/\s+/).length >= 5)
}

/** Auto-captions with almost no full stops. One stop per 80 words still counts as punctuated. */
export function looksUnpunctuated(cues: Cue[]) {
  const text = cues.map((cue) => cue.text).join(' ')
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 40) return false
  const stops = (text.match(/[.?!]/g) || []).length
  return stops * 80 < words.length
}

/**
 * Group unpunctuated cues into spoken stretches at pauses and at a word cap.
 * Each stretch is a complete line so the extractor can draft clips on the built-in path.
 */
export function sentencesFromPauses(cues: Cue[]): Sentence[] {
  const sentences: Sentence[] = []
  let bucket: Cue[] = []
  let words = 0
  const flush = () => {
    if (!bucket.length) return
    const text = tidySegment(bucket.map((cue) => cue.text).join(' '))
    const start = bucket[0].start
    const end = Math.max(bucket[bucket.length - 1].end, start + 1)
    bucket = []
    words = 0
    if (text.split(/\s+/).filter(Boolean).length < 5) return
    sentences.push({ start, end, text, cueStart: start, cueEnd: end, complete: true })
  }
  for (const cue of cues) {
    const prev = bucket[bucket.length - 1]
    const gap = prev ? cue.start - prev.start : 0
    const pause = Boolean(prev) && gap >= 2.4
    if (bucket.length && ((pause && words >= 8) || words >= 24)) flush()
    bucket.push(cue)
    words += cue.text.split(/\s+/).filter(Boolean).length
  }
  flush()
  return sentences
}

function tidySegment(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').replace(/^(>>\s*)+/, '').trim()
  if (!cleaned) return ''
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function cuesToSentences(cues: Cue[]): Sentence[] {
  if (looksUnpunctuated(cues)) return sentencesFromPauses(cues)
  const sentences: Sentence[] = []
  for (const cue of cues) {
    const parts = splitSpoken(cue.text)
    parts.forEach((part, index) => {
      const start = cue.start + ((cue.end - cue.start) * index) / Math.max(1, parts.length)
      const end = cue.start + ((cue.end - cue.start) * (index + 1)) / Math.max(1, parts.length)
      sentences.push({ start, end: Math.max(end, start + 1), text: part.text, cueStart: cue.start, cueEnd: cue.end, complete: part.complete })
    })
  }
  return sentences
}

export function normaliseForMatch(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\*\*\[[^\]]+\]\*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when `quote` appears word for word in the transcript, ignoring spacing, case and timestamp marks. */
export function isVerbatim(quote: string, transcript: string) {
  const needle = normaliseForMatch(quote)
  return needle.length > 0 && normaliseForMatch(transcript).includes(needle)
}
