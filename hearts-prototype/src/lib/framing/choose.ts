import { avoidMidSentenceSwitches, holdModes, sentenceSpans, snapClipWindow } from './snap'
import {
  CENTRE_SAFE,
  MIN_FACE_HEIGHT,
  PORTRAIT_CROP_W,
  SINGLE_FACE_RATIO,
  TEXT_HEAVY,
  type FramingMode,
  type FramingSentence,
  type FramingSegment,
  type FramingTrack,
  type ShotAnalysis,
} from './types'

export type Choice = { mode: FramingMode; confidence: number; why: string }

function centreSafe(shot: ShotAnalysis) {
  const x = shot.focus?.x ?? 0.5
  return x >= CENTRE_SAFE.lo && x <= CENTRE_SAFE.hi
}

/**
 * Per-shot pick. A–F are a toolkit, not rivals:
 * B for text, D for a confident single face, F for two or more people,
 * A only when a centre crop is safe, F when unsure.
 */
export function chooseMode(shot: ShotAnalysis): Choice {
  if (shot.textScore > TEXT_HEAVY) return { mode: 'B', confidence: Math.min(1, 0.55 + shot.textScore * 40), why: 'On-screen text or a verse card' }
  if (shot.speakerCount >= 2 || shot.twoFar) return { mode: 'F', confidence: shot.twoFar ? 0.86 : 0.72, why: 'Two or more people' }
  const single = shot.singleFaceRatio >= SINGLE_FACE_RATIO && shot.faceHeight >= MIN_FACE_HEIGHT && shot.speakerCount <= 1
  if (single) return { mode: 'D', confidence: Math.min(0.95, 0.6 + shot.singleFaceRatio * 0.3), why: 'Confident single speaker' }
  if (shot.faceCountMedian >= 0.5 && centreSafe(shot) && shot.textScore <= TEXT_HEAVY) {
    return { mode: 'A', confidence: 0.62, why: 'Face sits in the centre third' }
  }
  if (shot.faceCountMedian >= 0.4 && shot.singleFaceRatio < SINGLE_FACE_RATIO) {
    return { mode: 'C', confidence: 0.48, why: 'People, but no dependable single face' }
  }
  return { mode: 'F', confidence: 0.35, why: 'Unsure; prefer split words' }
}

export function portraitCrop(focusX = 0.5, focusY = 0.42): FramingSegment['crop'] {
  const w = PORTRAIT_CROP_W
  const h = 1
  const x = Math.min(Math.max(focusX - w / 2, 0), 1 - w)
  return { x, y: 0, w, h }
}

export function cardCrop(focusX = 0.5, focusY = 0.4): FramingSegment['crop'] {
  const w = (4 / 5) / (16 / 9)
  const h = 1
  const x = Math.min(Math.max(focusX - w / 2, 0), 1 - w)
  const y = Math.min(Math.max(focusY - 0.4 * h, 0), 1 - h)
  return { x, y, w, h }
}

function cropFor(mode: FramingMode, shot: ShotAnalysis): FramingSegment['crop'] | undefined {
  const x = shot.focus?.x ?? 0.5
  const y = shot.focus?.y ?? 0.42
  if (mode === 'D') return shot.crop || portraitCrop(x, y)
  if (mode === 'E') return shot.crop || cardCrop(x, y)
  if (mode === 'A') return portraitCrop(0.5, y)
  return undefined
}

export function segmentsFromShots(shots: ShotAnalysis[]): FramingSegment[] {
  return shots
    .filter((shot) => shot.end > shot.start)
    .map((shot) => {
      const pick = chooseMode(shot)
      return {
        start: shot.start,
        end: shot.end,
        mode: pick.mode,
        confidence: pick.confidence,
        focus: shot.focus,
        crop: cropFor(pick.mode, shot),
      }
    })
}

export function buildTrack(input: {
  youtubeId: string
  requestedStart: number
  requestedEnd: number
  shots: ShotAnalysis[]
  sentences?: FramingSentence[]
  cuts?: number[]
}): FramingTrack {
  const sentences = sentenceSpans(input.sentences)
  const window = snapClipWindow(input.requestedStart, input.requestedEnd, sentences, input.cuts || [])
  const inWindow = input.shots
    .map((shot) => ({ ...shot, start: Math.max(shot.start, window.start), end: Math.min(shot.end, window.end) }))
    .filter((shot) => shot.end - shot.start > 0.15)
  const raw = inWindow.length
    ? segmentsFromShots(inWindow)
    : [{ start: window.start, end: window.end, mode: 'F' as const, confidence: 0.2, focus: { x: 0.5, y: 0.45 } }]
  if (raw[0]) raw[0].start = window.start
  if (raw[raw.length - 1]) raw[raw.length - 1].end = window.end
  const held = avoidMidSentenceSwitches(holdModes(raw), sentences)
  if (held[0]) held[0].start = window.start
  if (held[held.length - 1]) held[held.length - 1].end = window.end
  return {
    version: 1,
    youtubeId: input.youtubeId,
    start: window.start,
    end: window.end,
    requestedStart: input.requestedStart,
    requestedEnd: input.requestedEnd,
    segments: held,
    sentences: input.sentences,
    words: input.sentences?.flatMap((row) => row.words),
  }
}

export function segmentAt(track: FramingTrack | null | undefined, time: number): FramingSegment | null {
  if (!track?.segments?.length) return null
  const hit = track.segments.find((row) => time >= row.start - 0.001 && time < row.end)
  return hit || track.segments[track.segments.length - 1] || null
}
