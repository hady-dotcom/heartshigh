import ExcelJS from 'exceljs'
import type { Payload } from 'payload'
import type { SessionUser } from '../context'
import { personSummary, portalSummary } from './summary'
import { execOutside, quoteIdent } from './sql'
import { wipeEntries } from './registry'
import type { PersonMode } from './types'

async function tableRows(payload: Payload, table: string, where: string, limit = 2000) {
  const result = await execOutside(payload, `SELECT * FROM ${quoteIdent(table)} WHERE ${where} LIMIT ${limit}`)
  return result.rows
}

async function portalDump(payload: Payload, portalId: number) {
  const data: Record<string, unknown[]> = {}
  const people = await tableRows(payload, 'users', `id IN (SELECT _parent_id FROM users_tenants WHERE tenant_id = ${portalId})`)
  data.people = people.map((row) => {
    const copy = { ...row }
    delete copy.hash
    delete copy.salt
    delete copy.reset_password_token
    return copy
  })
  for (const entry of wipeEntries()) {
    if (entry.collection === 'users' || entry.collection === 'portals') continue
    const portalRules = (Array.isArray(entry.portal) ? entry.portal : entry.portal ? [entry.portal] : []).filter((rule) => rule.kind === 'hard-delete')
    if (!portalRules.length) continue
    const field = portalRules[0].column || `${String(portalRules[0].field).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) }_id`
    data[entry.collection] = await tableRows(payload, entry.table, `${quoteIdent(field)} = ${portalId}`)
  }
  return data
}

async function userDump(payload: Payload, userId: number) {
  const data: Record<string, unknown[]> = {}
  const people = await tableRows(payload, 'users', `id = ${userId}`)
  data.person = people.map((row) => {
    const copy = { ...row }
    delete copy.hash
    delete copy.salt
    delete copy.reset_password_token
    return copy
  })
  for (const entry of wipeEntries()) {
    const userRules = (Array.isArray(entry.user) ? entry.user : entry.user ? [entry.user] : []).filter((rule) => rule.kind === 'hard-delete')
    if (!userRules.length) continue
    const field = userRules[0].column || `${String(userRules[0].field).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) }_id`
    if (field === 'id') continue
    data[entry.collection] = await tableRows(payload, entry.table, `${quoteIdent(field)} = ${userId}`)
  }
  return data
}

async function toXlsx(data: Record<string, unknown[]>) {
  const book = new ExcelJS.Workbook()
  book.creator = 'HEARTS'
  for (const [name, rows] of Object.entries(data)) {
    const sheet = book.addWorksheet(name.slice(0, 31))
    if (!rows.length) {
      sheet.addRow(['(empty)'])
      continue
    }
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row as object)))]
    sheet.addRow(keys)
    for (const row of rows) {
      sheet.addRow(keys.map((key) => {
        const value = (row as Record<string, unknown>)[key]
        if (value == null) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        return value
      }))
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer())
}

export async function exportPortalCopy(payload: Payload, actor: SessionUser | null, portalId: number, format: 'json' | 'xlsx') {
  const summary = await portalSummary(payload, actor, portalId)
  if ('error' in summary) return summary
  const data = { summary, ...await portalDump(payload, portalId) }
  if (format === 'json') return { filename: `portal-${summary.slug || portalId}.json`, body: Buffer.from(JSON.stringify(data, null, 2)), type: 'application/json' }
  return { filename: `portal-${summary.slug || portalId}.xlsx`, body: await toXlsx(data as Record<string, unknown[]>), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
}

export async function exportPersonCopy(
  payload: Payload,
  actor: SessionUser | null,
  userId: number,
  portalId: number | null,
  mode: PersonMode,
  format: 'json' | 'xlsx',
  self = false,
) {
  const summary = await personSummary(payload, actor, userId, portalId, mode, self)
  if ('error' in summary) return summary
  const data = { summary, ...await userDump(payload, userId) }
  const slug = (summary.email || `user-${userId}`).replace(/[^a-z0-9._-]+/gi, '-')
  if (format === 'json') return { filename: `${slug}.json`, body: Buffer.from(JSON.stringify(data, null, 2)), type: 'application/json' }
  return { filename: `${slug}.xlsx`, body: await toXlsx(data as Record<string, unknown[]>), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
}
