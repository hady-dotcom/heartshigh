/** How a portal looks. Missing values stay plain: a new portal shows no HEARTS art until its admin chooses some. */

export type CourseHome = 'cards' | 'garden'
export type MarkKind = 'plain' | 'hearts'

export type ScenePreset = {
  key: string
  label: string
  kind: 'Religious' | 'Workplace' | 'Home' | 'Plain'
  url: string
}

export const SCENE_PRESETS: readonly ScenePreset[] = [
  { key: 'courtyard', label: 'Mosque courtyard', kind: 'Religious', url: '/theme/evening-courtyard.jpg' },
  { key: 'office', label: 'Calm office', kind: 'Workplace', url: '/theme/scenes/office.jpg' },
  { key: 'staff-room', label: 'Staff room', kind: 'Workplace', url: '/theme/scenes/staff-room.jpg' },
  { key: 'kitchen', label: 'Kitchen table', kind: 'Home', url: '/theme/scenes/kitchen.jpg' },
  { key: 'living-room', label: 'Living room', kind: 'Home', url: '/theme/scenes/living-room.jpg' },
  { key: 'plain', label: 'Soft plain colour', kind: 'Plain', url: '' },
]

export const HEARTS_LOOK = {
  sceneKey: 'courtyard',
  courseHome: 'cards' as CourseHome,
  supportNote: 'This has been powered by donations.',
  markKind: 'hearts' as MarkKind,
}

export const PLAIN_LOOK = {
  sceneKey: 'plain',
  courseHome: 'cards' as CourseHome,
  supportNote: '',
  markKind: 'plain' as MarkKind,
}

type LookSource = {
  sceneKey?: string | null
  sceneUrl?: string | null
  courseHome?: string | null
  supportNote?: string | null
  markKind?: string | null
} | null | undefined

export function courseHomeOf(portal: LookSource): CourseHome {
  return portal?.courseHome === 'garden' ? 'garden' : 'cards'
}

export function showHeartsMark(portal: LookSource) {
  return portal?.markKind === 'hearts'
}

export function supportNoteOf(portal: LookSource) {
  return String(portal?.supportNote || '').trim()
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

export function sceneUrlOf(portal: LookSource) {
  const key = String(portal?.sceneKey || '').trim()
  if (!key || key === 'plain') return ''
  if (key === 'upload') return safeSceneUrl(portal?.sceneUrl)
  const preset = SCENE_PRESETS.find((scene) => scene.key === key)
  return preset?.url || ''
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
