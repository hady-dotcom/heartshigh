/** Shown wherever a desk action will not call a portal AI account. */
export const AI_OFF_NOTE = 'AI is off. This runs the built-in practice draft, not AI.'

/** Heading on a compare result that came from the built-in draft, not a model. */
export const PRACTICE_DRAFT_LABEL = 'practice draft (no AI)'

/** Seasonal lines on the calendar. A suggestion, not a model rewrite of a talk. */
export const SEASONAL_APPROVAL = 'Suggested lines need your approval. They never change a sheikh\u2019s words.'

/** The master desk, or a portal with no account, does not spend. */
export function aiSpendIsOff(input: { master?: boolean; connected: boolean }) {
  return Boolean(input.master) || !input.connected
}

export function tryOutputLabel(builtIn: boolean, side: 'draft' | 'live') {
  if (builtIn) return PRACTICE_DRAFT_LABEL
  return side === 'draft' ? 'This draft' : 'Live version'
}

export type RerunScope = { value: 'talk' | 'selection' | 'course' | 'all'; label: string }

/** Re-run scopes. The master desk hides Everything while no portal AI is connected. */
export function rerunScopes(input: { master?: boolean; connected: boolean }): RerunScope[] {
  const scopes: RerunScope[] = [
    { value: 'talk', label: 'One talk' },
    { value: 'selection', label: 'A selection' },
    { value: 'course', label: 'A course' },
  ]
  if (!(input.master && !input.connected)) scopes.push({ value: 'all', label: 'Everything' })
  return scopes
}

/** Read-only line on a portal’s master page. The key itself is never shown. */
export function aiAccountLine(connected: boolean) {
  return `AI account: ${connected ? 'connected' : 'not connected'} (the portal admin connects it in Settings)`
}
