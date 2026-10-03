/**
 * Hadith Jibril as twenty working doors for learners.
 * Clauses 1–41 stay internal tags for the admin desk, the importer and the mapping.
 * A sheet cell that carries a clause number resolves to its door through `parseImportedClause`.
 */

export type DoorSection = 'Sitting' | 'Islam' | 'Iman' | 'Ihsan' | 'Hour' | 'Trunk'

export type WorkingDoor = {
  code: string
  order: number
  section: DoorSection
  name: string
  teaching: string
  clauses: number[]
}

export const DOOR_SECTIONS: { key: DoorSection; title: string; colour: string }[] = [
  { key: 'Sitting', title: 'The sitting', colour: '#e98fb0' },
  { key: 'Islam', title: 'Islam', colour: '#f0b44c' },
  { key: 'Iman', title: 'Iman', colour: '#7fc4a8' },
  { key: 'Ihsan', title: 'Ihsan', colour: '#a98bd6' },
  { key: 'Hour', title: 'The Hour', colour: '#ef8a5a' },
  { key: 'Trunk', title: 'He came to teach you your religion', colour: '#6fa8dc' },
]

export const DOORS: WorkingDoor[] = [
  { code: 'W1', order: 1, section: 'Sitting', name: 'One day', teaching: 'The day is the unit of time you are given.', clauses: [1] },
  { code: 'W2', order: 2, section: 'Sitting', name: 'The sitting', teaching: 'How he came and sat with the Messenger.', clauses: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: 'W3', order: 3, section: 'Islam', name: 'About Islam', teaching: 'Islam named, then confirmed: you have spoken the truth.', clauses: [13, 19, 20] },
  { code: 'W4', order: 4, section: 'Islam', name: 'Two testimonies', teaching: 'The word is a claim.', clauses: [14] },
  { code: 'W5', order: 5, section: 'Islam', name: 'Prayer', teaching: 'Establish the prayer.', clauses: [15] },
  { code: 'W6', order: 6, section: 'Islam', name: 'Zakat', teaching: 'Wealth has people it is for.', clauses: [16] },
  { code: 'W7', order: 7, section: 'Islam', name: 'Fasting Ramadan', teaching: 'Fasting Ramadan.', clauses: [17] },
  { code: 'W8', order: 8, section: 'Islam', name: 'Hajj', teaching: 'Hajj if you find a way.', clauses: [18] },
  { code: 'W9', order: 9, section: 'Iman', name: 'About iman', teaching: 'The six as they are. Islam is not iman.', clauses: [21, 28] },
  { code: 'W10', order: 10, section: 'Iman', name: 'Believe in Allah', teaching: 'Knowledge of the Creator.', clauses: [22] },
  { code: 'W11', order: 11, section: 'Iman', name: 'His angels', teaching: 'Jibril is already in the room.', clauses: [23] },
  { code: 'W12', order: 12, section: 'Iman', name: 'His Books', teaching: 'The Qur’an as His speech, then opened as lessons.', clauses: [24] },
  { code: 'W13', order: 13, section: 'Iman', name: 'His Messengers', teaching: 'The Prophet’s miracles, and the Sunna you can walk.', clauses: [25] },
  { code: 'W14', order: 14, section: 'Iman', name: 'The Last Day', teaching: 'Tomb, resurrection, Garden and Fire.', clauses: [26] },
  { code: 'W15', order: 15, section: 'Iman', name: 'Qadar, good and evil', teaching: 'Actions created by Allah, acquired by servants.', clauses: [27] },
  { code: 'W16', order: 16, section: 'Ihsan', name: 'Ihsan', teaching: 'Worship as though you see Him, and if you do not, He sees you.', clauses: [29, 30, 31] },
  { code: 'W17', order: 17, section: 'Hour', name: 'The Hour', teaching: 'A time that will come, and the one asked knows no more.', clauses: [32, 33] },
  { code: 'W18', order: 18, section: 'Hour', name: 'The two signs', teaching: 'The slave-girl gives birth to her mistress, and shepherds compete in buildings.', clauses: [34, 35] },
  { code: 'W19', order: 19, section: 'Trunk', name: 'It was Jibril', teaching: 'The guest leaves, and the Prophet tells them who he was.', clauses: [36, 37, 38, 39, 40] },
  { code: 'W20', order: 20, section: 'Trunk', name: 'He came to teach you your religion', teaching: 'The whole sitting was the lesson.', clauses: [41] },
]

const BY_CLAUSE = new Map<number, WorkingDoor>()
for (const door of DOORS) for (const clause of door.clauses) BY_CLAUSE.set(clause, door)

export function doorForClause(clause: number | null | undefined): WorkingDoor | null {
  if (clause == null || !Number.isInteger(Number(clause))) return null
  return BY_CLAUSE.get(Number(clause)) || null
}

export function doorLabel(door: WorkingDoor) {
  return `${door.code} · ${door.name}`
}

/** A sheet cell that carries a clause number. Door codes are not sheet values; the number resolves to the door. */
export function parseImportedClause(raw: string): { clause: number; door: WorkingDoor } | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const clause = Number(text)
  const door = doorForClause(clause)
  return door ? { clause, door } : null
}

/**
 * Learner paths use the door code (`w10`). A bare number is a legacy clause tag and opens that clause's door,
 * so an old link to clause 22 opens Believe in Allah rather than a second list.
 */
export function doorFromPath(token: string): WorkingDoor | null {
  const text = decodeURIComponent(token).trim().toLowerCase()
  const coded = text.match(/^w(\d{1,2})$/)
  if (coded) return DOORS.find((door) => door.order === Number(coded[1])) || null
  if (/^\d{1,2}$/.test(text)) return doorForClause(Number(text))
  return null
}

export function doorPath(door: WorkingDoor) {
  return door.code.toLowerCase()
}

export function groupByDoor<T>(items: T[], doorOf: (item: T) => WorkingDoor | null): { door: WorkingDoor | null; items: T[] }[] {
  const order: { door: WorkingDoor | null; items: T[] }[] = []
  const index = new Map<string, number>()
  for (const item of items) {
    const door = doorOf(item)
    const key = door?.code || ''
    const at = index.get(key)
    if (at == null) {
      index.set(key, order.length)
      order.push({ door, items: [item] })
    } else order[at].items.push(item)
  }
  return order.sort((a, b) => (a.door?.order ?? 100) - (b.door?.order ?? 100))
}
