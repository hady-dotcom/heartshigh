import { validateTrack } from './validate'
import type { FramingMode, FramingSegment, FramingTrack } from './types'

/**
 * Leon's rule: every learner video is framing F.
 * The wide landscape picture sits in a band at the top. The words sit underneath, in time with the voice.
 * Stored segment modes (A–E), experiment variants and the playhead do not change that.
 */
export const LEARNER_FRAMING_MODE: FramingMode = 'F'

export const FACE_TRACK_NOTE = "Face tracking hasn't been run on this clip."

export function learnerFramingMode(
  _track?: FramingTrack | null,
  _time?: number | null,
  _variant?: string | null,
): FramingMode {
  return LEARNER_FRAMING_MODE
}

export function segmentHasFace(segment: FramingSegment | null | undefined) {
  if (!segment?.crop || !(segment.confidence > 0)) return false
  const { x, y, w, h } = segment.crop
  return [x, y, w, h].every((value) => typeof value === 'number' && Number.isFinite(value)) && w > 0 && h > 0
}

/** True only when a sampler wrote a real face box. Confidence 0 means the job never ran. */
export function faceTrackingRan(track: FramingTrack | null | undefined) {
  return Boolean(track?.segments.some((segment) => segmentHasFace(segment)))
}

export function faceSample(track: FramingTrack, segment?: FramingSegment | null) {
  if (segmentHasFace(segment) && segment) return { crop: segment.crop, focus: segment.focus }
  const found = track.segments.find((row) => segmentHasFace(row))
  return found ? { crop: found.crop, focus: found.focus } : null
}

export function framingSaveNote(mode: FramingMode) {
  if (mode === 'F') return 'Saved. Learners see the wide video on top and the words underneath.'
  return 'Saved for the lab only. Learners still see the wide video on top and the words underneath.'
}

/** Writes a lab mode onto one segment. Learners still play F, even when this returns ok. */
export function applyFramingOverride(
  track: FramingTrack,
  index: number,
  mode: FramingMode,
): { ok: true; track: FramingTrack; notice: string } | { ok: false; error: string } {
  if (!track.segments[index]) return { ok: false, error: 'That segment is not on the track.' }
  if (mode === 'D' && !faceTrackingRan(track)) return { ok: false, error: FACE_TRACK_NOTE }
  const next: FramingTrack = {
    ...track,
    segments: track.segments.map((row, at) => (at === index ? { ...row, mode } : row)),
  }
  const problems = validateTrack(next)
  if (problems.length) return { ok: false, error: problems[0]?.message || 'That crop does not fit this clip.' }
  return { ok: true, track: next, notice: framingSaveNote(mode) }
}
