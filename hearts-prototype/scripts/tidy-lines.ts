/**
 * Back-fills tidied hors d'oeuvre and appetiser lines onto every talk tier.
 * The raw captions stay where they are. This uses the built-in tidy only. It never calls a model.
 *
 * Only lineTidy is written, so timings saved before the nesting rule never block it. Those tiers are listed at the
 * end for a person to re-time.
 *
 *   npm run tidy:lines
 *   npm run tidy:lines -- --dry-run
 *   npm run tidy:lines -- --report    (lists the tiers whose hors d'oeuvre straddles two cuts, changes nothing)
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { straddlingTiers } from '../src/lib/tiers'
import { buildLineTidy, parseLineTidy, tidyUnchanged, type CaptionSources } from '../src/lib/tidy-caption'

const reportOnly = process.argv.includes('--report')
const dryRun = reportOnly || process.argv.includes('--dry-run')
await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

type Row = Record<string, unknown> & { id: number }

function sourcesOf(row: Row, speaker: string): CaptionSources {
  const horsLines = (Array.isArray(row.horsLines) ? row.horsLines : []) as { at?: number; text?: string }[]
  return {
    speaker,
    quote: String(row.horsQuote || ''),
    hook: String(row.hook || ''),
    turn: String(row.turn || ''),
    land: String(row.land || ''),
    horsLines: horsLines.filter((line) => typeof line?.text === 'string').map((line) => ({ at: Number(line.at) || 0, text: String(line.text) })),
  }
}

let skipped = 0
let written = 0
let failed = 0

try {
  const found = await payload.find({ collection: 'talk-tiers', overrideAccess: true, depth: 1, limit: 0, pagination: false })
  for (const doc of (reportOnly ? [] : found.docs) as unknown as Row[]) {
    const lesson = doc.lesson as { speaker?: string } | number | null
    const speaker = lesson && typeof lesson === 'object' ? String(lesson.speaker || '') : ''
    const sources = sourcesOf(doc, speaker)
    if (!sources.quote && !sources.hook && !sources.turn && !sources.land && !sources.horsLines.length) {
      skipped += 1
      continue
    }
    if (tidyUnchanged(parseLineTidy(doc.lineTidy), sources, false)) {
      skipped += 1
      continue
    }
    const lineTidy = buildLineTidy(sources)
    if (dryRun) {
      console.log(`Would tidy talk tier ${doc.id} (${lineTidy.source}): ${lineTidy.hook.text || lineTidy.quote.text}`)
      written += 1
      continue
    }
    try {
      await payload.update({ collection: 'talk-tiers', id: doc.id, overrideAccess: true, data: { lineTidy } as never })
      written += 1
    } catch (error) {
      failed += 1
      console.error(`Talk tier ${doc.id} was not saved: ${error instanceof Error ? error.message : 'error'}`)
    }
  }
  if (!reportOnly) console.log(`${dryRun ? 'Dry run. ' : ''}${written} tidied, ${skipped} already tidy, ${failed} failed.`)
  const straddling = straddlingTiers(found.docs as unknown as Row[])
  if (straddling.length) {
    console.log(`\n${straddling.length} talk tiers have a hors d'oeuvre across two appetiser cuts. Re-time them on /master/tiers:`)
    for (const row of straddling) console.log(`  tier ${row.id}${row.title ? ` (${row.title})` : ''}: ${row.problem}`)
  } else if (reportOnly) {
    console.log("Every hors d'oeuvre sits inside one appetiser cut.")
  }
} finally {
  await closePayload(payload)
}

process.exit(failed ? 1 : 0)
