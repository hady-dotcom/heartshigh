/**
 * Demo stage rules. No database and no cookies here: the server and the tests both call these.
 * Accounts live on @demo-stage.hearts, never @hearts.test, and only inside the isDemo portal.
 */

export const DEMO_STAGE_DOMAIN = 'demo-stage.hearts'
export const DEMO_STAGE_SLUG = 'demo-stage'
export const DEMO_STAGE_NAME = 'HEARTS Demo'
export const DEMO_STAGE_PREFIX = '/demo-stage/as'
export const SESSION_COOKIE = 'payload-token'
export const DEMO_POLL_MS = 1000
export const DEMO_REFRESH_WITHIN_MS = 2000

export const DEMO_SLOTS = ['master', 'portal', 'teacher', 'learner'] as const
export type DemoSlot = (typeof DEMO_SLOTS)[number]

export const DEMO_STAGE_EMAILS: Record<DemoSlot, string> = {
  master: 'master@demo-stage.hearts',
  portal: 'portal@demo-stage.hearts',
  teacher: 'teacher@demo-stage.hearts',
  learner: 'learner@demo-stage.hearts',
}

export const DEMO_OPEN_COURSE = 'A sitting already open'
export const DEMO_DRAFT_COURSE = 'The next sitting'
export const DEMO_QUESTION = 'What will you carry from this sitting?'
export const DEMO_ANSWER = 'I will keep one quiet hour this week.'
export const DEMO_REPLY = 'Keep that hour after Maghrib. I will look for it in your workbook.'
export const DEMO_ANNOUNCE = 'Circle meets after Maghrib tonight.'

export const DEMO_BEATS = [
  {
    id: 'publish',
    title: 'Publish a course',
    detail: 'The portal admin publishes the next sitting. The learner’s list gains it.',
    slot: 'portal' as DemoSlot,
  },
  {
    id: 'answer',
    title: 'Learner answers',
    detail: 'The learner answers a question. The teacher queue lights up.',
    slot: 'learner' as DemoSlot,
  },
  {
    id: 'reply',
    title: 'Teacher replies',
    detail: 'The teacher writes back. The learner sees the note.',
    slot: 'teacher' as DemoSlot,
  },
  {
    id: 'announce',
    title: 'Post an announcement',
    detail: 'The portal admin posts a note. It shows on the learner’s home.',
    slot: 'portal' as DemoSlot,
  },
  {
    id: 'feature',
    title: 'Toggle a feature',
    detail: 'The master turns Go live off or on. The portal desk follows.',
    slot: 'master' as DemoSlot,
  },
] as const

export type DemoBeatId = (typeof DEMO_BEATS)[number]['id']

export type DemoEvent = {
  id: number
  slot: DemoSlot
  kind: string
  text: string
  at: number
}

const SELF_ACTIONS = new Set([
  'answer',
  'reply',
  'me-pref',
  'profile',
  'complete',
  'watch',
  'browse',
  'workbook-consent',
  'seen-welcome',
  'board',
  'placing',
  'logout',
  'announce-dismiss',
  'feedback',
  'watch-opt-in',
  'night-alerts',
  'seen-welcome',
])

const PORTAL_ACTIONS = new Set([
  'announce',
  'announce-create',
  'create-course',
  'portal-features',
  'create-code',
  'create-pack',
  'add-lesson',
  'settings',
  'code-switch',
  'rename-course',
])

export function isDemoSlot(value: string | null | undefined): value is DemoSlot {
  return Boolean(value && (DEMO_SLOTS as readonly string[]).includes(value))
}

export function isDemoStageEmail(email?: string | null) {
  const address = String(email || '').trim().toLowerCase()
  return address.endsWith(`@${DEMO_STAGE_DOMAIN}`)
}

/** Metrics, insights and swarm counts skip these people and the sandbox portal. */
export function excludedFromAnalytics(input: { email?: string | null; portalIsDemo?: boolean | null }) {
  if (input.portalIsDemo) return true
  return isDemoStageEmail(input.email)
}

export function countsTowardMetrics(input: { email?: string | null; portalIsDemo?: boolean | null }) {
  return !excludedFromAnalytics(input)
}

export function includeInSwarmCount(input: { email?: string | null; portalIsDemo?: boolean | null }) {
  return countsTowardMetrics(input)
}

export function shouldStoreInsight(input: { email?: string | null; portalIsDemo?: boolean | null }) {
  return countsTowardMetrics(input)
}

export function slotForRole(role: string | null | undefined): DemoSlot | null {
  if (role === 'master') return 'master'
  if (role === 'portal-admin') return 'portal'
  if (role === 'teacher') return 'teacher'
  if (role === 'learner') return 'learner'
  return null
}

export function demoCookieName(slot: DemoSlot) {
  return `hearts-demo-session-${slot}`
}

export function demoFrameName(slot: DemoSlot) {
  return `hearts-demo-${slot}`
}

export function demoFramePath(slot: DemoSlot, path: string) {
  const rest = path.startsWith('/') ? path : `/${path}`
  return `${DEMO_STAGE_PREFIX}/${slot}${rest}`
}

export function parseDemoFrame(pathname: string): { slot: DemoSlot; rest: string } | null {
  const match = pathname.match(/^\/demo-stage\/as\/(master|portal|teacher|learner)(\/.*)?$/)
  if (!match) return null
  const rest = match[2] && match[2] !== '/' ? match[2] : '/'
  return { slot: match[1] as DemoSlot, rest }
}

/** Replace the session cookie on this request only. The original header string is left as it was. */
export function cookieHeaderForSlot(header: string | null | undefined, token: string | null, tokenName = SESSION_COOKIE) {
  const parts = String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${tokenName}=`))
  if (token) parts.push(`${tokenName}=${token}`)
  return parts.join('; ')
}

export function sessionCookieName(slot: string | null | undefined, prefix = 'payload') {
  if (isDemoSlot(slot)) return demoCookieName(slot)
  return `${prefix}-token`
}

export type PortalClaim = { slug?: string | null; isDemo?: boolean | null } | null

/** A real portal that already uses the demo address is left alone. */
export function canClaimPortal(existing: PortalClaim): 'create' | 'use' | 'refuse' {
  if (!existing) return 'create'
  if (existing.slug === DEMO_STAGE_SLUG && existing.isDemo) return 'use'
  return 'refuse'
}

export function demoWriteDecision(input: {
  action: string
  actorIsDemo: boolean
  actorRole?: string | null
  targetPortalId: number | null
  targetIsDemo: boolean
  demoPortalId: number
  origin?: string | null
}): 'allow' | 'refuse' {
  if (!input.actorIsDemo) return 'allow'
  if (input.origin === 'master') return 'refuse'
  if (input.action === 'create-course' && input.actorRole === 'master' && input.origin !== 'local') return 'refuse'
  const namesDemo = Boolean(input.targetPortalId && input.targetPortalId === input.demoPortalId && input.targetIsDemo)
  if (SELF_ACTIONS.has(input.action)) {
    if (input.targetPortalId && !namesDemo) return 'refuse'
    return 'allow'
  }
  if (PORTAL_ACTIONS.has(input.action)) {
    if (!namesDemo) return 'refuse'
    return 'allow'
  }
  return 'refuse'
}

/** A wipe may touch a row only when it belongs to the sandbox portal or the demo namespace. */
export function isDemoStageWipeTarget(input: { portalId?: number | null; email?: string | null; demoPortalId: number }) {
  if (isDemoStageEmail(input.email)) return true
  return Boolean(input.portalId && input.portalId === input.demoPortalId)
}

export function swarmHiddenWhere(demoPortalId: number | null) {
  const hidden = { swarmHidden: { equals: true as const } }
  if (!demoPortalId) return hidden
  return { and: [hidden, { portal: { not_equals: demoPortalId } }] }
}

function clip(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean
}

export function tickerForAction(
  action: string,
  role: string | null | undefined,
  fields: { body?: string; title?: string; visibility?: string; reply?: string },
): { slot: DemoSlot; kind: string; text: string } | null {
  const slot = slotForRole(role)
  if (!slot) return null
  if (action === 'answer') {
    const words = clip(fields.body || '')
    return { slot: 'learner', kind: 'answer', text: words ? `Learner answered: ${words}` : 'Learner answered' }
  }
  if (action === 'reply') return { slot: 'teacher', kind: 'reply', text: 'Teacher replied' }
  if (action === 'announce' || action === 'announce-create') {
    const words = clip(fields.body || '')
    return { slot: 'portal', kind: 'announcement', text: words ? `Announcement posted: ${words}` : 'Announcement posted' }
  }
  if (action === 'portal-features') return { slot: 'master', kind: 'feature', text: 'Feature toggled' }
  if (action === 'create-course' && fields.visibility !== 'draft') {
    const title = clip(fields.title || '')
    const who: DemoSlot = slot === 'master' ? 'master' : 'portal'
    return { slot: who, kind: 'course', text: title ? `Course published: ${title}` : 'Course published' }
  }
  return null
}

export function eventsAfter(events: DemoEvent[], since: number) {
  return events.filter((event) => event.id > since).sort((a, b) => a.id - b.id)
}

/** Glow the panel that changed. Refresh every other panel. */
export function foldActivity(events: DemoEvent[]) {
  const glow = [...new Set(events.map((event) => event.slot))]
  const refresh = DEMO_SLOTS.filter((slot) => events.some((event) => event.slot !== slot))
  return { glow, refresh }
}
