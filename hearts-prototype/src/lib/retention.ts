import { now } from './clock'

/** How long HEARTS keeps each kind of row. This table also feeds the privacy notice (L01). */

export type RetentionRule = {
  id: string
  label: string
  keep: string
  days: number
  collection?: string
  /** When the collection is missing (unmerged lane), the job skips it. */
  optional?: boolean
  dateField: string
  extraWhere?: Record<string, unknown>
  note: string
}

export const RETENTION_RULES: RetentionRule[] = [
  {
    id: 'watch-sessions',
    label: 'Watch sessions',
    keep: '12 months',
    days: 365,
    collection: 'watch-sessions',
    dateField: 'createdAt',
    note: 'Which parts someone sat with, when they chose to share that detail.',
  },
  {
    id: 'insight-events',
    label: 'Insight and experiment events',
    keep: '13 months, or aggregates only after that',
    days: 396,
    collection: 'insight-events',
    optional: true,
    dateField: 'createdAt',
    note: 'Counts used for the insights desk. After this, only totals of ten or more stay.',
  },
  {
    id: 'experiment-events',
    label: 'Experiment events',
    keep: '13 months',
    days: 396,
    collection: 'experiment-events',
    optional: true,
    dateField: 'createdAt',
    note: 'Rows from the experiments desk. Same window as insights.',
  },
  {
    id: 'view-as-sessions',
    label: 'View-as sessions',
    keep: '90 days',
    days: 90,
    collection: 'view-as-sessions',
    dateField: 'startedAt',
    note: 'Who viewed as whom, and the reason. The audit log keeps a shorter fact for two years.',
  },
  {
    id: 'audit-ip',
    label: 'IP hashes on the audit log',
    keep: '90 days',
    days: 90,
    collection: 'audit-log',
    dateField: 'at',
    extraWhere: { ipHash: { exists: true } },
    note: 'The hashed address is cleared. The event itself stays for two years.',
  },
  {
    id: 'audit-log',
    label: 'Audit log',
    keep: '2 years',
    days: 730,
    collection: 'audit-log',
    dateField: 'at',
    note: 'Who changed a person, a role, a code or a portal. After two years the row is removed.',
  },
  {
    id: 'rate-hits',
    label: 'Rate-limit rows',
    keep: '1 day',
    days: 1,
    collection: 'rate-hits',
    optional: true,
    dateField: 'createdAt',
    note: 'Sign-in and action counters. They are only needed for a day.',
  },
  {
    id: 'closed-portals',
    label: 'Deactivated portals',
    keep: '90 days, then the master is asked to wipe or keep',
    days: 90,
    collection: 'portals',
    dateField: 'updatedAt',
    extraWhere: { closed: { equals: true } },
    note: 'A closed portal is not wiped automatically. After 90 days the System page asks the master.',
  },
]

export function retentionCutoff(rule: RetentionRule, when: Date = now()) {
  return new Date(when.getTime() - rule.days * 86_400_000)
}

export function retentionTable() {
  return RETENTION_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    keep: rule.keep,
    note: rule.note,
  }))
}

export type RetentionPlanItem = {
  id: string
  collection: string
  optional?: boolean
  dateField: string
  before: string
  extraWhere?: Record<string, unknown>
  mode: 'delete' | 'clear-ip' | 'ask-master'
}

/** What the nightly job will do. Pure: no database. */
export function planRetention(when: Date = now()): RetentionPlanItem[] {
  return RETENTION_RULES.map((rule) => {
    const before = retentionCutoff(rule, when).toISOString()
    let mode: RetentionPlanItem['mode'] = 'delete'
    if (rule.id === 'audit-ip') mode = 'clear-ip'
    if (rule.id === 'closed-portals') mode = 'ask-master'
    return {
      id: rule.id,
      collection: rule.collection || rule.id,
      optional: rule.optional,
      dateField: rule.dateField,
      before,
      extraWhere: rule.extraWhere,
      mode,
    }
  })
}
