export type PeopleExportRow = {
  name: string
  email: string
  role: string
  code: string
  joined: string
  lastSeen: string
  courses: string
  progress: string
  consent: string
  className?: string
}

export const PEOPLE_EXPORT_COLUMNS = ['name', 'email', 'role', 'code', 'joined', 'last seen', 'courses', 'progress', 'consent'] as const

function csvCell(value: string) {
  const text = value ?? ''
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function peopleCsv(rows: PeopleExportRow[]) {
  const header = PEOPLE_EXPORT_COLUMNS.join(',')
  const lines = rows.map((row) =>
    [row.name, row.email, row.role, row.code, row.joined, row.lastSeen, row.courses, row.progress, row.consent].map((value) => csvCell(String(value || ''))).join(','),
  )
  return [header, ...lines].join('\n') + '\n'
}

export function peopleExportGuard(rows: PeopleExportRow[]) {
  if (!rows.length) return 'Nobody matches this list, so the download stays still.'
  return null
}
