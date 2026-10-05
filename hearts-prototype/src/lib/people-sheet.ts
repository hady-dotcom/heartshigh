import ExcelJS from 'exceljs'
import { authorTextProblems } from './opening-data'

/** Columns a madrasah list can carry. Extra columns are ignored. */
export const PEOPLE_COLUMNS = ['name', 'email', 'role', 'code', 'class'] as const
export type PeopleColumn = (typeof PEOPLE_COLUMNS)[number]

export type PeopleSheetIssue = { row: number; column: string; message: string }

export type PeopleSheetRow = {
  row: number
  name: string
  email: string
  role: 'learner' | 'teacher' | 'portal-admin'
  code: string
  className: string
  problems: PeopleSheetIssue[]
}

export type PeopleSheetPreview = {
  rows: PeopleSheetRow[]
  ready: PeopleSheetRow[]
  blocked: PeopleSheetRow[]
  errorTotal: number
}

const ROLE_ALIASES: Record<string, PeopleSheetRow['role']> = {
  learner: 'learner',
  student: 'learner',
  parent: 'learner',
  teacher: 'teacher',
  mentor: 'teacher',
  admin: 'portal-admin',
  'portal-admin': 'portal-admin',
  'portal admin': 'portal-admin',
}

const HEADER_ALIASES: Record<string, PeopleColumn> = {
  name: 'name',
  full_name: 'name',
  fullname: 'name',
  email: 'email',
  mail: 'email',
  role: 'role',
  type: 'role',
  code: 'code',
  access_code: 'code',
  accesscode: 'code',
  class: 'class',
  group: 'class',
  cohort: 'class',
}

function foldHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function cellText(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object' && value && 'text' in value) return String((value as { text?: unknown }).text || '').trim()
  return String(value).trim()
}

function parseCsvLine(line: string) {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (ch === ',' && !quoted) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

function splitCsv(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
}

export function parsePeopleCsv(text: string): { headers: PeopleColumn[]; rows: Record<PeopleColumn, string>[]; errors: PeopleSheetIssue[] } {
  const lines = splitCsv(text)
  const errors: PeopleSheetIssue[] = []
  if (!lines.length) return { headers: [...PEOPLE_COLUMNS], rows: [], errors: [{ row: 1, column: 'name', message: 'The list is empty.' }] }
  const rawHeaders = parseCsvLine(lines[0]).map((cell) => foldHeader(cell))
  const headers = rawHeaders.map((cell) => HEADER_ALIASES[cell]).filter(Boolean)
  if (!headers.includes('name') || !headers.includes('email')) {
    errors.push({ row: 1, column: 'name', message: 'The first row needs at least name and email.' })
  }
  const rows: Record<PeopleColumn, string>[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i])
    const row = { name: '', email: '', role: '', code: '', class: '' }
    rawHeaders.forEach((header, index) => {
      const key = HEADER_ALIASES[header]
      if (key) row[key] = cellText(cells[index])
    })
    rows.push(row)
  }
  return { headers: PEOPLE_COLUMNS.slice(), rows, errors }
}

async function workbookToRows(buffer: Buffer) {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const sheet = book.worksheets[0]
  if (!sheet) return parsePeopleCsv('')
  const lines: string[] = []
  sheet.eachRow((row) => {
    const values = (row.values as unknown[]).slice(1).map((cell) => {
      if (cell && typeof cell === 'object' && 'text' in (cell as object)) return cellText((cell as { text?: unknown }).text)
      if (cell && typeof cell === 'object' && 'result' in (cell as object)) return cellText((cell as { result?: unknown }).result)
      return cellText(cell)
    })
    lines.push(values.map((value) => (value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value)).join(','))
  })
  return parsePeopleCsv(lines.join('\n'))
}

export async function readPeopleList(input: { text?: string; file?: { name?: string; bytes: Buffer } }) {
  const name = (input.file?.name || '').toLowerCase()
  if (input.file && (name.endsWith('.xlsx') || name.endsWith('.xls'))) return workbookToRows(input.file.bytes)
  const text = input.text || (input.file ? input.file.bytes.toString('utf8') : '')
  return parsePeopleCsv(text)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function previewPeopleRows(
  parsed: { rows: Record<PeopleColumn, string>[]; errors?: PeopleSheetIssue[] },
  options: { codes: string[]; classes: string[]; schoolOfflineConsent?: boolean } = { codes: [], classes: [] },
): PeopleSheetPreview {
  const knownCodes = new Set(options.codes.map((code) => code.toUpperCase()))
  const knownClasses = new Set(options.classes.map((name) => name.trim().toLowerCase()))
  const seen = new Set<string>()
  const rows: PeopleSheetRow[] = []
  const headerErrors = parsed.errors || []
  parsed.rows.forEach((raw, index) => {
    const rowNumber = index + 2
    const problems: PeopleSheetIssue[] = headerErrors.filter((issue) => issue.row === 1).map((issue) => ({ ...issue, row: rowNumber }))
    const name = raw.name.trim()
    const email = raw.email.trim().toLowerCase()
    const role = ROLE_ALIASES[raw.role.trim().toLowerCase()] || (raw.role.trim() ? undefined : 'learner')
    const code = raw.code.trim().toUpperCase()
    const className = raw.class.trim()
    if (!name) problems.push({ row: rowNumber, column: 'name', message: 'A name is needed.' })
    else {
      const wording = authorTextProblems([['Name', name]])
      wording.forEach((message) => problems.push({ row: rowNumber, column: 'name', message }))
    }
    if (!email) problems.push({ row: rowNumber, column: 'email', message: 'An email is needed.' })
    else if (!EMAIL.test(email)) problems.push({ row: rowNumber, column: 'email', message: 'That email does not look right.' })
    else if (seen.has(email)) problems.push({ row: rowNumber, column: 'email', message: 'This email is on the list twice.' })
    if (email) seen.add(email)
    if (raw.role.trim() && !role) problems.push({ row: rowNumber, column: 'role', message: 'Role is learner, teacher or admin.' })
    if (!code) problems.push({ row: rowNumber, column: 'code', message: 'An access code is needed.' })
    else if (knownCodes.size && !knownCodes.has(code)) problems.push({ row: rowNumber, column: 'code', message: 'That access code is not in this portal.' })
    if (className && knownClasses.size && !knownClasses.has(className.toLowerCase())) {
      problems.push({ row: rowNumber, column: 'class', message: 'That class is not in this portal yet. Make it first, or leave the cell blank.' })
    }
    rows.push({
      row: rowNumber,
      name,
      email,
      role: role || 'learner',
      code,
      className,
      problems,
    })
  })
  const ready = rows.filter((row) => !row.problems.length)
  const blocked = rows.filter((row) => row.problems.length)
  return {
    rows,
    ready,
    blocked,
    errorTotal: blocked.reduce((total, row) => total + row.problems.length, 0) + headerErrors.length,
  }
}

/** First-cell rose, matching the master sheet's problem rows. */
export const PEOPLE_PROBLEM_FILL = 'FFF8D7DA'

export function peoplePreviewSummary(preview: PeopleSheetPreview) {
  return {
    total: preview.rows.length,
    ready: preview.ready.length,
    blocked: preview.blocked.length,
    errorTotal: preview.errorTotal,
  }
}
