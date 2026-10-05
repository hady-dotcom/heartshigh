/** Portrait framing track: live treatments A–F of a landscape YouTube clip. */

export const FRAMING_MODES = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type FramingMode = (typeof FRAMING_MODES)[number]

export const MODE_LABEL: Record<FramingMode, string> = {
  A: 'Centre crop',
  B: 'Letterbox',
  C: 'Blurred fill',
  D: 'Face track',
  E: '4:5 card',
  F: 'Split words',
}

export const MODE_COLOUR: Record<FramingMode, string> = {
  A: '#7A6238',
  B: '#0F3B3A',
  C: '#14564C',
  D: '#D4A84B',
  E: '#3A4E48',
  F: '#1A5552',
}

/** Normalised box on the 16:9 source (0–1). */
export type CropBox = { x: number; y: number; w: number; h: number }

/** Normalised focus on the 16:9 source (0–1). */
export type FocusPoint = { x: number; y: number }

export type FramingSegment = {
  start: number
  end: number
  mode: FramingMode
  crop?: CropBox
  focus?: FocusPoint
  confidence: number
}

export type SpokenWord = {
  w: string
  t: number
  e?: number
  key?: boolean
}

export type FramingSentence = {
  text: string
  s: number
  e: number
  next?: number
  key?: string | null
  words: SpokenWord[]
}

export type FramingTrack = {
  version: 1
  youtubeId: string
  start: number
  end: number
  requestedStart?: number
  requestedEnd?: number
  segments: FramingSegment[]
  words?: SpokenWord[]
  sentences?: FramingSentence[]
}

export type ShotAnalysis = {
  start: number
  end: number
  faceCountMedian: number
  singleFaceRatio: number
  /** Face height as a fraction of the 16:9 frame. */
  faceHeight: number
  focus?: FocusPoint
  crop?: CropBox
  /** Fraction of the frame that looks like text outside a 9:16 centre crop. */
  textScore: number
  twoFar: boolean
  speakerCount: number
}

export type CaptionCue = { start: number; end: number; text: string }

export const HOLD_SECONDS = 4
export const TRANSITION_MS = 360
export const TEXT_HEAVY = 0.004
export const SINGLE_FACE_RATIO = 0.7
/** ~120 px on a 1080-tall frame. */
export const MIN_FACE_HEIGHT = 120 / 1080
export const CENTRE_SAFE = { lo: 0.38, hi: 0.62 }
export const SCENE_PAD = 0.35
export const PORTRAIT_CROP_W = 9 / 16 / (16 / 9)
