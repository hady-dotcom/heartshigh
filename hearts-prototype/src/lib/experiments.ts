/**
 * Experiment slots the product can assign.
 *
 * TODO: replace this stub with the Experiments system being built in a parallel PR.
 * Until that registry lands, callers read an assignment from a query, a cookie, or
 * HEARTS_FRAMING_MODE, and fall back to the default variant below.
 */

export const EXPERIMENT_SLOTS = {
  'framing-mode': {
    key: 'framing-mode',
    variants: ['ai-director', 'split-only'] as const,
    defaultVariant: 'ai-director' as const,
    note: 'AI director follows a stored framing track; split-only always uses treatment F.',
  },
} as const

export type ExperimentKey = keyof typeof EXPERIMENT_SLOTS
export type FramingVariant = (typeof EXPERIMENT_SLOTS)['framing-mode']['variants'][number]

export function framingVariant(assignment?: string | null): FramingVariant {
  return assignment === 'split-only' ? 'split-only' : 'ai-director'
}

export function resolveFramingAssignment(source?: { query?: string | null; cookie?: string | null; env?: string | null }) {
  return framingVariant(source?.query || source?.cookie || source?.env || process.env.HEARTS_FRAMING_MODE)
}
