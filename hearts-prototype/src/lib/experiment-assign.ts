/**
 * Deterministic sticky assignment. The same learner (or device) always lands on the
 * same variant for an experiment, and the bucket follows the variant weights.
 */

export type WeightRow = { key: string; weight: number }

/** FNV-1a 32-bit. Stable across Node and the browser. */
export function hash32(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function subjectKey(kind: 'learner' | 'device', id: string | number) {
  return `${kind}:${String(id).trim()}`
}

/** Integer 0..9999 inclusive, sticky for experiment + subject. */
export function assignmentBucket(experimentKey: string, subject: string) {
  return hash32(`${experimentKey}\0${subject}`) % 10_000
}

export function pickWeighted(rows: WeightRow[], bucket: number): string | null {
  const usable = rows.filter((row) => row.key && Number(row.weight) > 0)
  if (!usable.length) return rows[0]?.key || null
  const total = usable.reduce((sum, row) => sum + Number(row.weight), 0)
  if (!(total > 0)) return usable[0].key
  const unit = 10_000 / total
  let cursor = 0
  const slot = ((bucket % 10_000) + 10_000) % 10_000
  for (const row of usable) {
    cursor += Number(row.weight) * unit
    if (slot < cursor) return row.key
  }
  return usable[usable.length - 1].key
}

export function assignByHash(experimentKey: string, subject: string, rows: WeightRow[]): string | null {
  if (!experimentKey || !subject || !rows.length) return null
  return pickWeighted(rows, assignmentBucket(experimentKey, subject))
}

/** Find a subject id that hashes onto a given variant. Used by tests. */
export function subjectForVariant(experimentKey: string, rows: WeightRow[], variantKey: string, prefix = 's'): string | null {
  for (let index = 0; index < 20_000; index++) {
    const subject = `${prefix}${index}`
    if (assignByHash(experimentKey, subject, rows) === variantKey) return subject
  }
  return null
}

export function splitSubjects(experimentKey: string, rows: WeightRow[], count = 2, prefix = 's'): string[] {
  const keys = [...new Set(rows.map((row) => row.key))]
  const found: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < 40_000 && found.length < Math.min(count, keys.length); index++) {
    const subject = `${prefix}${index}`
    const picked = assignByHash(experimentKey, subject, rows)
    if (picked && !seen.has(picked)) {
      seen.add(picked)
      found.push(subject)
    }
  }
  return found
}
