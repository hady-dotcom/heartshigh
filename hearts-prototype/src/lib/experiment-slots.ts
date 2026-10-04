/**
 * Whitelist of UI slots an experiment may change.
 *
 * Experiments may only change app wording, labels, layout and framing.
 * They must never change a sheikh's words, talk content, Qur'an or hadith text,
 * or the meaning of a question. Anything not listed here is refused.
 */
import { clipStepUpLabel, talkStepUpLabel } from './feed-copy'
import { hasMarkup } from './text-safety'
import { killListHits } from './opening-data'

export const EXPERIMENT_RULE =
  'Experiments may only change app wording, labels, layout and framing. They never change a sheikh’s words, talk content, Qur’an or hadith text, or the meaning of a question.'

export const FORBIDDEN_PAYLOAD_KEYS = [
  'quran',
  'qur\'an',
  'ayah',
  'ayat',
  'verse',
  'hadith',
  'hadeeth',
  'arabic',
  'transcript',
  'speakerWords',
  'sheikh',
  'sheikhWords',
  'prompt',
  'question',
  'questionText',
  'meaning',
  'tafsir',
] as const

export type SlotKind = 'copy' | 'layout'

export type SlotField =
  | { name: string; type: 'text'; max: number }
  | { name: string; type: 'enum'; values: readonly string[] }

export type ExperimentSlot = {
  key: string
  name: string
  kind: SlotKind
  surface: 'feed' | 'course' | 'garden' | 'me' | 'opening' | 'lanes'
  description: string
  /** What the app shows when no experiment is running, or when anything errors. */
  fallback: Record<string, unknown>
  fields: readonly SlotField[]
  wired: boolean
}

export const EXPERIMENT_SLOTS: readonly ExperimentSlot[] = [
  {
    key: 'feed-cta-label',
    name: 'Feed clip CTA',
    kind: 'copy',
    surface: 'feed',
    description: 'The gold button under a short clip (hors d’oeuvre) that invites the learner further.',
    fallback: { label: clipStepUpLabel() },
    fields: [{ name: 'label', type: 'text', max: 80 }],
    wired: true,
  },
  {
    key: 'full-talk-cta-label',
    name: 'Full-talk CTA',
    kind: 'copy',
    surface: 'feed',
    description: 'The gold button on an appetiser that opens the whole talk. {n} becomes the talk length in minutes.',
    fallback: { label: talkStepUpLabel(1) },
    fields: [{ name: 'label', type: 'text', max: 80 }],
    wired: true,
  },
  {
    key: 'wide-video-framing',
    name: 'Wide-video framing',
    kind: 'layout',
    surface: 'feed',
    description: 'How a single-speaker landscape clip is framed. Registered for the split player; the player itself is not swapped yet.',
    fallback: { framing: 'face-crop' },
    fields: [{ name: 'framing', type: 'enum', values: ['split', 'face-crop'] }],
    wired: false,
  },
  {
    key: 'lanes-tab-label',
    name: 'Lanes tab label',
    kind: 'copy',
    surface: 'lanes',
    description: 'The bottom-bar label for the lanes tab. Control is Lanes; the test line is Explore.',
    fallback: { label: 'Lanes' },
    fields: [{ name: 'label', type: 'text', max: 24 }],
    wired: true,
  },
] as const

const SLOT_BY_KEY = new Map(EXPERIMENT_SLOTS.map((slot) => [slot.key, slot]))

export function slotOf(key: string | null | undefined): ExperimentSlot | null {
  if (!key) return null
  return SLOT_BY_KEY.get(key) || null
}

export function isTestableSlot(key: string | null | undefined): boolean {
  return Boolean(slotOf(key))
}

export function slotKeys(): string[] {
  return EXPERIMENT_SLOTS.map((slot) => slot.key)
}

export function fallbackPayload(slotKey: string): Record<string, unknown> {
  return { ...(slotOf(slotKey)?.fallback || {}) }
}

function foldedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function payloadProblems(slotKey: string, payload: unknown): string[] {
  const slot = slotOf(slotKey)
  if (!slot) return ['That slot is not on the testable list. Experiments may only change listed UI wording, labels, layout and framing.']
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['A variant needs a small JSON payload that matches the slot.']
  const row = payload as Record<string, unknown>
  const problems: string[] = []
  for (const key of Object.keys(row)) {
    if (FORBIDDEN_PAYLOAD_KEYS.some((banned) => foldedKey(key) === foldedKey(banned))) {
      problems.push(`The field "${key}" is not allowed. Experiments never change a sheikh’s words, scripture, or a question’s meaning.`)
    }
  }
  for (const field of slot.fields) {
    const value = row[field.name]
    if (value == null || value === '') {
      problems.push(`Each variant needs a ${field.name}.`)
      continue
    }
    if (field.type === 'text') {
      if (typeof value !== 'string') {
        problems.push(`${field.name} must be plain text.`)
        continue
      }
      const text = value.trim()
      if (!text) problems.push(`${field.name} must be plain text.`)
      if (text.length > field.max) problems.push(`Keep ${field.name} under ${field.max} characters.`)
      if (hasMarkup(text)) problems.push(`${field.name} must be plain text: no HTML or script.`)
      const hits = killListHits(text)
      if (hits.length) problems.push(`The words ${hits.join(', ')} are not used in HEARTS.`)
    }
    if (field.type === 'enum') {
      if (typeof value !== 'string' || !field.values.includes(value)) {
        problems.push(`${field.name} must be ${field.values.join(' or ')}.`)
      }
    }
  }
  return problems
}

export function formatSlotLabel(template: string, minutes?: number) {
  const raw = String(template || '')
  if (minutes == null || !Number.isFinite(Number(minutes)) || Number(minutes) <= 0) {
    return raw.replace(/\s*\{n\}\s*/gi, ' ').replace(/\s+/g, ' ').trim()
  }
  const n = Math.max(1, Math.round(Number(minutes)))
  return raw.replace(/\{n\}/gi, String(n)).replace(/\bN\b/g, String(n))
}

export function slotPlainName(key: string) {
  return EXPERIMENT_SLOTS.find((slot) => slot.key === key)?.name || key.replace(/[-_]+/g, ' ')
}

/** Plain words for the Versions table. Never dump the JSON payload. */
export function variantCopy(payload: unknown, fallback = ''): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback
  const row = payload as Record<string, unknown>
  if (typeof row.label === 'string' && row.label.trim()) return row.label.trim()
  if (typeof row.framing === 'string' && row.framing.trim()) return row.framing.trim()
  return fallback
}

export const PRIMARY_METRICS = [
  { key: 'clip_cta_tap', label: 'Tapped the clip button' },
  { key: 'clip_watch_completion', label: 'Finished the short clip' },
  { key: 'appetiser_complete', label: 'Finished the three-minute cut' },
  { key: 'full_talk_start', label: 'Started the whole talk' },
  { key: 'full_talk_complete', label: 'Finished the whole talk' },
  { key: 'question_answered', label: 'Answered a question' },
  { key: 'return_next_day', label: 'Came back the next day' },
  { key: 'plan_created', label: 'Made a study plan' },
  { key: 'install_card_accept', label: 'Added HEARTS to the home screen' },
  { key: 'lanes_tab_tap', label: 'Tapped the lanes tab' },
  { key: 'lanes_course_start', label: 'Started a course from lanes in the first week' },
] as const

export type MetricKey = (typeof PRIMARY_METRICS)[number]['key']

export const TRACKED_EVENTS = [
  'clip_cta_tap',
  'clip_watch_seconds',
  'clip_watch_completion',
  'appetiser_complete',
  'full_talk_start',
  'full_talk_complete',
  'question_answered',
  'return_next_day',
  'plan_created',
  'install_card_accept',
  'lanes_tab_tap',
  'lanes_course_start',
] as const

export type TrackedEvent = (typeof TRACKED_EVENTS)[number]

export function isTrackedEvent(name: string): name is TrackedEvent {
  return (TRACKED_EVENTS as readonly string[]).includes(name)
}

export function isPrimaryMetric(name: string): name is MetricKey {
  return PRIMARY_METRICS.some((row) => row.key === name)
}

export function metricLabel(key: string) {
  return PRIMARY_METRICS.find((row) => row.key === key)?.label || key.replace(/_/g, ' ')
}

/** Course starts from the lanes tab only count in the first week after assignment. */
export const FIRST_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function withinFirstWeek(assignedAt: string | Date | null | undefined, at: Date | number = Date.now()): boolean {
  if (!assignedAt) return false
  const start = assignedAt instanceof Date ? assignedAt.getTime() : Date.parse(String(assignedAt))
  if (!Number.isFinite(start)) return false
  const end = typeof at === 'number' ? at : at.getTime()
  const age = end - start
  return age >= 0 && age <= FIRST_WEEK_MS
}

export function experimentDraftProblems(input: {
  key?: string
  name?: string
  slot?: string
  primaryMetric?: string
  secondaryMetrics?: string[]
  variants?: { key?: string; label?: string; payload?: unknown; weight?: number }[]
  allocation?: string
}): string[] {
  const problems: string[] = []
  const key = String(input.key || '')
  if (!/^[a-z][a-z0-9-]{1,58}[a-z0-9]$/.test(key)) problems.push('Use a short key of lower-case letters, numbers and dashes, such as feed-cta-label.')
  const name = String(input.name || '').trim()
  if (name.length < 3) problems.push('Give the experiment a name.')
  if (name.length > 80) problems.push('Keep the name under 80 characters.')
  if (hasMarkup(name)) problems.push('The name is plain text.')
  const hits = killListHits(name)
  if (hits.length) problems.push(`The words ${hits.join(', ')} are not used in HEARTS.`)
  if (!isTestableSlot(input.slot || '')) problems.push('Pick a slot from the testable list. Experiments may only change listed UI wording, labels, layout and framing.')
  if (!isPrimaryMetric(String(input.primaryMetric || ''))) problems.push('Pick a primary metric from the known events.')
  for (const metric of input.secondaryMetrics || []) {
    if (metric && !isTrackedEvent(metric) && !isPrimaryMetric(metric)) problems.push(`“${metric}” is not a tracked event.`)
  }
  if (input.allocation && input.allocation !== 'fixed' && input.allocation !== 'auto') problems.push('The split is either fixed or auto.')
  const variants = input.variants || []
  if (variants.length < 2) problems.push('An experiment needs at least two versions.')
  if (variants.length > 8) problems.push('Keep it to eight versions or fewer.')
  const keys = new Set<string>()
  let weight = 0
  for (const variant of variants) {
    const variantKey = String(variant.key || '').trim()
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(variantKey)) problems.push(`“${variant.key || ''}” is not a usable version key.`)
    if (keys.has(variantKey)) problems.push(`Two versions share the key ${variantKey}.`)
    keys.add(variantKey)
    const label = String(variant.label || '').trim()
    if (!label) problems.push('Each version needs a short label.')
    if (hasMarkup(label)) problems.push('Version labels are plain text.')
    problems.push(...payloadProblems(String(input.slot || ''), variant.payload))
    const w = Number(variant.weight)
    if (!Number.isFinite(w) || w < 0) problems.push('Weights are zero or a positive number.')
    weight += Math.max(0, w)
  }
  if (variants.length >= 2 && !(weight > 0)) problems.push('At least one version needs a weight above zero.')
  return [...new Set(problems)]
}

export type VariantView = {
  slot: string
  experimentKey: string | null
  variantKey: string | null
  payload: Record<string, unknown>
  label: string
  framing?: string
  running: boolean
}
