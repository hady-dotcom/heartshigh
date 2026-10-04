/**
 * Back-fills tidied hors d'oeuvre and appetiser lines onto every talk tier.
 * The raw captions stay where they are. Running it again changes nothing, unless a model key
 * has appeared and a row is still the deterministic tidy.
 *
 * Only lineTidy is written, so timings saved before the nesting rule never block it. Those tiers are listed at the
 * end for a person to re-time.
 *
 *   npm run tidy:lines
 *   npm run tidy:lines -- --dry-run
 *   npm run tidy:lines -- --report    (lists the tiers whose hors d'oeuvre straddles two cuts, changes nothing)
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { stepBySlug } from '../src/lib/ai-steps'
import { straddlingTiers } from '../src/lib/tiers'
import { buildLineTidy, parseLineTidy, tidyUnchanged, type CaptionSources, type TidyLine } from '../src/lib/tidy-caption'

const reportOnly = process.argv.includes('--report')
const dryRun = reportOnly || process.argv.includes('--dry-run')
const spec = stepBySlug('tidy-caption-line')

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

function linesFor(sources: CaptionSources) {
  const rows = [
    ...sources.horsLines.map((line) => `hors\t${line.at}\t${line.text}`),
    sources.hook ? `hook\t0\t${sources.hook}` : '',
    sources.turn ? `turn\t0\t${sources.turn}` : '',
    sources.land ? `land\t0\t${sources.land}` : '',
    sources.quote ? `quote\t0\t${sources.quote}` : '',
  ]
  return rows.filter(Boolean).join('\n')
}

async function askModel(sources: CaptionSources): Promise<TidyLine[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key || !spec) return null
  const prompt = spec.prompt.replaceAll('{{SPEAKER}}', sources.speaker || 'the speaker').replaceAll('{{LINES}}', linesFor(sources))
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: spec.model,
      temperature: spec.temperature,
      max_tokens: spec.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only the JSON object the user asks for.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenAI ${response.status}`)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}') as { lines?: TidyLine[] }
  return Array.isArray(parsed.lines) ? parsed.lines : null
}

let skipped = 0
let written = 0
let failed = 0

try {
  const found = await payload.find({ collection: 'talk-tiers', overrideAccess: true, depth: 1, limit: 0, pagination: false })
  const aiAvailable = Boolean(process.env.OPENAI_API_KEY)
  for (const doc of (reportOnly ? [] : found.docs) as unknown as Row[]) {
    const lesson = doc.lesson as { speaker?: string } | number | null
    const speaker = lesson && typeof lesson === 'object' ? String(lesson.speaker || '') : ''
    const sources = sourcesOf(doc, speaker)
    if (!sources.quote && !sources.hook && !sources.turn && !sources.land && !sources.horsLines.length) {
      skipped += 1
      continue
    }
    if (tidyUnchanged(parseLineTidy(doc.lineTidy), sources, aiAvailable)) {
      skipped += 1
      continue
    }
    let chosen: TidyLine[] = []
    if (aiAvailable) {
      try {
        chosen = (await askModel(sources)) || []
      } catch (error) {
        console.error(`Talk tier ${doc.id}: the model did not answer (${error instanceof Error ? error.message : 'error'}). The built-in tidy is used.`)
      }
    }
    const pure = buildLineTidy(sources)
    const mixed = buildLineTidy(sources, chosen, 'fallback')
    const usedModel = JSON.stringify({ ...mixed, source: '' }) !== JSON.stringify({ ...pure, source: '' })
    const lineTidy = { ...mixed, source: usedModel ? 'ai' as const : 'fallback' as const }
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
