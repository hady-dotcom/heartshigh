import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import type { CollectionConfig, Payload } from 'payload'
import { now } from '@/lib/clock'
import { DATA_EXPORT_MS } from '@/lib/account-rules'
import { hashToken, randomToken } from '@/lib/account-crypto'
import { idOf } from '@/lib/ids'
import { aiCollections } from '@/collections-ai'
import { collections } from '@/collections'
import { gatherCollections } from '@/collections-gather'
import { sheetCollections } from '@/collections-sheet'
import { openingCollections } from '@/collections-opening'

export const PERSONAL: Record<string, { field: string; many?: boolean }> = {
  answers: { field: 'user' },
  'workbook-entries': { field: 'user' },
  notifications: { field: 'user' },
  'placing-answers': { field: 'user' },
  'harvest-entries': { field: 'user' },
  'drawn-to': { field: 'user' },
  schedules: { field: 'owner' },
  rsvps: { field: 'user' },
  checkins: { field: 'user' },
  completions: { field: 'user' },
  'watch-sessions': { field: 'user' },
  'lesson-visits': { field: 'user' },
  'seat-visits': { field: 'user' },
  rituals: { field: 'user' },
  'feedback-notes': { field: 'author' },
  messages: { field: 'author' },
  'gather-rsvps': { field: 'user' },
  'gather-checkins': { field: 'user' },
  'gather-reflections': { field: 'user' },
  'gather-photos': { field: 'postedBy' },
  'heart-states': { field: 'user' },
  'opening-answers': { field: 'user' },
  'compass-attempts': { field: 'user' },
  'compass-serves': { field: 'user' },
}

/** Staff, catalogue or system rows that mention a user but are not that person's data. */
export const NOT_PERSONAL = new Set([
  'users',
  'portals',
  'media',
  'access-codes',
  'packs',
  'courses',
  'units',
  'lessons',
  'resources',
  'cuts',
  'ladder-items',
  'engagement-points',
  'talk-tiers',
  'circle-answers',
  'feedback-summaries',
  'question-rewrites',
  'doors',
  'seats',
  'shelf-items',
  'speakers',
  'clauses',
  'tags',
  'adoptions',
  'scripture-cache',
  'events',
  'gatherings',
  'ai-steps',
  'ai-step-versions',
  'ai-step-outputs',
  'ai-step-jobs',
  'ai-desk',
  'sheet-keys',
  'sheet-imports',
  'heart-scales',
  'lanes',
  'opening-scenes',
  'opening-configs',
  'heart-contributions',
  'master-flags',
  'persona-bands',
  'compass-settings',
  'compass-mixes',
  'audit-log',
  'view-as-sessions',
])

function allConfigs(): CollectionConfig[] {
  return [...collections, ...aiCollections, ...sheetCollections, ...gatherCollections, ...openingCollections]
}

export function collectionsWithUserField() {
  const found: { slug: string; fields: string[] }[] = []
  for (const collection of allConfigs()) {
    const fields = userFieldNames(collection.fields as { name?: string; type?: string; relationTo?: unknown; hasMany?: boolean; fields?: unknown[] }[])
    if (fields.length) found.push({ slug: collection.slug, fields })
  }
  return found
}

function userFieldNames(fields: { name?: string; type?: string; relationTo?: unknown; fields?: unknown[] }[] = []): string[] {
  const names: string[] = []
  for (const field of fields) {
    if (field.type === 'relationship' && field.relationTo === 'users' && field.name) names.push(field.name)
    if (field.type === 'array' || field.type === 'group' || field.type === 'collapsible' || field.type === 'row' || field.type === 'tabs') {
      names.push(...userFieldNames((field as { fields?: never[] }).fields || []))
    }
  }
  return names
}

export function missingPersonalCoverage() {
  return collectionsWithUserField()
    .filter((row) => !PERSONAL[row.slug] && !NOT_PERSONAL.has(row.slug))
    .map((row) => row.slug)
    .sort()
}

async function rowsFor(payload: Payload, collection: string, field: string, userId: number) {
  if (!(collection in (payload.collections || {}))) return []
  try {
  const found = await payload.find({
    collection: collection as 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1000,
    where: { [field]: { equals: userId } } as never,
  })
  return found.docs.map((doc) => {
    const row = { ...(doc as Record<string, unknown>) }
    delete row.hash
    delete row.salt
    delete row.resetPasswordToken
    delete row.totpSecret
    delete row.backupCodes
    delete row.emailConfirmToken
    delete row.pendingEmailToken
    delete row.dataExportToken
    return row
  })
  } catch {
    return []
  }
}

export async function gatherMyData(payload: Payload, userId: number) {
  const user = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, depth: 1 })) as Record<string, unknown>
  const profile = {
    name: user.name,
    email: user.email,
    role: user.role,
    joinedAt: user.joinedAt || user.createdAt,
    audience: user.audience,
    shareWatch: user.shareWatch,
    nightAlerts: user.nightAlerts,
    notificationPrefs: user.notificationPrefs,
    emailConfirmedAt: user.emailConfirmedAt,
  }
  const data: Record<string, unknown> = { profile, exportedAt: now().toISOString() }
  for (const [slug, rule] of Object.entries(PERSONAL)) {
    data[slug] = await rowsFor(payload, slug, rule.field, userId)
  }
  const plans = (data.schedules as { learners?: unknown[] }[]) || []
  const also = await rowsFor(payload, 'schedules', 'learners', userId).catch(() => [])
  if (also.length) data.schedules = [...plans, ...also.filter((row) => !plans.some((plan) => plan && (plan as { id?: number }).id === (row as { id?: number }).id))]
  return data
}

function htmlFrom(data: Record<string, unknown>) {
  const profile = data.profile as { name?: string; email?: string }
  const sections = Object.entries(data)
    .filter(([key]) => key !== 'profile' && key !== 'exportedAt')
    .map(([key, value]) => {
      const rows = Array.isArray(value) ? value : []
      const items = rows
        .slice(0, 200)
        .map((row) => `<li>${escape((row as { title?: string; body?: string; name?: string }).title || (row as { body?: string }).body || JSON.stringify(row).slice(0, 180))}</li>`)
        .join('')
      return `<h2>${escape(key)}</h2><p>${rows.length} row${rows.length === 1 ? '' : 's'}</p><ul>${items}</ul>`
    })
    .join('')
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>My HEARTS data</title></head><body style="font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem;background:#0E2A2B;color:#F6EEDC"><h1>Your HEARTS data</h1><p>${escape(String(profile.name || ''))} · ${escape(String(profile.email || ''))}</p>${sections}</body></html>`
}

function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function exportDir() {
  const dir = path.join(process.cwd(), 'data', 'my-data')
  mkdirSync(dir, { recursive: true })
  return dir
}

export async function buildMyDataZip(payload: Payload, userId: number) {
  const data = await gatherMyData(payload, userId)
  const zip = new JSZip()
  zip.file('data.json', JSON.stringify(data, null, 2))
  zip.file('my-hearts.html', htmlFrom(data))
  const mediaIds = new Set<number>()
  for (const slug of ['answers', 'workbook-entries', 'harvest-entries', 'gather-photos']) {
    for (const row of (data[slug] as Record<string, unknown>[]) || []) {
      for (const key of ['image', 'audio', 'video', 'photo', 'file']) {
        const id = idOf(row[key])
        if (id) mediaIds.add(id)
      }
    }
  }
  for (const id of mediaIds) {
    const media = (await payload.findByID({ collection: 'media', id, overrideAccess: true, depth: 0 }).catch(() => null)) as { filename?: string; url?: string } | null
    if (!media?.filename) continue
    const file = path.join(process.cwd(), 'media', media.filename)
    if (existsSync(file)) zip.file(`uploads/${media.filename}`, readFileSync(file))
  }
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const token = randomToken(24)
  const fileName = `${userId}-${token}.zip`
  writeFileSync(path.join(exportDir(), fileName), bytes)
  const expiresAt = new Date(now().getTime() + DATA_EXPORT_MS).toISOString()
  await payload.update({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    data: { lastDataExportAt: now().toISOString(), dataExportToken: hashToken(token), dataExportExpiresAt: expiresAt, dataExportFile: fileName } as never,
  })
  return { token, expiresAt, fileName, bytes }
}

export function readExportFile(fileName: string) {
  const safe = path.basename(fileName)
  const file = path.join(exportDir(), safe)
  if (!existsSync(file)) return null
  return readFileSync(file)
}
