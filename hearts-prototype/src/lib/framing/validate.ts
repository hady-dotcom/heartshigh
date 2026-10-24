import { FRAMING_MODES, HOLD_SECONDS, type CropBox, type FocusPoint, type FramingMode, type FramingSegment, type FramingTrack } from './types'

export type FramingProblem = { path: string; message: string }

const MODES = new Set<string>(FRAMING_MODES)

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function inUnit(value: number) {
  return value >= 0 && value <= 1
}

function cropOk(crop: CropBox | undefined, path: string, problems: FramingProblem[]) {
  if (!crop) return
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    if (!finite(crop[key]) || !inUnit(crop[key])) problems.push({ path: `${path}.crop.${key}`, message: 'Crop values must be between 0 and 1.' })
  }
  if (finite(crop.x) && finite(crop.w) && crop.x + crop.w > 1.001) problems.push({ path: `${path}.crop`, message: 'Crop box must stay inside the frame.' })
  if (finite(crop.y) && finite(crop.h) && crop.y + crop.h > 1.001) problems.push({ path: `${path}.crop`, message: 'Crop box must stay inside the frame.' })
}

function focusOk(focus: FocusPoint | undefined, path: string, problems: FramingProblem[]) {
  if (!focus) return
  if (!finite(focus.x) || !inUnit(focus.x)) problems.push({ path: `${path}.focus.x`, message: 'Focus x must be between 0 and 1.' })
  if (!finite(focus.y) || !inUnit(focus.y)) problems.push({ path: `${path}.focus.y`, message: 'Focus y must be between 0 and 1.' })
}

export function isFramingMode(value: unknown): value is FramingMode {
  return typeof value === 'string' && MODES.has(value)
}

export function validateSegment(segment: FramingSegment, path = 'segment', clip?: { start: number; end: number }): FramingProblem[] {
  const problems: FramingProblem[] = []
  if (!finite(segment.start) || !finite(segment.end) || segment.end <= segment.start) {
    problems.push({ path: `${path}.start`, message: 'Each segment needs an end after its start.' })
  }
  if (!isFramingMode(segment.mode)) problems.push({ path: `${path}.mode`, message: 'Mode must be A, B, C, D, E or F.' })
  if (!finite(segment.confidence) || !inUnit(segment.confidence)) problems.push({ path: `${path}.confidence`, message: 'Confidence must be between 0 and 1.' })
  cropOk(segment.crop, path, problems)
  focusOk(segment.focus, path, problems)
  if (clip && finite(segment.start) && finite(segment.end)) {
    if (segment.start < clip.start - 0.05) problems.push({ path: `${path}.start`, message: 'Segment starts before the clip.' })
    if (segment.end > clip.end + 0.05) problems.push({ path: `${path}.end`, message: 'Segment ends after the clip.' })
  }
  return problems
}

export function validateTrack(track: FramingTrack, options?: { minHold?: number }): FramingProblem[] {
  const problems: FramingProblem[] = []
  if (track.version !== 1) problems.push({ path: 'version', message: 'Track version must be 1.' })
  if (!track.youtubeId || typeof track.youtubeId !== 'string') problems.push({ path: 'youtubeId', message: 'A YouTube id is required.' })
  if (!finite(track.start) || !finite(track.end) || track.end <= track.start) {
    problems.push({ path: 'start', message: 'The clip needs an end after its start.' })
    return problems
  }
  if (!Array.isArray(track.segments) || !track.segments.length) {
    problems.push({ path: 'segments', message: 'A track needs at least one segment.' })
    return problems
  }
  const clip = { start: track.start, end: track.end }
  const minHold = options?.minHold ?? HOLD_SECONDS
  const span = track.end - track.start
  track.segments.forEach((segment, index) => {
    problems.push(...validateSegment(segment, `segments[${index}]`, clip))
    if (span >= minHold && finite(segment.start) && finite(segment.end) && segment.end - segment.start < minHold - 0.05) {
      problems.push({ path: `segments[${index}]`, message: `Hold a mode for at least ${minHold} seconds.` })
    }
  })
  const ordered = [...track.segments].sort((a, b) => a.start - b.start)
  if (ordered[0] && ordered[0].start > track.start + 0.08) problems.push({ path: 'segments[0].start', message: 'The first segment must cover the clip in-point.' })
  const last = ordered[ordered.length - 1]
  if (last && last.end < track.end - 0.08) problems.push({ path: `segments[${ordered.length - 1}].end`, message: 'The last segment must cover the clip out-point.' })
  for (let index = 1; index < ordered.length; index++) {
    const prev = ordered[index - 1]
    const next = ordered[index]
    if (next.start < prev.end - 0.05) problems.push({ path: `segments[${index}].start`, message: 'Segments must not overlap.' })
    if (next.start > prev.end + 0.12) problems.push({ path: `segments[${index}].start`, message: 'Segments must not leave a gap.' })
  }
  return problems
}

export function parseTrack(value: unknown): FramingTrack | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<FramingTrack>
  if (row.version !== 1 || typeof row.youtubeId !== 'string' || !Array.isArray(row.segments)) return null
  const track = row as FramingTrack
  return validateTrack(track).length ? null : track
}

export function fallbackTrack(youtubeId: string, start: number, end: number): FramingTrack {
  return {
    version: 1,
    youtubeId,
    start,
    end,
    segments: [{ start, end, mode: 'F', confidence: 0, focus: { x: 0.5, y: 0.45 } }],
  }
}
