import catalogue from './backgrounds.catalogue.json'

export type Brightness = 'light' | 'mid' | 'dark'

export type Background = {
  file: string
  slice: string
  landscape: string
  time: string
  season: string
  palette: string
  brightness: Brightness
  mood: string
}

const BRIGHTNESS = new Set<Brightness>(['light', 'mid', 'dark'])

function splitCsv(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else quoted = false
      } else current += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

/** The photographic catalogue: file, slice, landscape, time, season, palette, brightness, mood. */
export function parseCatalogue(csv: string): Background[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const header = splitCsv(lines[0] || '')
  const at = (name: string) => header.indexOf(name)
  const rows: Background[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line)
    const brightness = cells[at('brightness')] as Brightness
    const file = cells[at('file')] || ''
    if (!file || !BRIGHTNESS.has(brightness)) continue
    rows.push({
      file,
      slice: cells[at('slice')] || '',
      landscape: cells[at('landscape')] || '',
      time: cells[at('time')] || '',
      season: cells[at('season')] || '',
      palette: cells[at('palette')] || '',
      brightness,
      mood: cells[at('mood')] || '',
    })
  }
  return rows
}

export const CATALOGUE: Background[] = (catalogue as Background[]).filter((row) => row.file && BRIGHTNESS.has(row.brightness))

export function backgroundByFile(file: string | null | undefined) {
  const name = (file || '').trim()
  if (!name) return null
  return CATALOGUE.find((row) => row.file === name) || null
}

/** True when two stills would feel like the same picture sat next to each other. */
export function sharesLook(a: Pick<Background, 'landscape' | 'palette' | 'time'>, b: Pick<Background, 'landscape' | 'palette' | 'time'>) {
  return a.landscape === b.landscape || a.palette === b.palette || a.time === b.time
}

/**
 * The card's own still, or the next one that does not share landscape, palette or time
 * with the previous card. The same inputs always return the same still.
 */
export function pickBackground(catalogue: readonly Background[], preferred: string | number, previous: Pick<Background, 'file' | 'landscape' | 'palette' | 'time'> | null) {
  if (!catalogue.length) throw new Error('The background catalogue is empty')
  const count = catalogue.length
  const start = typeof preferred === 'number'
    ? preferred
    : catalogue.findIndex((row) => row.file === preferred)
  const origin = ((Math.max(0, start) % count) + count) % count
  if (!previous) return catalogue[origin]
  for (let step = 0; step < count; step++) {
    const row = catalogue[(origin + step) % count]
    if (sharesLook(row, previous)) continue
    return row
  }
  for (let step = 0; step < count; step++) {
    const row = catalogue[(origin + step) % count]
    if (row.file !== previous.file) return row
  }
  return catalogue[origin]
}

/**
 * Bucket root, read when a request is served so a deploy can set it.
 * `BACKGROUNDS_BASE_URL` is the bucket origin. Files live under `backgrounds/`
 * with the catalogue filename, for example `backgrounds/jpg/A-01-lake-predawn-violet.jpg`.
 */
export function readBackgroundsBaseUrl(env: Record<string, string | undefined> = process.env) {
  return (env.BACKGROUNDS_BASE_URL || '').trim().replace(/\/$/, '') || null
}

/** Absolute URL for a catalogue file. No base URL means the local stills are used instead. */
export function backgroundSrc(file: string, baseUrl: string | null | undefined) {
  const base = (baseUrl || '').trim().replace(/\/$/, '')
  const relative = file.replace(/^\/+/, '')
  if (!base || !relative) return null
  return `${base}/backgrounds/${relative}`
}
