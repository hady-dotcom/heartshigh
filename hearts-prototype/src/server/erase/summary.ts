import type { Payload } from 'payload'
import { portalIdOf } from '../../lib/ids'
import type { SessionUser } from '../context'
import { confirmMatches, refusePersonDelete, refusePortalDelete, refuseSelfDelete, tenantsOf, type PersonDoc } from './permissions'
import { ruleColumn, rulesFor, wipeEntries } from './registry'
import { bind, execOutside, quoteIdent } from './sql'
import type { CountRow, EraseSummary, PersonMode } from './types'

async function countWhere(payload: Payload, table: string, where: string) {
  const result = await execOutside(payload, `SELECT COUNT(*) AS n FROM ${quoteIdent(table)} WHERE ${where}`)
  return Number(result.rows[0]?.n || 0)
}

async function roleCounts(payload: Payload, portalId: number) {
  const people = (await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 2000,
    where: { 'tenants.tenant': { equals: portalId } },
  })).docs as { role?: string }[]
  return {
    learners: people.filter((row) => row.role === 'learner').length,
    teachers: people.filter((row) => row.role === 'teacher').length,
    admins: people.filter((row) => row.role === 'portal-admin').length,
  }
}

async function fileCount(payload: Payload, side: 'portal' | 'user', id: number) {
  let total = 0
  for (const entry of wipeEntries()) {
    const columns = entry.mediaColumns || []
    if (!columns.length) continue
    for (const rule of rulesFor(entry, side).filter((row) => row.kind === 'hard-delete')) {
      const where = `${quoteIdent(ruleColumn(rule))} = ${id}${rule.extra ? ` AND (${bind(rule.extra, id)})` : ''}`
      for (const column of columns) {
        total += await countWhere(payload, entry.table, `${where} AND ${quoteIdent(column)} IS NOT NULL`)
      }
    }
  }
  if (side === 'portal') {
    total += await countWhere(
      payload,
      'media',
      `portal_id = ${id}
        AND id NOT IN (SELECT photo_id FROM speakers WHERE photo_id IS NOT NULL)
        AND id NOT IN (SELECT film_id FROM lessons WHERE film_id IS NOT NULL)
        AND id NOT IN (SELECT file_id FROM resources WHERE file_id IS NOT NULL)
        AND id NOT IN (SELECT scene_id FROM opening_scenes WHERE scene_id IS NOT NULL)`,
    )
  }
  return total
}

async function registryCounts(payload: Payload, side: 'portal' | 'user', id: number) {
  const counts: CountRow[] = []
  for (const entry of wipeEntries()) {
    if (!entry.countKey || entry.collection === 'media' || entry.collection === 'portals' || entry.collection === 'users') continue
    let n = 0
    for (const rule of rulesFor(entry, side).filter((row) => row.kind === 'hard-delete')) {
      n += await countWhere(payload, entry.table, `${quoteIdent(ruleColumn(rule))} = ${id}${rule.extra ? ` AND (${bind(rule.extra, id)})` : ''}`)
    }
    if (n) counts.push({ key: entry.countKey, label: entry.countLabel || entry.countKey, n })
  }
  return counts
}

export async function portalSummary(payload: Payload, actor: SessionUser | null, portalId: number): Promise<EraseSummary | { error: string }> {
  const blocked = refusePortalDelete(actor)
  if (blocked) return { error: blocked }
  const portal = (await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)) as { id: number; name?: string; slug?: string } | null
  if (!portal) return { error: 'That portal could not be found.' }
  const roles = await roleCounts(payload, portal.id)
  const files = await fileCount(payload, 'portal', portal.id)
  const counts: CountRow[] = [
    { key: 'learners', label: 'Learners', n: roles.learners },
    { key: 'teachers', label: 'Teachers', n: roles.teachers },
    { key: 'admins', label: 'Admins', n: roles.admins },
    ...(await registryCounts(payload, 'portal', portal.id)),
    { key: 'files', label: 'Files', n: files },
  ]
  return {
    scope: 'portal',
    id: portal.id,
    name: String(portal.name || ''),
    slug: portal.slug,
    otherPortals: [],
    counts: counts.filter((row) => row.n > 0 || ['learners', 'teachers', 'admins', 'files'].includes(row.key)),
    files,
    confirmLabel: 'Type the portal name to confirm',
    confirmValue: String(portal.name || ''),
  }
}

export async function personSummary(
  payload: Payload,
  actor: SessionUser | null,
  userId: number,
  portalId: number | null,
  mode: PersonMode,
  self = false,
): Promise<EraseSummary | { error: string }> {
  const person = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, depth: 1 }).catch(() => null)) as PersonDoc | null
  if (!person) return { error: 'That person could not be found.' }
  const blocked = self ? await refuseSelfDelete(payload, actor) : await refusePersonDelete(payload, actor, person, portalId, mode)
  if (blocked) return { error: blocked }
  const homes = tenantsOf(person)
  const others = []
  for (const id of homes.filter((home) => home !== portalId && home !== portalIdOf(person))) {
    const doc = (await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)) as { id: number; name?: string } | null
    if (doc) others.push({ id: doc.id, name: String(doc.name || '') })
  }
  for (const id of homes) {
    if (id === portalId) continue
    if (others.some((row) => row.id === id)) continue
    const doc = (await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)) as { id: number; name?: string } | null
    if (doc) others.push({ id: doc.id, name: String(doc.name || '') })
  }
  const files = await fileCount(payload, 'user', person.id)
  const counts = [...(await registryCounts(payload, 'user', person.id)), { key: 'files', label: 'Files', n: files }]
  return {
    scope: 'user',
    id: person.id,
    name: String(person.name || person.email || ''),
    email: person.email || undefined,
    role: person.role || undefined,
    mode,
    otherPortals: others,
    counts: counts.filter((row) => row.n > 0 || row.key === 'files'),
    files,
    confirmLabel: 'Type the name to confirm',
    confirmValue: String(person.name || person.email || ''),
  }
}

export { confirmMatches }
