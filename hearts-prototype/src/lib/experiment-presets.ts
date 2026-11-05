/**
 * The only choices on “Start a new experiment”.
 * Split, metric and length are fixed here so the form stays free of expert fields.
 */
import { slotOf } from './experiment-slots'

export const DEFAULT_EXPERIMENT_DAYS = 14

export type ExperimentPreset = {
  key: string
  name: string
  /** What a person on the desk is testing, in plain words. */
  description: string
  slot: string
  primaryMetric: string
  variants: { key: string; label: string; payload: Record<string, unknown> }[]
}

export const EXPERIMENT_PRESETS: readonly ExperimentPreset[] = [
  {
    key: 'clip-button',
    name: 'The button under a short clip',
    description: 'Some people see “Ready for more?”. Others see “Hear more of this”.',
    slot: 'feed-cta-label',
    primaryMetric: 'clip_cta_tap',
    variants: [
      { key: 'ready', label: 'Ready for more?', payload: { label: 'Ready for more?' } },
      { key: 'hear-more', label: 'Hear more of this', payload: { label: 'Hear more of this' } },
    ],
  },
  {
    key: 'whole-talk',
    name: 'The invitation into the whole talk',
    description: 'Some people see “Watch the whole talk”. Others see “Start this course”.',
    slot: 'full-talk-cta-label',
    primaryMetric: 'full_talk_start',
    variants: [
      { key: 'watch-whole', label: 'Watch the whole talk ({n} min)', payload: { label: 'Watch the whole talk ({n} min)' } },
      { key: 'start-course', label: 'Start this course', payload: { label: 'Start this course' } },
    ],
  },
  {
    key: 'courses-tab',
    name: 'The name of the courses tab',
    description: 'Some people see “Lanes”. Others see “Explore”.',
    slot: 'lanes-tab-label',
    primaryMetric: 'lanes_tab_tap',
    variants: [
      { key: 'lanes', label: 'Lanes', payload: { label: 'Lanes' } },
      { key: 'explore', label: 'Explore', payload: { label: 'Explore' } },
    ],
  },
] as const

const BY_KEY = new Map(EXPERIMENT_PRESETS.map((preset) => [preset.key, preset]))

export function presetOf(key: string | null | undefined): ExperimentPreset | null {
  if (!key) return null
  return BY_KEY.get(key) || null
}

/** A unique experiment key that still passes the desk’s key rule. */
export function presetExperimentKey(presetKey: string, stamp = Date.now()) {
  const preset = presetOf(presetKey)
  const stem = (preset?.key || 'test').replace(/[^a-z0-9-]/g, '') || 'test'
  const suffix = `${stamp.toString(36)}${Math.random().toString(36).slice(2, 5)}`.replace(/[^a-z0-9]/g, '')
  const raw = `${stem}-${suffix}`.slice(0, 40).replace(/-+$/g, '')
  return /[a-z0-9]$/.test(raw) ? raw : `${raw}x`
}

export function presetProblems(preset: ExperimentPreset): string[] {
  const slot = slotOf(preset.slot)
  if (!slot) return [`${preset.name} is not on a testable slot.`]
  if (preset.variants.length < 2) return [`${preset.name} needs two versions.`]
  return []
}

export function experimentEndsAt(startedAt: string | null | undefined, days: number) {
  if (!startedAt) return null
  const start = Date.parse(startedAt)
  if (!Number.isFinite(start)) return null
  const length = Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPERIMENT_DAYS
  return new Date(start + length * 86_400_000).toISOString()
}
