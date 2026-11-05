/**
 * Safety watch for a running experiment.
 * Care alerts and drop-offs are harm rates. The guard trips when a version's
 * rate rises above the first version (the control) by a clear gap, once both
 * sides have enough learners to compare.
 */

export const SAFETY_METRICS = [
  { key: 'care_alert', label: 'Care alerts' },
  { key: 'drop_off', label: 'Drop-offs' },
] as const

export type SafetyMetricKey = (typeof SAFETY_METRICS)[number]['key']

export const SAFETY_MIN_EXPOSURES = 30
/** Absolute rise in the harm rate that counts as a drop in safety. */
export const SAFETY_RATE_GAP = 0.02

export type SafetySample = { exposures: number; harms: number }

export type SafetyGuardResult = {
  dropped: boolean
  baselineRate: number
  currentRate: number
}

export function isSafetyMetric(key: string | null | undefined): key is SafetyMetricKey {
  return SAFETY_METRICS.some((row) => row.key === key)
}

export function safetyLabel(key: string) {
  return SAFETY_METRICS.find((row) => row.key === key)?.label || 'The safety metric'
}

export function normaliseSafetyMetric(raw: string | null | undefined): SafetyMetricKey | null {
  const text = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (text === 'care_alert' || text === 'care_alerts') return 'care_alert'
  if (text === 'drop_off' || text === 'drop_offs' || text === 'dropoff' || text === 'dropoffs') return 'drop_off'
  if (/care|alert/.test(text)) return 'care_alert'
  if (/drop/.test(text)) return 'drop_off'
  return null
}

export function harmRate(sample: SafetySample) {
  if (!(sample.exposures > 0)) return 0
  return Math.max(0, sample.harms) / sample.exposures
}

/**
 * True when `current` is worse than `baseline` by more than the gap.
 * A thin sample never trips, so one stray alert cannot pause a test.
 */
export function safetyGuard(baseline: SafetySample, current: SafetySample, options?: { minExposures?: number; gap?: number }): SafetyGuardResult {
  const min = options?.minExposures ?? SAFETY_MIN_EXPOSURES
  const gap = options?.gap ?? SAFETY_RATE_GAP
  const baselineRate = harmRate(baseline)
  const currentRate = harmRate(current)
  if (!(current.exposures >= min) || !(baseline.exposures >= min)) {
    return { dropped: false, baselineRate, currentRate }
  }
  return { dropped: currentRate > baselineRate + gap, baselineRate, currentRate }
}
