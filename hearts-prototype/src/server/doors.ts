import type { Payload } from 'payload'
import { DOORS, doorsFromRows, type Door } from '@/lib/doors'

export async function loadDoors(payload: Payload): Promise<Door[]> {
  const found = await payload.find({ collection: 'doors', overrideAccess: true, depth: 0, limit: 50, sort: 'number', pagination: false }).catch(() => null)
  return found ? doorsFromRows(found.docs as { number?: unknown; section?: unknown; title?: unknown; clauses?: unknown }[]) : DOORS
}

/** Writes the 20 doors, keeping any title a master has since changed. Safe to run again. */
export async function seedDoors(payload: Payload) {
  for (const door of DOORS) {
    const found = await payload.find({ collection: 'doors', overrideAccess: true, depth: 0, limit: 1, where: { number: { equals: door.number } } })
    if (found.docs[0]) await payload.update({ collection: 'doors', id: found.docs[0].id, overrideAccess: true, data: { section: door.section, clauses: door.clauses } })
    else await payload.create({ collection: 'doors', overrideAccess: true, data: { number: door.number, section: door.section, title: door.title, clauses: door.clauses } })
  }
}
