import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PARENTING_DEMO_CODE } from '../src/lib/parenting-demo'
import { parseCourseSheet } from '../src/lib/sequence'
import { buildExportZip, courseFilmsToExport } from '../src/lib/sequence-export'

const root = path.join(import.meta.dirname, '..')
const sheet = readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8')
const parsed = parseCourseSheet(sheet)
if (parsed.error || !parsed.films.length) throw new Error(parsed.error || 'No films in the course sheet.')
const videos = courseFilmsToExport(parsed.films)
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
