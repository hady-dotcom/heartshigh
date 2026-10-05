import type { Payload } from 'payload'
import { TENANT_COLLECTIONS } from '../../lib/tenant-collections'
import { wipeEntries } from './registry'
import { fieldToColumn, slugToTable } from './relations'
import { execOutside, quoteIdent } from './sql'

export type OrphanRow = {
  table: string
  column: string
  id: number
  pointedAt: number
  kind: 'portal' | 'user' | 'media'
}

export type OrphanReport = {
  orphans: OrphanRow[]
  filesWithoutOwner: { id: number; filename?: string | null; prefix?: string | null }[]
  s3Retries: { id: number; object_key?: string; error?: string }[]
  clean: boolean
}

const USER_COLUMNS: { table: string; column: string }[] = []
const PORTAL_COLUMNS: { table: string; column: string }[] = []

function remember(table: string, column: string, list: { table: string; column: string }[]) {
  if (!list.some((row) => row.table === table && row.column === column)) list.push({ table, column })
}

for (const entry of wipeEntries()) {
  for (const field of entry.relations.users || []) {
    if (field.includes('.')) continue
    if (field === 'id') continue
    remember(entry.table, fieldToColumn(field), USER_COLUMNS)
  }
  for (const field of entry.relations.portals || []) {
    if (field.includes('.')) continue
    if (field === 'id') continue
    remember(entry.table, fieldToColumn(field), PORTAL_COLUMNS)
  }
  for (const join of [...(entry.joinClears?.user || []), ...(entry.joinClears?.portal || [])]) {
    if (join.column.endsWith('_id') && join.table !== 'users_sessions' && join.table !== 'users_rels') {
      if (join.column.includes('tenant') || join.column.includes('portal')) remember(join.table, join.column, PORTAL_COLUMNS)
      else if (join.column.includes('user') || join.column === '_parent_id') remember(join.table, join.column, USER_COLUMNS)
    }
  }
}

for (const slug of Object.keys(TENANT_COLLECTIONS)) {
  remember(slugToTable(slug), 'portal_id', PORTAL_COLUMNS)
}

remember('users_tenants', 'tenant_id', PORTAL_COLUMNS)
remember('users_tenants', '_parent_id', USER_COLUMNS)

async function tableExists(payload: Payload, table: string) {
  const pg = await execOutside(
    payload,
    `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}'`,
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
  if (pg.rows.length) return true
  const sqlite = await execOutside(payload, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`).catch(() => ({ rows: [] as Record<string, unknown>[] }))
  return sqlite.rows.length > 0
}

async function dangling(payload: Payload, table: string, column: string, parent: string, kind: OrphanRow['kind']) {
  if (!(await tableExists(payload, table))) return []
  const sql = `SELECT t.id AS id, t.${quoteIdent(column)} AS pointed FROM ${quoteIdent(table)} t
    WHERE t.${quoteIdent(column)} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ${quoteIdent(parent)} p WHERE p.id = t.${quoteIdent(column)})`
  const result = await execOutside(payload, sql).catch(() => ({ rows: [] as Record<string, unknown>[] }))
  return result.rows.map((row) => ({
    table,
    column,
    id: Number(row.id),
    pointedAt: Number(row.pointed),
    kind,
  }))
}

export async function findOrphans(payload: Payload): Promise<OrphanReport> {
  const orphans: OrphanRow[] = []
  for (const row of PORTAL_COLUMNS) orphans.push(...(await dangling(payload, row.table, row.column, 'portals', 'portal')))
  for (const row of USER_COLUMNS) orphans.push(...(await dangling(payload, row.table, row.column, 'users', 'user')))
  const files = (await tableExists(payload, 'media'))
    ? await execOutside(
      payload,
      `SELECT id, filename, prefix FROM media
        WHERE portal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM portals p WHERE p.id = media.portal_id)`,
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }))
    : { rows: [] as Record<string, unknown>[] }
  const retries = (await tableExists(payload, 'erase_s3_retries'))
    ? await execOutside(payload, 'SELECT id, object_key, error FROM erase_s3_retries').catch(() => ({ rows: [] as Record<string, unknown>[] }))
    : { rows: [] as Record<string, unknown>[] }
  const filesWithoutOwner = files.rows.map((row) => ({ id: Number(row.id), filename: row.filename as string | null, prefix: row.prefix as string | null }))
  return {
    orphans,
    filesWithoutOwner,
    s3Retries: retries.rows as { id: number; object_key?: string; error?: string }[],
    clean: orphans.length === 0 && filesWithoutOwner.length === 0,
  }
}

export async function fixOrphans(payload: Payload, report: OrphanReport) {
  const removed: Record<string, number> = {}
  for (const row of report.orphans) {
    const result = await execOutside(payload, `DELETE FROM ${quoteIdent(row.table)} WHERE id = ${row.id} AND ${quoteIdent(row.column)} = ${row.pointedAt}`)
    removed[row.table] = (removed[row.table] || 0) + result.rowCount
  }
  for (const file of report.filesWithoutOwner) {
    const result = await execOutside(payload, `DELETE FROM media WHERE id = ${file.id}`)
    removed.media = (removed.media || 0) + result.rowCount
  }
  return removed
}

export function formatOrphanReport(report: OrphanReport) {
  const lines = [
    report.clean ? 'No orphans. The database is clean.' : `${report.orphans.length} orphan row(s), ${report.filesWithoutOwner.length} file(s) with no portal.`,
  ]
  for (const row of report.orphans) {
    lines.push(`${row.table}.${row.column} id=${row.id} points at missing ${row.kind} ${row.pointedAt}`)
  }
  for (const file of report.filesWithoutOwner) {
    lines.push(`media id=${file.id} ${file.filename || ''} has no portal`)
  }
  for (const retry of report.s3Retries) {
    lines.push(`s3 retry id=${retry.id} ${retry.object_key || ''} ${retry.error || ''}`)
  }
  return lines.join('\n')
}
