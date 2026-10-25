import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SAMPLE_GAP_ANSWERS } from '../src/lib/sample-gap-data'
import { OPENING_QUESTIONS, loadRealAnswers, phaseLabel } from '../src/lib/parent-feedback'
import { PARENTING_DEMO_CODE } from '../src/lib/parenting-demo'
import { parseCourseSheet } from '../src/lib/sequence'
import { buildExportZip, courseFilmsToExport, type ExportAnswer } from '../src/lib/sequence-export'

const root = path.join(import.meta.dirname, '..')
const sheet = readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8')
const parsed = parseCourseSheet(sheet)
if (parsed.error || !parsed.films.length) throw new Error(parsed.error || 'No films in the course sheet.')
const videos = courseFilmsToExport(parsed.films)
const real: ExportAnswer[] = loadRealAnswers().map((row) => ({
  order: row.videoOrder,
  phase: row.phase,
  label: phaseLabel(row.phase),
  question: row.question,
  text: row.text,
}))
const samples: ExportAnswer[] = SAMPLE_GAP_ANSWERS.map((row) => ({
  order: row.order,
  phase: 'Sample',
  label: 'Sample answer',
  question: row.prompt,
  text: row.body,
  sample: true,
}))
const zip = buildExportZip(
  {
    name: 'Guiding Home Learning',
    slug: 'parenting',
    colour: '#1f3a5f',
    accent: '#e07a5f',
    logoUrl: '',
    lockOrder: true,
    note: 'Watch the films in order.',
    joinCode: PARENTING_DEMO_CODE,
    brandName: 'Hady Home',
    opening: OPENING_QUESTIONS.map((question) => ({ prompt: question.prompt, options: question.options })),
    answers: [...real, ...samples],
  },
  videos,
)
const text = zip.toString('utf8')
if (!text.includes('PARENT-DEMO') || !text.includes('Open index.html')) throw new Error('The export is missing the join code.')
if (/drive\.google|docs\.google/i.test(text)) throw new Error('The export still has a private link.')
const out = path.join(import.meta.dirname, '../public/downloads/guiding-home-learning.zip')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, zip)
console.log(`Wrote ${out} (${zip.length} bytes, ${videos.length} films)`)
