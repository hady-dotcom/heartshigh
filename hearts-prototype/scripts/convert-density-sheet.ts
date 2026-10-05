import ExcelJS from 'exceljs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXTRACT_COLUMNS, EXTRACT_NOTE, EXTRACT_TAB } from '../src/lib/master-sheet'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2] || '/home/ubuntu/.cursor/projects/workspace/uploads/hearts-density-20-import_1867.xlsx'
const dest = process.argv[3] || path.join(root, 'content/sheets/hearts-density-20-extracts.xlsx')

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(src)

const talks = wb.getWorksheet('Talks')
if (!talks) throw new Error('The density sheet has no Talks tab.')
const header = talks.getRow(2)
const col = new Map<string, number>()
header.eachCell((cell, index) => col.set(String(cell.value || ''), index))
const val = (row: ExcelJS.Row, name: string) => row.getCell(col.get(name) || 0).value

const extractRows: Record<string, string | number | null>[] = []
let talksCount = 0
talks.eachRow((row, number) => {
  if (number <= 2) return
  const talkKey = String(val(row, 'talk_key') || '')
  const youtube = String(val(row, 'youtube_id') || '')
  if (!talkKey && !youtube) return
  talksCount += 1
  const statusCell = row.getCell(col.get('status') || 0)
  if (!String(statusCell.value || '').trim() || String(statusCell.value) === 'draft') statusCell.value = 'checked'
  const horsIn = Number(val(row, 'hors_in'))
  const horsOut = Number(val(row, 'hors_out'))
  const appIn = Number(val(row, 'app_in'))
  const appOut = Number(val(row, 'app_out'))
  const hook = String(val(row, 'hook_text') || '')
  const turn = String(val(row, 'turn_text') || '')
  const land = String(val(row, 'land_text') || '')
  const third = (appOut - appIn) / 3
  extractRows.push({
    talk_key: talkKey,
    youtube_id: youtube,
    extract_id: null,
    extract_type: 'appetiser',
    start: appIn,
    end: appOut,
    text: land || hook,
    score: null,
    status: 'suggested',
    order: 1,
    door: null,
    seat: null,
    arc: null,
    parent_start: null,
    words: null,
    hook_text: hook,
    turn_text: turn,
    land_text: land,
    notes: 'Density study pair. Parent links are computed by time overlap until the follow-up file arrives.',
  })
  extractRows.push({
    talk_key: talkKey,
    youtube_id: youtube,
    extract_id: null,
    extract_type: 'hors',
    start: horsIn,
    end: horsOut,
    text: hook || land,
    score: null,
    status: 'suggested',
    order: 2,
    door: null,
    seat: null,
    arc: horsIn + (horsOut - horsIn) / 2 < appIn + third ? 'hook' : horsIn + (horsOut - horsIn) / 2 < appIn + third * 2 ? 'turn' : 'land',
    parent_start: appIn,
    words: null,
    hook_text: null,
    turn_text: null,
    land_text: null,
    notes: 'Drawn from inside the appetiser on this talk.',
  })
})

const held = wb.getWorksheet(EXTRACT_TAB)
if (held) wb.removeWorksheet(held.id)
const sheet = wb.addWorksheet(EXTRACT_TAB)
const note = sheet.addRow([EXTRACT_NOTE])
sheet.mergeCells(1, 1, 1, EXTRACT_COLUMNS.length)
note.height = 48
note.font = { italic: true, color: { argb: 'FF5C5648' }, size: 11 }
note.alignment = { wrapText: true, vertical: 'middle' }
const head = sheet.addRow([...EXTRACT_COLUMNS])
head.font = { bold: true }
for (const data of extractRows) sheet.addRow(EXTRACT_COLUMNS.map((name) => data[name] ?? null))

await wb.xlsx.writeFile(dest)
console.log(`Wrote ${talksCount} talks and ${extractRows.length} extracts to ${dest}`)
