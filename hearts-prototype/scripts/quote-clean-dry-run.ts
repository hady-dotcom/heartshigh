/**
 * Dry-run: print learner-facing question text that a quote cleaner would change.
 * Does not write to the database.
 *
 *   npx tsx scripts/quote-clean-dry-run.ts
 */
import { cleanQuote, quoteNeedsClean } from '../src/lib/quote-clean'

type Row = { id?: number; prompt?: string; quote?: string; body?: string }

async function load(): Promise<{ source: string; rows: Row[] }> {
  const url = process.env.DATABASE_URL
  if (!url) {
    return { source: 'no database (set DATABASE_URL to scan stored questions)', rows: [] }
  }
  try {
    const { getPayload } = await import('payload')
    const config = (await import('../src/payload.config')).default
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 2000, pagination: false })
    return {
      source: 'engagement-points',
      rows: (found.docs as { id: number; prompt?: string }[]).map((row) => ({ id: row.id, prompt: row.prompt })),
    }
  } catch (error) {
    return { source: `could not open the database: ${error instanceof Error ? error.message : error}`, rows: [] }
  }
}

async function main() {
  const { source, rows } = await load()
  const changes: { id?: number; from: string; to: string }[] = []
  for (const row of rows) {
    const text = row.prompt || row.quote || row.body || ''
    if (!text || !quoteNeedsClean(text)) continue
    changes.push({ id: row.id, from: text, to: cleanQuote(text) })
  }
  console.log(`Quote cleaner dry-run. Source: ${source}.`)
  console.log(`Would change ${changes.length} of ${rows.length} rows. Nothing was written.`)
  for (const row of changes.slice(0, 40)) {
    console.log(`--- id ${row.id ?? '?'}`)
    console.log(`from: ${row.from}`)
    console.log(`to:   ${row.to}`)
  }
  if (changes.length > 40) console.log(`…and ${changes.length - 40} more.`)
}

void main()
