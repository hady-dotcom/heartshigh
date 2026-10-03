// Hadith Jibril as learners meet it: 20 working doors over the 41 clauses. Talks, questions and the sheet keep
// their clause; a talk's door is always derived from it. Pure module, safe in the browser.

export const DOOR_SECTIONS = ['Sitting', 'Islam', 'Iman', 'Ihsan', 'Hour', 'Trunk'] as const
export type DoorSection = (typeof DOOR_SECTIONS)[number]
export type Door = { number: number; section: DoorSection; title: string; clauses: number[] }

export const DOORS: Door[] = [
  { number: 1, section: 'Sitting', title: 'One day', clauses: [1] },
  { number: 2, section: 'Sitting', title: 'The sitting: how he came and sat with the Messenger', clauses: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { number: 3, section: 'Islam', title: 'About Islam', clauses: [13, 19, 20] },
  { number: 4, section: 'Islam', title: 'Two testimonies', clauses: [14] },
  { number: 5, section: 'Islam', title: 'Prayer', clauses: [15] },
  { number: 6, section: 'Islam', title: 'Zakat', clauses: [16] },
  { number: 7, section: 'Islam', title: 'Fasting Ramadan', clauses: [17] },
  { number: 8, section: 'Islam', title: 'Hajj', clauses: [18] },
  { number: 9, section: 'Iman', title: 'About iman', clauses: [21, 28] },
  { number: 10, section: 'Iman', title: 'Believe in Allah', clauses: [22] },
  { number: 11, section: 'Iman', title: 'His angels', clauses: [23] },
  { number: 12, section: 'Iman', title: 'His Books', clauses: [24] },
  { number: 13, section: 'Iman', title: 'His Messengers', clauses: [25] },
  { number: 14, section: 'Iman', title: 'The Last Day', clauses: [26] },
  { number: 15, section: 'Iman', title: 'Qadar, good and evil', clauses: [27] },
  { number: 16, section: 'Ihsan', title: 'Ihsan: worship as though you see Him', clauses: [29, 30, 31] },
  { number: 17, section: 'Hour', title: 'The Hour: when, and what cannot be known', clauses: [32, 33] },
  { number: 18, section: 'Hour', title: 'The Hour: the two signs', clauses: [34, 35] },
  { number: 19, section: 'Trunk', title: 'It was Jibril', clauses: [36, 37, 38, 39, 40] },
  { number: 20, section: 'Trunk', title: 'He came to teach you your religion', clauses: [41] },
]

export const DOOR_COUNT = DOORS.length

/** The desk's working code for a door: W1 to W20. */
export function doorCode(number: number) {
  return `W${number}`
}

/** "W3 · About Islam", the label admins see first. */
export function doorLabel(door: Pick<Door, 'number' | 'title'>) {
  return `${doorCode(door.number)} · ${door.title}`
}

export function doorOfClause(clause: number | null | undefined, doors: Door[] = DOORS): Door | null {
  if (!clause) return null
  return doors.find((door) => door.clauses.includes(clause)) || null
}

export function doorNumberOfClause(clause: number | null | undefined, doors: Door[] = DOORS): number | null {
  return doorOfClause(clause, doors)?.number ?? null
}

export function doorByNumber(number: number | null | undefined, doors: Door[] = DOORS): Door | null {
  if (!number) return null
  return doors.find((door) => door.number === number) || null
}

/** Reads a door as an admin writes it: W3, w3, Door 3, or a bare 3. Anything else, or out of range, is null. */
export function parseDoor(raw: unknown, doors: Door[] = DOORS): number | null {
  const match = String(raw ?? '').trim().match(/^(?:w|door\s*)?\s*(\d{1,2})$/i)
  if (!match) return null
  const number = Number(match[1])
  return doors.some((door) => door.number === number) ? number : null
}

/**
 * The clause a door stands for when only the door is given: the clause already held when it sits in that door,
 * otherwise the door's first clause.
 */
export function clauseForDoor(door: number, current: number | null | undefined, doors: Door[] = DOORS): number | null {
  const found = doorByNumber(door, doors)
  if (!found) return null
  if (current && found.clauses.includes(current)) return current
  return Math.min(...found.clauses)
}

/** Doors from stored rows, in order. Falls back to the built-in map when the table is empty or incomplete. */
export function doorsFromRows(rows: { number?: unknown; section?: unknown; title?: unknown; clauses?: unknown }[]): Door[] {
  const parsed = rows
    .map((row) => ({
      number: Number(row.number),
      section: (DOOR_SECTIONS as readonly string[]).includes(String(row.section)) ? (String(row.section) as DoorSection) : 'Sitting',
      title: String(row.title || '').trim(),
      clauses: Array.isArray(row.clauses) ? row.clauses.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 41) : [],
    }))
    .filter((door) => Number.isInteger(door.number) && door.number >= 1 && door.title && door.clauses.length)
    .sort((a, b) => a.number - b.number)
  const covered = new Set(parsed.flatMap((door) => door.clauses))
  return covered.size === 41 ? parsed : DOORS
}
