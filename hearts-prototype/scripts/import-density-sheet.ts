import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { closePayload } from '../src/lib/prepare-db'
import { applyPlan, planBuffer, summaryOf, type SheetScope } from '../src/server/master-sheet'
import { densityReport } from '../src/lib/extracts'
import { extractsForLesson } from '../src/server/extracts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sheet = process.argv[2] || path.join(root, 'content/sheets/hearts-density-30-extracts.xlsx')
const logPath = process.argv[3] || path.join(root, 'artifacts/talk-extracts/import-log.txt')

const scope: SheetScope = { kind: 'library', portalId: null, courseId: null, desk: 'master' }

const payload = await getPayload({ config })
const buffer = readFileSync(sheet)
const { plan } = await planBuffer(payload, scope, buffer, {})
const summary = summaryOf(plan, path.basename(sheet))
const lines: string[] = []
const say = (line: string) => {
  lines.push(line)
  console.log(line)
}

say(`Sheet: ${sheet}`)
say(`Plan: ${plan.ops.length} ops, ${plan.errors.length} errors, ${plan.warnings.length} warnings, ${plan.unchanged} unchanged, ${plan.skipped} skipped`)
say(`Summary: ${JSON.stringify(summary.counts)}`)
if (plan.errors.length) {
  for (const issue of plan.errors.slice(0, 40)) say(`ERROR ${issue.tab} r${issue.row} ${issue.column}: ${issue.message}`)
  if (plan.errors.length > 40) say(`... ${plan.errors.length - 40} more errors`)
  await closePayload(payload)
  process.exit(1)
}
say(`Warnings (first 12):`)
for (const issue of plan.warnings.slice(0, 12)) say(`  ${issue.tab} r${issue.row} ${issue.column}: ${issue.message}`)

const master = (await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: 'master@hearts.test' } } })).docs[0]
const snapshot = await applyPlan(payload, plan, master?.id || null)
const createdCounts = Object.fromEntries(Object.entries(snapshot.created).map(([key, ids]) => [key, ids.length]))
say(`Applied. Created counts: ${JSON.stringify(createdCounts)}`)

const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false })
const extracts = await payload.find({ collection: 'talk-extracts', overrideAccess: true, depth: 0, limit: 0, pagination: false })
const points = await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 0, pagination: false })
const byKind: Record<string, number> = {}
const byStatus: Record<string, number> = {}
const byLesson = new Map<number, number>()
let parents = 0
let imported = 0
for (const row of extracts.docs) {
  const kind = String(row.kind)
  const status = String(row.status || 'blank')
  byKind[kind] = (byKind[kind] || 0) + 1
  byStatus[`${kind}:${status}`] = (byStatus[`${kind}:${status}`] || 0) + 1
  if (row.parent) parents += 1
  if (row.source === 'master sheet') imported += 1
  const lessonId = typeof row.lesson === 'object' && row.lesson ? Number((row.lesson as { id?: number }).id) : Number(row.lesson)
  if (lessonId) byLesson.set(lessonId, (byLesson.get(lessonId) || 0) + 1)
}
const drafts = points.docs.filter((point) => point.status === 'draft').length
const denseTalks = [...lessons.docs].filter((lesson) => (byLesson.get(lesson.id) || 0) >= 10)
say(`Talks (lessons): ${lessons.totalDocs} (${denseTalks.length} with 10 or more extracts from the density sheets)`)
say(`Extracts: ${extracts.totalDocs} ${JSON.stringify(byKind)} (${imported} from the master sheet)`)
say(`Extract status: ${JSON.stringify(byStatus)}`)
say(`Parent links set: ${parents}`)
say(`Questions: ${points.totalDocs} (${drafts} draft)`)

const sample = [...lessons.docs]
  .sort((a, b) => (byLesson.get(b.id) || 0) - (byLesson.get(a.id) || 0))
  .slice(0, 3)
say('Density (approved vs target; suggested still waiting). Target is 1 hors per 6 min and 1 appetiser per 15 min:')
for (const lesson of sample) {
  const own = await extractsForLesson(payload, lesson.id)
  const report = densityReport(Number(lesson.durationSeconds || 0), own)
  say(
    `  ${lesson.title}: ${Math.round(report.minutes)} min · hors ${report.hors} approved / ${report.horsSuggested} suggested of ${report.horsTarget} · appetisers ${report.appetiser} approved / ${report.appetiserSuggested} suggested of ${report.appetiserTarget}`,
  )
}

mkdirSync(path.dirname(logPath), { recursive: true })
writeFileSync(logPath, `${lines.join('\n')}\n`)
say(`Wrote ${logPath}`)
await closePayload(payload)
process.exit(0)
