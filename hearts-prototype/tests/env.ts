import { readFileSync } from 'node:fs'
import path from 'node:path'

export const E2E_PORT = Number(process.env.HEARTS_E2E_PORT || 3100)
export const E2E_BASE = `http://127.0.0.1:${E2E_PORT}`
export const E2E_DATABASE = 'file:./data/hearts-test.db'

/** A seeded access code by its label. Codes are random on every reseed, so read them after global setup has run. */
export function seedCode(label: string) {
  const codes = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'seed-codes-test.json'), 'utf8')) as Record<string, string>
  if (!codes[label]) throw new Error(`No seeded access code labelled ${label}.`)
  return codes[label]
}
