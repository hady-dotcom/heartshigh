import { lineAt } from './harvest'
import { tidyCaption } from './tidy-caption'
import { formatTimestamp, parseTranscript } from './transcript'

export type CaptionCue = { start: number; end: number; raw: string; text: string }

/** The only line that may sit over a speaker: the timed spoken words, punctuated. Never a transcript. */
export function spokenCaptionAt(raw: string, seconds: number, speaker?: string) {
  const line = lineAt(raw, seconds)
  if (!line) return null
  return {
    text: tidyCaption(line.text, speaker ? { speakers: [speaker] } : {}),
    raw: line.text,
    seconds: line.seconds,
    timestamp: line.timestamp,
  }
}

export function captionCues(raw: string, speaker?: string): CaptionCue[] {
  const { cues } = parseTranscript(raw)
  const hints = speaker ? { speakers: [speaker] } : {}
  return cues
    .map((cue) => {
      const spoken = cue.text.replace(/\s+/g, ' ').trim()
      if (!spoken) return null
      return { start: cue.start, end: cue.end, raw: spoken, text: tidyCaption(spoken, hints) }
    })
    .filter((row): row is CaptionCue => Boolean(row))
}

/** Whole talk as tidy paragraphs for the separate Transcript view. Never drawn over the film. */
export function transcriptParagraphs(raw: string, speaker?: string) {
  const cues = captionCues(raw, speaker)
  const paragraphs: { start: number; timestamp: string; text: string; raw: string }[] = []
  let bucket: CaptionCue[] = []
  const flush = () => {
    if (!bucket.length) return
    const text = bucket.map((cue) => cue.text).join(' ').replace(/\s+/g, ' ').trim()
    paragraphs.push({
      start: bucket[0].start,
      timestamp: formatTimestamp(bucket[0].start),
      text,
      raw: bucket.map((cue) => cue.raw).join(' '),
    })
    bucket = []
  }
  for (const cue of cues) {
    bucket.push(cue)
    const last = cue.text.trim()
    const long = bucket.reduce((sum, item) => sum + item.text.length, 0) > 280
    if (/[.?!]$/.test(last) || long) flush()
  }
  flush()
  return paragraphs
}

export function transcriptPlainText(raw: string, speaker?: string, title?: string) {
  const parts = transcriptParagraphs(raw, speaker)
  const head = title ? `${title}\n\n` : ''
  return head + parts.map((row) => `${row.timestamp}  ${row.text}`).join('\n\n')
}

export function cueAt(cues: CaptionCue[], seconds: number) {
  if (!cues.length || !Number.isFinite(seconds)) return null
  const inside = cues.find((cue) => seconds >= cue.start && seconds < cue.end)
  if (inside) return inside
  let best: CaptionCue | null = null
  let dist = 2
  for (const cue of cues) {
    const gap = Math.abs(seconds - cue.start)
    if (gap <= dist) {
      best = cue
      dist = gap
    }
  }
  return best
}

export function foldCaption(value: string) {
  return value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** The words said at this moment. A talk title, series name or empty line is not a caption. */
export function spokenCaption(line: { text?: string; tidy?: string } | null | undefined, titles: (string | undefined)[]) {
  const shown = tidyCaption((line?.tidy || line?.text || '').trim())
  if (!shown) return ''
  const spoken = foldCaption(shown)
  if (titles.some((title) => title && spoken === foldCaption(title))) return ''
  return shown
}
