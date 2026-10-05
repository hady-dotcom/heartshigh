import { createHash } from 'node:crypto'
import { payloadSecret } from './env'

export const NOTIFY_KINDS = ['teacher-reply', 'future-question', 'live-soon', 'gather-tomorrow', 'study-plan', 'weekly'] as const
export type NotifyKind = (typeof NOTIFY_KINDS)[number]
export type NotifyChannel = 'in-app' | 'email' | 'off'

export type NotifyPrefs = {
  channels: Record<NotifyKind, NotifyChannel>
  quietNight: boolean
  emailNewsAt?: string | null
}

export const DEFAULT_PREFS: NotifyPrefs = {
  channels: {
    'teacher-reply': 'in-app',
    'future-question': 'in-app',
    'live-soon': 'in-app',
    'gather-tomorrow': 'in-app',
    'study-plan': 'in-app',
    weekly: 'off',
  },
  quietNight: true,
  emailNewsAt: null,
}

export const KIND_LABEL: Record<NotifyKind, string> = {
  'teacher-reply': 'Your teacher replied',
  'future-question': 'A question opened',
  'live-soon': 'A live sitting is about to start',
  'gather-tomorrow': 'A gathering is tomorrow',
  'study-plan': 'A study plan was shared',
  weekly: 'A note about your week',
}

export function parsePrefs(raw: unknown, nightAlerts?: boolean | null): NotifyPrefs {
  const base: NotifyPrefs = {
    channels: { ...DEFAULT_PREFS.channels },
    quietNight: DEFAULT_PREFS.quietNight,
    emailNewsAt: null,
  }
  if (nightAlerts && !raw) base.channels['gather-tomorrow'] = 'in-app'
  if (!raw || typeof raw !== 'object') return base
  const data = raw as { channels?: Record<string, string>; quietNight?: boolean; emailNewsAt?: string | null }
  for (const kind of NOTIFY_KINDS) {
    const value = data.channels?.[kind]
    if (value === 'in-app' || value === 'email' || value === 'off') base.channels[kind] = value
  }
  if (typeof data.quietNight === 'boolean') base.quietNight = data.quietNight
  if (data.emailNewsAt) base.emailNewsAt = data.emailNewsAt
  return base
}

export function wantsEmail(prefs: NotifyPrefs, kind: NotifyKind) {
  return prefs.channels[kind] === 'email'
}

export function wantsInApp(prefs: NotifyPrefs, kind: NotifyKind) {
  return prefs.channels[kind] === 'in-app' || prefs.channels[kind] === 'email'
}

export function unsubscribeToken(userId: number, kind: NotifyKind | 'all' = 'all') {
  return createHash('sha256').update(`${payloadSecret()}:unsub:${userId}:${kind}`).digest('hex').slice(0, 32)
}

export function kindFromKey(key?: string | null) {
  if (!key) return null
  const match = key.match(/^n:([a-z-]+):/)
  if (!match) return null
  return NOTIFY_KINDS.includes(match[1] as NotifyKind) ? (match[1] as NotifyKind) : null
}

export function notifyKey(kind: NotifyKind, extra: string) {
  return `n:${kind}:${extra}`
}
