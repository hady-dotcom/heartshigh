import { HOLD_SECONDS, SCENE_PAD, type FramingSentence, type FramingSegment, type FramingMode } from './types'

export type SentenceSpan = { s: number; e: number }

export function sentenceSpans(sentences: FramingSentence[] | undefined): SentenceSpan[] {
  return (sentences || []).filter((row) => Number.isFinite(row.s) && Number.isFinite(row.e) && row.e > row.s).map((row) => ({ s: row.s, e: row.e }))
}

function nearestCut(time: number, cuts: number[]) {
  let best = Number.POSITIVE_INFINITY
  for (const cut of cuts) best = Math.min(best, Math.abs(cut - time))
  return best
}

function awayFromCuts(time: number, cuts: number[], direction: -1 | 1, pad = SCENE_PAD) {
  let next = time
  for (const cut of [...cuts].sort((a, b) => (direction > 0 ? a - b : b - a))) {
    if (Math.abs(cut - next) < pad) next = direction > 0 ? cut + pad : cut - pad
  }
  return next
}

/** Snap an in-point to the start of the nearest sentence, and off a scene change. */
export function snapIn(time: number, sentences: SentenceSpan[], cuts: number[] = []) {
  if (!sentences.length) return awayFromCuts(time, cuts, 1)
  const byStart = [...sentences].sort((a, b) => Math.abs(a.s - time) - Math.abs(b.s - time))[0]
  const chosen = byStart && Math.abs(byStart.s - time) <= 2.5 ? byStart.s : time
  return awayFromCuts(chosen, cuts, 1)
}

/** Snap an out-point to the end of the nearest sentence, and off a scene change. */
export function snapOut(time: number, sentences: SentenceSpan[], cuts: number[] = []) {
  if (!sentences.length) return awayFromCuts(time, cuts, -1)
  const byEnd = [...sentences].sort((a, b) => Math.abs(a.e - time) - Math.abs(b.e - time))[0]
  const chosen = byEnd && Math.abs(byEnd.e - time) <= 2.5 ? byEnd.e : time
  return awayFromCuts(chosen, cuts, -1)
}

export function snapClipWindow(start: number, end: number, sentences: SentenceSpan[], cuts: number[] = []) {
  let inAt = snapIn(start, sentences, cuts)
  let outAt = snapOut(end, sentences, cuts)
  if (outAt <= inAt + 1) {
    inAt = Math.min(inAt, start)
    outAt = Math.max(end, inAt + 1)
  }
  return { start: round3(inAt), end: round3(outAt) }
}

export function sentenceAt(time: number, sentences: SentenceSpan[]) {
  return sentences.find((row) => time >= row.s - 0.02 && time < row.e + 0.02) || null
}

/** Move a switch to the nearest sentence boundary when that keeps both sides long enough. */
export function snapSwitch(time: number, sentences: SentenceSpan[], minHold = HOLD_SECONDS, leftStart?: number, rightEnd?: number) {
  if (!sentences.length) return time
  const inside = sentenceAt(time, sentences)
  if (!inside) return time
  const toStart = Math.abs(inside.s - time)
  const toEnd = Math.abs(inside.e - time)
  const candidate = toStart <= toEnd ? inside.s : inside.e
  const leftOk = leftStart == null || candidate - leftStart >= minHold - 0.05
  const rightOk = rightEnd == null || rightEnd - candidate >= minHold - 0.05
  return leftOk && rightOk ? candidate : time
}

function mergePair(a: FramingSegment, b: FramingSegment): FramingSegment {
  const longer = b.end - b.start > a.end - a.start ? b : a
  const preferF = a.confidence < 0.45 || b.confidence < 0.45
  const mode: FramingMode = a.mode === b.mode ? a.mode : preferF ? 'F' : longer.mode
  return {
    start: a.start,
    end: b.end,
    mode,
    crop: longer.crop,
    focus: longer.focus,
    confidence: Math.min(a.confidence, b.confidence),
  }
}

/** Hold each mode at least `minHold` seconds by merging short neighbours. Prefer F when merging unlike modes. */
export function holdModes(segments: FramingSegment[], minHold = HOLD_SECONDS): FramingSegment[] {
  if (!segments.length) return []
  const ordered = [...segments].sort((a, b) => a.start - b.start)
  const out: FramingSegment[] = [{ ...ordered[0] }]
  for (let index = 1; index < ordered.length; index++) {
    const next = { ...ordered[index] }
    const prev = out[out.length - 1]
    if (next.mode === prev.mode && Math.abs(next.start - prev.end) < 0.2) {
      prev.end = next.end
      prev.confidence = Math.min(prev.confidence, next.confidence)
      if (next.focus) prev.focus = next.focus
      if (next.crop) prev.crop = next.crop
      continue
    }
    out.push(next)
  }
  let changed = true
  while (changed && out.length > 1) {
    changed = false
    for (let index = 0; index < out.length; index++) {
      const row = out[index]
      if (row.end - row.start >= minHold - 0.05) continue
      if (index === 0) {
        out[1] = mergePair(row, out[1])
        out.splice(0, 1)
      } else {
        out[index - 1] = mergePair(out[index - 1], row)
        out.splice(index, 1)
      }
      changed = true
      break
    }
  }
  return out.map((row) => ({ ...row, start: round3(row.start), end: round3(row.end) }))
}

export function avoidMidSentenceSwitches(segments: FramingSegment[], sentences: SentenceSpan[], minHold = HOLD_SECONDS): FramingSegment[] {
  if (segments.length < 2 || !sentences.length) return segments
  const out = segments.map((row) => ({ ...row }))
  for (let index = 1; index < out.length; index++) {
    const at = snapSwitch(out[index].start, sentences, minHold, out[index - 1].start, out[index].end)
    out[index - 1].end = at
    out[index].start = at
  }
  return holdModes(out, minHold)
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}
