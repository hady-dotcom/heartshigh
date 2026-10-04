// Hadith Jibril as learners meet it: 20 working doors over the 41 clauses. Talks, questions and the sheet keep
// their clause; a talk's door is always derived from it. Pure module, safe in the browser.

export const DOOR_SECTIONS = ['Sitting', 'Islam', 'Iman', 'Ihsan', 'Hour', 'Trunk'] as const
export type DoorSection = (typeof DOOR_SECTIONS)[number]
export type Door = { number: number; section: DoorSection; title: string; clauses: number[]; teaching?: string }

export const DOORS: Door[] = [
  { number: 1, section: 'Sitting', title: 'One day', clauses: [1], teaching: 'The day is the unit of time you are given.' },
  { number: 2, section: 'Sitting', title: 'The sitting: how he came and sat with the Messenger', clauses: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], teaching: 'How he came and sat with the Messenger.' },
  { number: 3, section: 'Islam', title: 'About Islam', clauses: [13, 19, 20], teaching: 'Islam named, then confirmed: you have spoken the truth.' },
  { number: 4, section: 'Islam', title: 'Two testimonies', clauses: [14], teaching: 'The word is a claim.' },
  { number: 5, section: 'Islam', title: 'Prayer', clauses: [15], teaching: 'Establish the prayer.' },
  { number: 6, section: 'Islam', title: 'Zakat', clauses: [16], teaching: 'Wealth has people it is for.' },
  { number: 7, section: 'Islam', title: 'Fasting Ramadan', clauses: [17], teaching: 'Fasting Ramadan.' },
  { number: 8, section: 'Islam', title: 'Hajj', clauses: [18], teaching: 'Hajj if you find a way.' },
  { number: 9, section: 'Iman', title: 'About iman', clauses: [21, 28], teaching: 'The six as they are. Islam is not iman.' },
  { number: 10, section: 'Iman', title: 'Believe in Allah', clauses: [22], teaching: 'Knowledge of the Creator.' },
  { number: 11, section: 'Iman', title: 'His angels', clauses: [23], teaching: 'Jibril is already in the room.' },
  { number: 12, section: 'Iman', title: 'His Books', clauses: [24], teaching: 'The Qur’an as His speech, then opened as lessons.' },
  { number: 13, section: 'Iman', title: 'His Messengers', clauses: [25], teaching: 'The Prophet’s miracles, and the Sunna you can walk.' },
  { number: 14, section: 'Iman', title: 'The Last Day', clauses: [26], teaching: 'Tomb, resurrection, Garden and Fire.' },
  { number: 15, section: 'Iman', title: 'Qadar, good and evil', clauses: [27], teaching: 'Actions created by Allah, acquired by servants.' },
  { number: 16, section: 'Ihsan', title: 'Ihsan: worship as though you see Him', clauses: [29, 30, 31], teaching: 'Worship as though you see Him, and if you do not, He sees you.' },
  { number: 17, section: 'Hour', title: 'The Hour: when, and what cannot be known', clauses: [32, 33], teaching: 'A time that will come, and the one asked knows no more.' },
  { number: 18, section: 'Hour', title: 'The Hour: the two signs', clauses: [34, 35], teaching: 'The slave-girl gives birth to her mistress, and shepherds compete in buildings.' },
  { number: 19, section: 'Trunk', title: 'It was Jibril', clauses: [36, 37, 38, 39, 40], teaching: 'The guest leaves, and the Prophet tells them who he was.' },
  { number: 20, section: 'Trunk', title: 'He came to teach you your religion', clauses: [41], teaching: 'The whole sitting was the lesson.' },
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
      teaching: DOORS.find((door) => door.number === Number(row.number))?.teaching,
    }))
    .filter((door) => Number.isInteger(door.number) && door.number >= 1 && door.title && door.clauses.length)
    .sort((a, b) => a.number - b.number)
  const covered = new Set(parsed.flatMap((door) => door.clauses))
  return covered.size === 41 ? parsed : DOORS
}

/**
 * The door a learner URL names: `w10` or a bare 10 is door 10. A bare number above the last door is an old
 * clause link (clause 22 before the doors), so it opens that clause's door rather than a second list.
 */
export function doorFromPath(token: string, doors: Door[] = DOORS): Door | null {
  const text = decodeURIComponent(String(token)).trim().toLowerCase()
  const match = text.match(/^w?(\d{1,2})$/)
  if (!match) return null
  const number = Number(match[1])
  const door = doorByNumber(number, doors)
  if (door) return door
  return text.startsWith('w') ? null : doorOfClause(number, doors)
}

/** Items grouped under their door, in door order, with anything on no door last. */
export function groupByDoor<T>(items: T[], doorOf: (item: T) => Door | null): { door: Door | null; items: T[] }[] {
  const groups = new Map<number, { door: Door | null; items: T[] }>()
  for (const item of items) {
    const door = doorOf(item)
    const key = door?.number ?? 0
    if (!groups.has(key)) groups.set(key, { door, items: [] })
    groups.get(key)!.items.push(item)
  }
  return [...groups.values()].sort((a, b) => (a.door?.number ?? 100) - (b.door?.number ?? 100))
}
