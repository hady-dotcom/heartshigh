import { LEARNER_CONSENT_KINDS, type LegalKind } from './legal'
import { childDefaults, isAgeBand, type AgeBand, type ChildDefaults } from './child-safety'

export type ConsentKind = 'privacy' | 'terms' | 'guidelines' | 'guardian' | 'email-news' | 'portal-agreement'

export type CurrentLegal = { kind: LegalKind; version: string; summary: string; title: string }

export type RecordedConsent = { kind: string; version: string; acceptedAt?: string | null }

export type AgeState = {
  ageBand: AgeBand | null
  waitingForGuardian: boolean
  guardianAcceptedAt: string | null
  schoolOfflineAt: string | null
  guardianEmail: string | null
}

export const CONSENT_FREE_ACTIONS = new Set([
  'login',
  'logout',
  'join',
  'forgot-password',
  'reset-password',
  'clock',
  'accept-consent',
  'request-guardian',
  'confirm-guardian',
  'staff-guardian-consent',
  'save-portal-contacts',
  'save-children-settings',
  'mark-child-code',
  'save-legal-page',
  'publish-legal-page',
  'portal-agreement',
  'help-request',
  'help-request-close',
])

export function missingLearnerConsents(current: CurrentLegal[], recorded: RecordedConsent[]) {
  const have = new Map(recorded.map((row) => [`${row.kind}:${row.version}`, row]))
  return current.filter((page) => LEARNER_CONSENT_KINDS.includes(page.kind as (typeof LEARNER_CONSENT_KINDS)[number]) && !have.has(`${page.kind}:${page.version}`))
}

export function needsLearnerConsent(role: string | null | undefined, current: CurrentLegal[], recorded: RecordedConsent[]) {
  if (role !== 'learner') return false
  return missingLearnerConsents(current, recorded).length > 0
}

export function guardianIsInPlace(age: AgeState | null) {
  if (!age || age.ageBand !== 'under-13') return true
  return Boolean(age.guardianAcceptedAt || age.schoolOfflineAt)
}

export function childState(age: AgeState | null): ChildDefaults {
  return childDefaults(age?.ageBand, Boolean(age && age.ageBand === 'under-13' && !guardianIsInPlace(age)))
}

export function consentAllowedAction(action: string) {
  return CONSENT_FREE_ACTIONS.has(action)
}

export function parseAgeBand(value: unknown): AgeBand | null {
  return isAgeBand(value) ? value : null
}

export function guardianStatusLabel(age: AgeState | null) {
  if (!age || age.ageBand !== 'under-13') return 'Not needed'
  if (age.guardianAcceptedAt) return 'Yes, a grown-up agreed'
  if (age.schoolOfflineAt) return 'Yes, the school collected it'
  if (age.waitingForGuardian) return 'Waiting'
  return 'Waiting'
}
