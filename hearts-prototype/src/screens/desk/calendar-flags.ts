import type { Payload } from 'payload'

export async function flagsOfSafe(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as { popularTalksOn?: boolean | null } | null
  return { popular: Boolean(flags?.popularTalksOn) }
}
