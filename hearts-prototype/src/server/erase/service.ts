import type { Payload } from 'payload'
import { idOf } from '../../lib/ids'
import { audit } from '../viewas'
import { now } from '../../lib/clock'
import { collectMedia, mediaIdsFrom, removeStoredFiles, unreferencedPortalMedia } from './media'
import { confirmMatches, refusePersonDelete, refusePortalDelete, refuseSelfDelete, tenantsOf, type PersonDoc } from './permissions'
import { registeredSlugs, ruleColumn, rulesFor, wipeEntries } from './registry'
import { collectionsNeedingWipe } from './relations'
import { bind, quoteIdent, withEraseTransaction } from './sql'
import type { EraseRefusal, EraseResult, MediaTarget, PersonMode, SqlExec, WipeEntry, WipeRule } from './types'

const LOCAL_LESSONS = `SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE origin = 'local' AND portal_id = {id})`

const LIBRARY_CHILDREN: { table: string; column: string }[] = [
  { table: 'resources', column: 'lesson_id' },
  { table: 'cuts', column: 'lesson_id' },
  { table: 'ladder_items', column: 'lesson_id' },
  { table: 'talk_tiers', column: 'lesson_id' },
  { table: 'engagement_points', column: 'lesson_id' },
  { table: 'sheet_keys', column: 'lesson_id' },
]

function applyExtra(rule: WipeRule, id: number) {
  return rule.extra ? ` AND (${bind(rule.extra, id)})` : ''
}

function whereRule(rule: WipeRule, id: number) {
  if (rule.kind === 'none') return ''
  return `${quoteIdent(ruleColumn(rule))} = ${id}${applyExtra(rule, id)}`
}

async function applyRule(exec: SqlExec, entry: WipeEntry, rule: WipeRule, id: number, deleted: Record<string, number>) {
  const where = whereRule(rule, id)
  if (!where) return
  const table = quoteIdent(entry.table)
  if (rule.kind === 'hard-delete') {
    const result = await exec(`DELETE FROM ${table} WHERE ${where}`)
    deleted[entry.collection] = (deleted[entry.collection] || 0) + result.rowCount
  } else if (rule.kind === 'unlink') {
    const result = await exec(`UPDATE ${table} SET ${quoteIdent(ruleColumn(rule))} = NULL WHERE ${where}`)
    deleted[`${entry.collection}:unlink`] = (deleted[`${entry.collection}:unlink`] || 0) + result.rowCount
  }
}

async function clearJoins(exec: SqlExec, entry: WipeEntry, side: 'portal' | 'user', id: number, deleted: Record<string, number>) {
  for (const join of entry.joinClears?.[side] || []) {
    const result = await exec(`DELETE FROM ${quoteIdent(join.table)} WHERE ${quoteIdent(join.column)} = ${id}`)
    deleted[join.table] = (deleted[join.table] || 0) + result.rowCount
  }
}

async function gatherMedia(exec: SqlExec, side: 'portal' | 'user', id: number) {
  const ids: number[] = []
  for (const entry of wipeEntries()) {
    const columns = entry.mediaColumns || []
    if (!columns.length) continue
    for (const rule of rulesFor(entry, side).filter((row) => row.kind === 'hard-delete')) {
      const where = whereRule(rule, id)
      if (where) ids.push(...(await mediaIdsFrom(exec, entry.table, columns, where)))
    }
  }
  return collectMedia(exec, ids)
}

async function wipeLocalTalkTree(exec: SqlExec, portalId: number, deleted: Record<string, number>) {
  const lessons = bind(LOCAL_LESSONS, portalId, 'portal')
  await exec(`DELETE FROM tags WHERE id IN (SELECT parent_id FROM tags_rels WHERE lessons_id IN (${lessons}))`).catch(() => undefined)
  await exec(`DELETE FROM tags_rels WHERE lessons_id IN (${lessons})`).catch(() => undefined)
  await exec(`DELETE FROM engagement_points_rels WHERE parent_id IN (SELECT id FROM engagement_points WHERE lesson_id IN (${lessons}))`).catch(() => undefined)
  for (const row of LIBRARY_CHILDREN) {
    const result = await exec(`DELETE FROM ${quoteIdent(row.table)} WHERE ${quoteIdent(row.column)} IN (${lessons})`)
    deleted[row.table] = (deleted[row.table] || 0) + result.rowCount
  }
  const units = await exec(`DELETE FROM units WHERE course_id IN (SELECT id FROM courses WHERE origin = 'local' AND portal_id = ${portalId})`)
  deleted.units = (deleted.units || 0) + units.rowCount
}

async function deleteMediaRows(exec: SqlExec, files: MediaTarget[], deleted: Record<string, number>) {
  const ids = files.map((file) => file.id).filter((id) => Number.isInteger(id) && id > 0)
  if (!ids.length) return
  const result = await exec(`DELETE FROM media WHERE id IN (${ids.join(',')})`)
  deleted.media = (deleted.media || 0) + result.rowCount
}

export function missingWipeRegistrations() {
  const needed = collectionsNeedingWipe()
  const registered = registeredSlugs()
  return [...needed.keys()].filter((slug) => !registered.has(slug)).sort()
}

async function loadPerson(payload: Payload, id: number) {
  return (await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 1 }).catch(() => null)) as PersonDoc | null
}

async function loadPortal(payload: Payload, id: number) {
  return (await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)) as { id: number; name?: string; slug?: string } | null
}

async function runSide(exec: SqlExec, side: 'portal' | 'user', id: number, deleted: Record<string, number>, skip: Set<string> = new Set()) {
  const last = new Set(['users', 'portals', 'media'])
  for (const entry of wipeEntries()) {
    if (last.has(entry.collection) || skip.has(entry.collection)) continue
    await clearJoins(exec, entry, side, id, deleted)
    for (const rule of rulesFor(entry, side)) await applyRule(exec, entry, rule, id, deleted)
  }
}

export async function wipePortal(
  payload: Payload,
  args: { actor: { id: number; role?: string | null; name?: string | null }; portalId: number; confirmName: string },
): Promise<EraseResult | EraseRefusal> {
  const blocked = refusePortalDelete(args.actor as never)
  if (blocked) return { ok: false, error: blocked }
  const portal = await loadPortal(payload, args.portalId)
  if (!portal) return { ok: false, error: 'That portal could not be found.' }
  if (!confirmMatches(args.confirmName, String(portal.name || ''))) {
    return { ok: false, error: 'Type the portal name to confirm.' }
  }
  const people = (await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 1,
    limit: 2000,
    where: { 'tenants.tenant': { equals: portal.id } },
  })).docs as unknown as PersonDoc[]

  const files: MediaTarget[] = []
  const deleted = await withEraseTransaction(payload, async (exec) => {
    const counts: Record<string, number> = {}
    files.push(...(await gatherMedia(exec, 'portal', portal.id)))
    files.push(...(await unreferencedPortalMedia(exec, portal.id)))
    await runSide(exec, 'portal', portal.id, counts)
    await wipeLocalTalkTree(exec, portal.id, counts)
    for (const person of people) {
      if (person.role === 'master') continue
      const homes = tenantsOf(person)
      if (homes.length <= 1) {
        files.push(...(await gatherMedia(exec, 'user', person.id)))
        await runSide(exec, 'user', person.id, counts, new Set(['circle-answers']))
        await exec(`DELETE FROM users_sessions WHERE _parent_id = ${person.id}`)
        await exec(`DELETE FROM users_rels WHERE parent_id = ${person.id}`)
        await exec(`DELETE FROM users_tenants WHERE _parent_id = ${person.id}`)
        await exec(`UPDATE users SET updated_by_id = NULL WHERE updated_by_id = ${person.id}`)
        await exec(`UPDATE users SET on_behalf_of_id = NULL WHERE on_behalf_of_id = ${person.id}`)
        const gone = await exec(`DELETE FROM users WHERE id = ${person.id}`)
        counts.users = (counts.users || 0) + gone.rowCount
      }
    }
    await exec(`DELETE FROM users_tenants WHERE tenant_id = ${portal.id}`)
    await deleteMediaRows(exec, files, counts)
    const portalGone = await exec(`DELETE FROM portals WHERE id = ${portal.id}`)
    counts.portals = (counts.portals || 0) + portalGone.rowCount
    return counts
  })

  const stored = await removeStoredFiles(payload, files)
  await audit(payload, 'erase.portal', {
    actor: args.actor.id,
    actorRole: args.actor.role,
    reason: 'Portal wiped',
    at: now().toISOString(),
    detail: { name: portal.name, slug: portal.slug, deleted, files: stored },
  }).catch(() => undefined)
  return { ok: true, scope: 'portal', id: portal.id, deleted, filesQueued: files.length, filesRemoved: stored.removed, fileFailures: stored.failed }
}

export async function wipeUser(
  payload: Payload,
  args: {
    actor: { id: number; role?: string | null; name?: string | null }
    userId: number
    portalId?: number | null
    mode: PersonMode
    confirmName: string
    self?: boolean
  },
): Promise<EraseResult | EraseRefusal> {
  const target = await loadPerson(payload, args.userId)
  if (!target) return { ok: false, error: 'That person could not be found.' }
  const expected = String(target.name || target.email || '')
  if (!confirmMatches(args.confirmName, expected) && !confirmMatches(args.confirmName, String(target.email || ''))) {
    return { ok: false, error: 'Type the name to confirm.' }
  }
  const blocked = args.self
    ? await refuseSelfDelete(payload, args.actor as never)
    : await refusePersonDelete(payload, args.actor as never, target, args.portalId || null, args.mode)
  if (blocked) return { ok: false, error: blocked }

  const homes = tenantsOf(target)
  const portalId = args.portalId || homes[0] || null
  const onlyHere = homes.length <= 1
  const mode: PersonMode = args.mode === 'portal' && !onlyHere && portalId ? 'portal' : 'account'
  if (mode === 'portal' && !portalId) return { ok: false, error: 'Name the portal they should leave.' }

  const files: MediaTarget[] = []
  const deleted = await withEraseTransaction(payload, async (exec) => {
    const counts: Record<string, number> = {}
    if (mode === 'portal' && portalId) {
      files.push(...(await gatherMedia(exec, 'user', target.id)))
      for (const entry of wipeEntries()) {
        if (entry.collection === 'users' || entry.collection === 'portals' || entry.collection === 'media') continue
        const portalRules = rulesFor(entry, 'portal').filter((rule) => rule.kind === 'hard-delete')
        const userRules = rulesFor(entry, 'user').filter((rule) => rule.kind === 'hard-delete')
        if (!portalRules.length || !userRules.length) continue
        const portalCol = ruleColumn(portalRules[0])
        const userCol = ruleColumn(userRules[0])
        if (entry.mediaColumns?.length) {
          files.push(...(await collectMedia(exec, await mediaIdsFrom(exec, entry.table, entry.mediaColumns, `${quoteIdent(portalCol)} = ${portalId} AND ${quoteIdent(userCol)} = ${target.id}`))))
        }
        const result = await exec(`DELETE FROM ${quoteIdent(entry.table)} WHERE ${quoteIdent(portalCol)} = ${portalId} AND ${quoteIdent(userCol)} = ${target.id}`)
        counts[entry.collection] = (counts[entry.collection] || 0) + result.rowCount
      }
      await exec(`DELETE FROM schedules_rels WHERE users_id = ${target.id}`)
      await exec(`DELETE FROM users_tenants WHERE _parent_id = ${target.id} AND tenant_id = ${portalId}`)
      counts.membership = (counts.membership || 0) + 1
    } else {
      files.push(...(await gatherMedia(exec, 'user', target.id)))
      await runSide(exec, 'user', target.id, counts)
      await exec(`DELETE FROM users_sessions WHERE _parent_id = ${target.id}`)
      await exec(`DELETE FROM users_rels WHERE parent_id = ${target.id}`)
      await exec(`DELETE FROM users_tenants WHERE _parent_id = ${target.id}`)
      await exec(`UPDATE users SET updated_by_id = NULL WHERE updated_by_id = ${target.id}`)
      await exec(`UPDATE users SET on_behalf_of_id = NULL WHERE on_behalf_of_id = ${target.id}`)
      await exec(`UPDATE users SET access_code_id = NULL WHERE id = ${target.id}`)
      await deleteMediaRows(exec, files, counts)
      const gone = await exec(`DELETE FROM users WHERE id = ${target.id}`)
      counts.users = (counts.users || 0) + gone.rowCount
    }
    return counts
  })

  const stored = await removeStoredFiles(payload, files)
  await audit(payload, mode === 'portal' ? 'erase.membership' : 'erase.user', {
    actor: args.actor.id,
    actorRole: args.actor.role,
    target: target.id,
    targetRole: target.role,
    portal: portalId || undefined,
    reason: mode === 'portal' ? 'Removed from a portal' : 'Account wiped',
    at: now().toISOString(),
    detail: { deleted, files: stored },
  }).catch(() => undefined)
  return { ok: true, scope: 'user', id: target.id, deleted, filesQueued: files.length, filesRemoved: stored.removed, fileFailures: stored.failed }
}

export function personPortalId(person: PersonDoc, preferred?: number | null) {
  const homes = tenantsOf(person)
  if (preferred && homes.includes(preferred)) return preferred
  return homes[0] || idOf(person.tenants?.[0]?.tenant)
}
