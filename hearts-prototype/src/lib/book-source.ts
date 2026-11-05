/** A frame taken from the source file, stored under public/book-stills. */
export function bookStillPath(id: string) {
  return /^\d{6,12}$/.test(id) ? `/book-stills/${id}.jpg` : ''
}

/** Only that still path may be painted. Anything else is refused. */
export function bookStillUrl(value: unknown) {
  const stored = String(value || '').trim()
  return /^\/book-stills\/\d{6,12}\.jpg$/.test(stored) ? stored : ''
}

/**
 * The length to store from a source file.
 * A length already on the film is left alone when it disagrees by more than 2 seconds.
 * A blank source file writes nothing.
 */
export function sourceDurationChoice(existingSeconds: number, ffprobeSeconds: number) {
  if (!Number.isFinite(ffprobeSeconds) || ffprobeSeconds <= 0) return { seconds: null as number | null, flagged: false }
  const rounded = Math.round(ffprobeSeconds)
  const current = Number.isFinite(existingSeconds) && existingSeconds > 0 ? existingSeconds : 0
  if (current > 0 && Math.abs(current - ffprobeSeconds) > 2) return { seconds: null, flagged: true }
  if (current === rounded) return { seconds: null, flagged: false }
  return { seconds: rounded, flagged: false }
}

export type BookSourceRow = { id: string; title: string; seconds: number | null }

/** Book Summaries source lengths. A blank duration stays unknown. */
export function readBookSource(raw: string): BookSourceRow[] {
  const table = parseCsv(raw)
  const header = table[0] || []
  const idAt = header.indexOf('vimeo_id')
  const titleAt = header.indexOf('title')
  const durationAt = header.indexOf('duration_seconds')
  if (idAt < 0 || titleAt < 0 || durationAt < 0) return []
  const rows: BookSourceRow[] = []
  for (const cells of table.slice(1)) {
    const id = String(cells[idAt] || '').trim()
    if (!/^\d{6,12}$/.test(id)) continue
    const duration = String(cells[durationAt] || '').trim()
    const seconds = duration ? Number(duration) : null
    rows.push({
      id,
      title: String(cells[titleAt] || '').trim(),
      seconds: seconds != null && Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    })
  }
  return rows
}

function parseCsv(raw: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const text = raw.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((item) => item.trim()))
}
