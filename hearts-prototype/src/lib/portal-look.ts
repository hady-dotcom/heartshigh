/** How a portal looks. Missing values stay plain: a new portal shows no HEARTS art until its admin chooses some. */

export type CourseHome = 'cards' | 'garden'
export type MarkKind = 'plain' | 'hearts'
export type ShellLook = 'modern' | 'hearts'
export type FontPairKey = 'system' | 'jakarta' | 'bricolage' | 'outfit' | 'inter'

export const MODERN_ACCENT = '#2563EB'

/** Curated pairs. System is the house style. The others stay available in portal settings. */
export const FONT_PAIRS: readonly { key: FontPairKey; label: string; heading: string; body: string }[] = [
  { key: 'system', label: 'System', heading: 'SF Pro', body: 'SF Pro' },
  { key: 'jakarta', label: 'Jakarta', heading: 'Plus Jakarta Sans', body: 'Inter' },
  { key: 'bricolage', label: 'Bricolage', heading: 'Bricolage Grotesque', body: 'Inter' },
  { key: 'outfit', label: 'Outfit', heading: 'Outfit', body: 'Inter' },
  { key: 'inter', label: 'Inter', heading: 'Inter', body: 'Inter' },
]

export type ScenePreset = {
  key: string
  label: string
  kind: 'Religious' | 'Workplace' | 'Home' | 'Plain'
  url: string
}

export const SCENE_PRESETS: readonly ScenePreset[] = [
  { key: 'courtyard', label: 'Courtyard', kind: 'Religious', url: '/theme/evening-courtyard.jpg' },
  { key: 'office', label: 'Calm office', kind: 'Workplace', url: '/theme/scenes/office.jpg' },
  { key: 'staff-room', label: 'Staff room', kind: 'Workplace', url: '/theme/scenes/staff-room.jpg' },
  { key: 'kitchen', label: 'Kitchen table', kind: 'Home', url: '/theme/scenes/kitchen.jpg' },
  { key: 'living-room', label: 'Living room', kind: 'Home', url: '/theme/scenes/living-room.jpg' },
  { key: 'plain', label: 'None', kind: 'Plain', url: '' },
]

export const HEARTS_LOOK = {
  sceneKey: 'courtyard',
  courseHome: 'cards' as CourseHome,
  supportNote: 'This has been powered by donations.',
  markKind: 'hearts' as MarkKind,
  shell: 'hearts' as ShellLook,
  fontPair: 'jakarta' as FontPairKey,
}

export const PLAIN_LOOK = {
  sceneKey: 'plain',
  courseHome: 'cards' as CourseHome,
  supportNote: '',
  markKind: 'plain' as MarkKind,
  shell: 'modern' as ShellLook,
  fontPair: 'system' as FontPairKey,
}

type LookSource = {
  sceneKey?: string | null
  sceneUrl?: string | null
  courseHome?: string | null
  supportNote?: string | null
  markKind?: string | null
  shell?: string | null
  fontPair?: string | null
  accent?: string | null
  colour?: string | null
} | null | undefined

export function shellOf(portal: LookSource): ShellLook {
  return portal?.shell === 'hearts' ? 'hearts' : 'modern'
}

export function fontPairOf(portal: LookSource): FontPairKey {
  const key = String(portal?.fontPair || '')
  return FONT_PAIRS.some((pair) => pair.key === key) ? (key as FontPairKey) : 'system'
}

export function fontFaces(portal: LookSource) {
  const key = fontPairOf(portal)
  return FONT_PAIRS.find((pair) => pair.key === key) || FONT_PAIRS[0]
}

/** The one accent on the white look. A missing colour falls back to the modern blue. */
export function accentOf(portal: LookSource) {
  const raw = String(portal?.accent || portal?.colour || '').trim()
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : MODERN_ACCENT
}

export function courseHomeOf(portal: LookSource): CourseHome {
  return portal?.courseHome === 'garden' ? 'garden' : 'cards'
}

export function showHeartsMark(portal: LookSource) {
  return portal?.markKind === 'hearts'
}

export function supportNoteOf(portal: LookSource) {
  return String(portal?.supportNote || '').trim()
}

/**
 * The welcome line. A blank string hides it, including on HEARTS.
 * Nothing stored keeps the donations sentence for HEARTS and stays hidden everywhere else.
 */
export function shownSupportNote(portal: LookSource) {
  if (!portal || portal.supportNote == null) return shellOf(portal) === 'hearts' ? HEARTS_LOOK.supportNote : ''
  return String(portal.supportNote).trim()
}

/** A site path or https image. Anything else is dropped. */
export function safeSceneUrl(value: unknown) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..')) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export const SCENE_KEYS = ['plain', 'courtyard', 'office', 'staff-room', 'kitchen', 'living-room', 'upload'] as const

export function sceneKeyOf(portal: LookSource) {
  const key = String(portal?.sceneKey || '').trim()
  if ((SCENE_KEYS as readonly string[]).includes(key)) return key
  return shellOf(portal) === 'hearts' ? 'courtyard' : 'plain'
}

export function sceneUrlOf(portal: LookSource) {
  const key = sceneKeyOf(portal)
  if (key === 'plain') return ''
  if (key === 'upload') return safeSceneUrl(portal?.sceneUrl)
  const preset = SCENE_PRESETS.find((scene) => scene.key === key)
  return preset?.url || ''
}

/**
 * Inline `--scene` for a chosen picture.
 * HEARTS with the courtyard (or nothing stored) keeps the evening theme's own image.
 * A modern portal with nothing chosen stays `none` via the white shell.
 */
export function sceneCssOf(portal: LookSource) {
  const key = String(portal?.sceneKey || '').trim()
  const hearts = shellOf(portal) === 'hearts'
  if (hearts && (!key || key === 'courtyard')) return null
  const url = sceneUrlOf(portal).replace(/["\\]/g, '')
  if (url) return `url("${url}")`
  if (hearts && key === 'plain') return 'none'
  return null
}

/** CSS custom properties. An empty scene is `none`, so the courtyard does not leak through. */
export function lookStyle(portal: LookSource): Record<string, string> {
  const scene = sceneUrlOf(portal)
  return {
    '--scene': scene ? `url("${scene}")` : 'none',
    '--lattice': showHeartsMark(portal) ? "url('/theme/lattice.svg')" : 'none',
  }
}

/**
 * A question timestamp that sits past the film is pulled back to 80% of the length,
 * so the film still asks it. Unknown lengths are left alone.
 */
export function calloutSecond(second: number, duration?: number | null) {
  const at = Math.max(0, Math.floor(Number(second) || 0))
  const length = Number(duration)
  if (!Number.isFinite(length) || length < 5) return at
  const latest = Math.max(1, Math.floor(length * 0.8))
  return at <= latest ? at : latest
}

/** 1-based label from the film's place in the list the learner can see, not a stored order that may have a gap. */
export function filmLabel(index: number, title: string) {
  const place = Math.max(0, index)
  return `${place + 1}. ${title}`.trim()
}

const HEARTS_WORDS = /\b(hearts|islam|iman|ihsan|jibril|ghunya|qur['’]?an|hadith|mosque|masjid|allah)\b/i

export function hasHeartsWording(value: string) {
  return HEARTS_WORDS.test(value)
}
