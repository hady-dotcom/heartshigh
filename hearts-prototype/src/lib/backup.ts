import { createHash } from 'node:crypto'

export const BACKUP_RETENTION = {
  dailyDays: 14,
  weeklyWeeks: 8,
  monthlyMonths: 12,
} as const

export type CountMap = Record<string, number>

export type RestoreReport = {
  ok: boolean
  at: string
  source: string
  destination: string
  database: { before: CountMap; after: CountMap; matched: boolean }
  files: { before: number; after: number; matched: boolean }
  notes: string[]
}

export function countTables(rows: { name: string; count: number }[]) {
  const map: CountMap = {}
  for (const row of rows) map[row.name] = row.count
  return map
}

export function countsMatch(before: CountMap, after: CountMap) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const name of names) {
    if ((before[name] || 0) !== (after[name] || 0)) return false
  }
  return true
}

export function fileFingerprint(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function lifecyclePrefix(when: Date, kind: 'daily' | 'weekly' | 'monthly') {
  const year = when.getUTCFullYear()
  const month = String(when.getUTCMonth() + 1).padStart(2, '0')
  const day = String(when.getUTCDate()).padStart(2, '0')
  if (kind === 'monthly') return `monthly/${year}-${month}`
  if (kind === 'weekly') {
    const start = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()))
    const weekday = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() - weekday + 1)
    return `weekly/${start.toISOString().slice(0, 10)}`
  }
  return `daily/${year}-${month}-${day}`
}

export function shouldKeepBackup(kind: 'daily' | 'weekly' | 'monthly', ageDays: number) {
  if (kind === 'daily') return ageDays <= BACKUP_RETENTION.dailyDays
  if (kind === 'weekly') return ageDays <= BACKUP_RETENTION.weeklyWeeks * 7
  return ageDays <= BACKUP_RETENTION.monthlyMonths * 31
}

export function buildRestoreReport(input: {
  at: string
  source: string
  destination: string
  before: CountMap
  after: CountMap
  filesBefore: number
  filesAfter: number
  notes?: string[]
}): RestoreReport {
  const matched = countsMatch(input.before, input.after)
  const filesMatched = input.filesBefore === input.filesAfter
  const notes = [...(input.notes || [])]
  if (!matched) notes.push('Row counts do not match.')
  if (!filesMatched) notes.push('File counts do not match.')
  return {
    ok: matched && filesMatched,
    at: input.at,
    source: input.source,
    destination: input.destination,
    database: { before: input.before, after: input.after, matched },
    files: { before: input.filesBefore, after: input.filesAfter, matched: filesMatched },
    notes,
  }
}
