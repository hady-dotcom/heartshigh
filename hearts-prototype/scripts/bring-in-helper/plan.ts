import { punctuateTimedCues, cuesLackSentenceMarks, type TimedCue } from '../../src/lib/punctuate'
import { helperAttachResult } from '../../src/lib/publish-state'
import { parseTranscript } from '../../src/lib/transcript'
import { segmentsToVtt } from '../../src/lib/youtube'

export type AttachDecision = 'attached' | 'already' | 'denied' | 'retry' | 'failed'

/** What a helper does with one attach response. 409 means the talk was already filled. */
export function attachDecision(status: number): AttachDecision {
  if (status === 200) return 'attached'
  if (status === 409) return 'already'
  if (status === 401 || status === 403) return 'denied'
  if (status === 429 || status >= 500) return 'retry'
  return 'failed'
}

export function helperAttachMessage() {
  return helperAttachResult().message
}

/** Exit 1 only when a talk was skipped and nothing was attached. Unavailable films are not skips. */
export function helperRunFailed(counts: { skipped: number; attached: number; already: number }) {
  return counts.skipped > 0 && counts.attached === 0 && counts.already === 0
}

export function helperGapMs(raw: string | undefined, fallback = 2000) {
  if (raw == null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return fallback
  return Math.min(value, 60_000)
}

/** Timed text with sentence breaks. Captions that already have stops are left as they are. */
export function punctuateTranscript(raw: string) {
  const parsed = parseTranscript(raw)
  if (!parsed.cues.length) return raw.trim()
  const cues = cuesLackSentenceMarks(parsed.cues) ? punctuateTimedCues(parsed.cues) : parsed.cues
  return segmentsToVtt(cues)
}

export function punctuateCues(cues: TimedCue[]) {
  const next = cuesLackSentenceMarks(cues) ? punctuateTimedCues(cues) : cues
  return segmentsToVtt(next)
}

export function speechCuesFromJson(raw: string): TimedCue[] {
  const body = JSON.parse(raw) as { cues?: TimedCue[] }
  return (body.cues || [])
    .map((cue) => ({ start: Number(cue.start), end: Number(cue.end), text: String(cue.text || '').trim() }))
    .filter((cue) => cue.text && Number.isFinite(cue.start) && Number.isFinite(cue.end))
}
