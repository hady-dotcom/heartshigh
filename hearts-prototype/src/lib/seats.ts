export type SeatCard = { id: number; clause: number; position: number; text: string }

const STOP = new Set(
  'the and that this with from your you are was were for have has had not but they them his her she its our out about into just like what when there then than been being would could should vol same also later grain thin strong pages first second third which'.split(' '),
)

function terms(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  )
}

/**
 * Suggest one of the clause's three seats by shared words with the cut.
 * Returns null when nothing overlaps, so the admin sees "no seat yet" rather than an invented one.
 */
export function suggestSeat(text: string, clause: number | null, seats: SeatCard[]): SeatCard | null {
  if (!clause) return null
  const words = terms(text)
  let best: { seat: SeatCard; hits: number } | null = null
  for (const seat of seats.filter((row) => row.clause === clause)) {
    let hits = 0
    for (const word of terms(seat.text)) if (words.has(word)) hits += 1
    if (hits > 0 && (!best || hits > best.hits)) best = { seat, hits }
  }
  return best?.seat ?? null
}

export type ClauseEntry = { number: number; teaching: string; seats: string[]; series: string }

function clean(text: string) {
  return text.replace(/\s+/g, ' ').replace(/\s—\s/g, ', ').replace(/—/g, ', ').trim()
}

/**
 * Read the teaching line, the three seats and the series hang for each clause
 * from the curriculum map in content/jibril-map.txt. Nothing is written that is not in the map.
 */
export function parseJibrilMap(source: string): Map<number, ClauseEntry> {
  const lines = source.replace(/\r\n/g, '\n').replace(/\f/g, '\n').split('\n')
  const entries = new Map<number, ClauseEntry>()
  const heading = /^\s*(\d(?:\s?\d)?)\s*·\s*…/
  let index = 0
  while (index < lines.length) {
    const match = lines[index].match(heading)
    if (!match) {
      index += 1
      continue
    }
    const number = Number(match[1].replace(/\s+/g, ''))
    const block: string[] = []
    index += 1
    while (index < lines.length && !heading.test(lines[index]) && !/^\s*[IV]+\.\s/.test(lines[index]) && !/^\s*\d\.\s+Videos/.test(lines[index])) {
      block.push(lines[index])
      index += 1
    }
    const body = block.join('\n')
    const teaching = body.match(/TEACHING\.\s*([\s\S]*?)(?=THREE SEATS\.|$)/)?.[1] || ''
    const seatsRaw = body.match(/THREE SEATS\.\s*([\s\S]*?)(?=FROM THE SERIES\.|$)/)?.[1] || ''
    const series = body.match(/FROM THE SERIES\.\s*([\s\S]*?)$/)?.[1] || ''
    const seats = clean(seatsRaw)
      .split(/\(\d\)\s*/)
      .slice(1)
      .map((seat) => seat.trim().replace(/[.;]\s*$/, ''))
      .filter(Boolean)
    if (number >= 1 && number <= 41 && !entries.has(number)) {
      entries.set(number, { number, teaching: clean(teaching), seats: seats.slice(0, 3), series: clean(series) })
    }
  }
  return entries
}
