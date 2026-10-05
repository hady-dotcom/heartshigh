import { idOf } from './ids'

export const WELCOME_SLOTS = ['learnerWelcome', 'learnerIntro', 'teacherWelcome', 'teacherIntro'] as const
export type WelcomeSlot = (typeof WELCOME_SLOTS)[number]
export type WelcomeKind = 'welcome' | 'intro'
export type WelcomeStep = 'welcome' | 'intro'

export type WelcomePortal = {
  slug?: string | null
  learnerWelcome?: unknown
  learnerIntro?: unknown
  teacherWelcome?: unknown
  teacherIntro?: unknown
  learnerWelcomeUrl?: string | null
  learnerIntroUrl?: string | null
  teacherWelcomeUrl?: string | null
  teacherIntroUrl?: string | null
}

export type WelcomeUser = {
  role?: string | null
  seenWelcome?: boolean | null
  onboarded?: boolean | null
  startingClause?: number | null
}

export type SpokenCue = { at: number; end?: number; text: string }

export type FilmSource = {
  kind: 'media' | 'url' | 'empty'
  mediaId: number | null
  url: string
  src: string
}

const URL_KEY: Record<WelcomeSlot, keyof WelcomePortal> = {
  learnerWelcome: 'learnerWelcomeUrl',
  learnerIntro: 'learnerIntroUrl',
  teacherWelcome: 'teacherWelcomeUrl',
  teacherIntro: 'teacherIntroUrl',
}

export function isWelcomeSlot(value: string): value is WelcomeSlot {
  return (WELCOME_SLOTS as readonly string[]).includes(value)
}

export function welcomeAudience(role?: string | null): 'learner' | 'teacher' {
  return role === 'learner' || role === 'parent' || !role ? 'learner' : 'teacher'
}

export function slotFor(audience: 'learner' | 'teacher', kind: WelcomeKind): WelcomeSlot {
  if (audience === 'teacher') return kind === 'welcome' ? 'teacherWelcome' : 'teacherIntro'
  return kind === 'welcome' ? 'learnerWelcome' : 'learnerIntro'
}

export function filmSource(portal: WelcomePortal | null | undefined, slot: WelcomeSlot): FilmSource {
  const mediaId = idOf(portal?.[slot])
  const url = String(portal?.[URL_KEY[slot]] || '').trim()
  if (mediaId) {
    return { kind: 'media', mediaId, url: '', src: `/api/hearts/file/${mediaId}` }
  }
  if (url) return { kind: 'url', mediaId: null, url, src: url }
  return { kind: 'empty', mediaId: null, url: '', src: '' }
}

export function filmsFor(portal: WelcomePortal | null | undefined, role?: string | null) {
  const audience = welcomeAudience(role)
  return {
    welcome: filmSource(portal, slotFor(audience, 'welcome')),
    intro: filmSource(portal, slotFor(audience, 'intro')),
  }
}

export function hasWelcomeWalk(portal: WelcomePortal | null | undefined, role?: string | null) {
  const films = filmsFor(portal, role)
  return films.welcome.kind !== 'empty' || films.intro.kind !== 'empty'
}

/** Returning people who already dismissed never see the walk again. */
export function shouldSeeWelcomeWalk(user: WelcomeUser | null | undefined, portal: WelcomePortal | null | undefined) {
  if (!user || user.seenWelcome) return false
  return hasWelcomeWalk(portal, user.role)
}

export function welcomeWalkHref(base: string, user: WelcomeUser | null | undefined, portal: WelcomePortal | null | undefined) {
  if (!shouldSeeWelcomeWalk(user, portal)) return null
  return `${base}/welcome?step=welcome`
}

export function afterWelcomePath(base: string, user: WelcomeUser | null | undefined) {
  if (!user || user.role === 'learner' || user.role === 'parent') {
    if (user && !user.onboarded) return user.startingClause ? `${base}/start?after=placing` : `${base}/start`
    return base
  }
  return `${base}/admin`
}

export function nextWelcomeStep(step: WelcomeStep): WelcomeStep | 'done' {
  return step === 'welcome' ? 'intro' : 'done'
}

export function welcomeStepFromQuery(step: string | undefined | null): WelcomeStep | 'other' {
  if (step === 'welcome' || step === 'films') return 'welcome'
  if (step === 'intro') return 'intro'
  return 'other'
}

/**
 * Only the words being spoken at this second. A title or a line that has already
 * finished must not sit frozen over the film.
 */
export function spokenWordsAt(cues: SpokenCue[], time: number) {
  if (!Number.isFinite(time) || time < 0) return ''
  const ordered = [...cues].filter((cue) => cue.text.trim()).sort((a, b) => a.at - b.at)
  for (let index = 0; index < ordered.length; index += 1) {
    const cue = ordered[index]
    const end = cue.end ?? ordered[index + 1]?.at ?? cue.at + 4
    if (time >= cue.at && time < end) return cue.text.trim()
  }
  return ''
}

export function welcomeSlotLabel(slot: WelcomeSlot) {
  if (slot === 'learnerWelcome') return 'Learner welcome film'
  if (slot === 'learnerIntro') return 'Learner introduction film'
  if (slot === 'teacherWelcome') return 'Teacher welcome film'
  return 'Teacher introduction film'
}
