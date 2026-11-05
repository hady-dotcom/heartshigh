// Loads the master persona lens. Counts only: no person id leaves this function.
import type { Payload } from 'payload'
import { bandFromRow, tallyPersonas, type PersonaBand, type Reading } from '@/lib/persona'
import { SCALE_KEYS, type ScaleKey } from '@/lib/heart'

function readingOf(state: unknown): Reading {
  const source = state && typeof state === 'object' && 's' in state ? (state as { s?: unknown }).s : null
  if (!source || typeof source !== 'object') return {}
  const reading: Reading = {}
  for (const key of SCALE_KEYS) {
    const value = (source as Record<string, unknown>)[key]
    if (typeof value === 'number' && Number.isFinite(value)) reading[key as ScaleKey] = value
  }
  return reading
}

/** Heart states of people who opted into trends and also keep their place. Everyone else has no reading here. */
export async function loadPersonaLens(payload: Payload) {
  const [bandDocs, opted] = await Promise.all([
    payload.find({ collection: 'persona-bands', overrideAccess: true, depth: 0, limit: 50, sort: 'title', pagination: false } as never),
    payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 2000, pagination: false, where: { trendsOptIn: { equals: true } } }),
  ])
  const bands = (bandDocs.docs as unknown as Parameters<typeof bandFromRow>[0][]).map((row) => bandFromRow(row))
  const ids = opted.docs.map((user) => user.id)
  const states = ids.length
    ? await payload.find({ collection: 'heart-states', overrideAccess: true, depth: 0, limit: 2000, pagination: false, where: { user: { in: ids } } })
    : { docs: [] as { state?: unknown }[] }
  const rows = (states.docs as { state?: unknown }[]).map((doc) => {
    const portal = doc.state && typeof doc.state === 'object' && 'portal' in doc.state ? (doc.state as { portal?: unknown }).portal : ''
    return { group: typeof portal === 'string' && portal ? portal : 'unknown', reading: readingOf(doc.state) }
  })
  return { bands, tallies: tallyPersonas(rows, bands), published: bands.filter((band: PersonaBand) => band.status === 'published').length }
}
