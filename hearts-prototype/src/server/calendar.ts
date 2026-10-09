import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { actionCta, approvedCopy, calendarContext, DEFAULT_CONTEXT_LINES, latitudeForZone, nudgeTalks, suggestedContextLine, type AdminSeason, type CalendarContext } from '@/lib/calendar-context'
import { formatSlotLabel } from '@/lib/experiment-slots'
import { isProduction } from '@/lib/env'
import { idOf } from '@/lib/ids'
import { hasMarkup } from '@/lib/text-safety'
import { killListHits } from '@/lib/opening-data'
import type { SessionUser } from './context'
import { audit } from './viewas'

const col = (name: string) => name as 'users'

export type CalendarActor = { id: number; role: SessionUser['role'] }

export function canViewCalendar(actor: CalendarActor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

export function canEditCalendar(actor: CalendarActor | null | undefined) {
  return actor?.role === 'master'
}

type Flags = { hijriOffset?: number | null; popularTalksOn?: boolean | null }

async function flagsOf(payload: Payload): Promise<Flags> {
  return ((await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as Flags | null) || {}
}

export async function hijriOffsetOf(payload: Payload) {
  const offset = Number((await flagsOf(payload)).hijriOffset)
  if (offset === 1 || offset === -1) return offset
  return 0
}

export async function loadSeasons(payload: Payload): Promise<AdminSeason[]> {
  const found = await payload.find({ collection: col('calendar-seasons'), overrideAccess: true, depth: 0, limit: 40, sort: '-start' })
  return found.docs.map((row) => ({
    key: String((row as { key?: string }).key || ''),
    name: String((row as { name?: string }).name || ''),
    theme: (row as { theme?: string }).theme || '',
    start: String((row as { start?: string }).start || '').slice(0, 10),
    end: String((row as { end?: string }).end || '').slice(0, 10),
  })).filter((row) => row.key && row.start && row.end)
}

export async function loadCopy(payload: Payload) {
  const found = await payload.find({ collection: col('calendar-copy'), overrideAccess: true, depth: 0, limit: 200, sort: '-updatedAt' })
  return found.docs.map((row) => ({
    id: Number(row.id),
    slot: String((row as { slot?: string }).slot || ''),
    context: String((row as { context?: string }).context || ''),
    label: String((row as { label?: string }).label || ''),
    approved: Boolean((row as { approved?: boolean }).approved),
    source: String((row as { source?: string }).source || 'staff'),
  }))
}

export async function contextAt(payload: Payload, at: Date = now(), hour?: number, weekday?: number, zone = 'Europe/London'): Promise<CalendarContext> {
  const [offset, seasons] = await Promise.all([hijriOffsetOf(payload), loadSeasons(payload)])
  const latitude = latitudeForZone(zone)
  return calendarContext({ at, offsetDays: offset, seasons, hour, weekday, timeZone: zone, latitude })
}

function seasonalFromPayload(payloadRow: Record<string, unknown>, context: CalendarContext) {
  for (const key of context.active) {
    const value = payloadRow[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function deadLearnMore(line: string) {
  return /^learn more\b/i.test(line.trim())
}

export async function resolveContextLabel(payload: Payload, slot: string, payloadRow: Record<string, unknown>, context: CalendarContext, minutes?: number) {
  const rows = await loadCopy(payload)
  const approved = approvedCopy(rows, slot, context)
  const fromVariant = seasonalFromPayload(payloadRow, context)
  const builtIn = context.active.map((key) => suggestedContextLine(slot, key)).find(Boolean) || ''
  const raw = approved || fromVariant || builtIn
  if (raw && !deadLearnMore(raw)) return actionCta(minutes ? formatSlotLabel(raw, minutes) : raw)
  return ''
}

export async function popularTalkIds(payload: Payload): Promise<number[]> {
  const weekAgo = new Date(now().getTime() - 7 * 86_400_000).toISOString()
  const [done, drawn] = await Promise.all([
    payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 500, pagination: false, where: { createdAt: { greater_than_equal: weekAgo } } }),
    payload.find({ collection: col('drawn-to'), overrideAccess: true, depth: 0, limit: 200 }).catch(() => ({ docs: [] as { speakerSlug?: string }[] })),
  ])
  const counts = new Map<number, number>()
  for (const row of done.docs as { lesson?: unknown }[]) {
    const id = idOf(row.lesson)
    if (id) counts.set(id, (counts.get(id) || 0) + 3)
  }
  // drawn-to is by speaker; we still surface most-finished talks as "popular inside HEARTS".
  void drawn
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id)
}

export async function orderTalks<T extends { id?: number; title?: string }>(payload: Payload, talks: T[], context: CalendarContext, usePopular?: boolean) {
  const flags = await flagsOf(payload)
  const popular = flags.popularTalksOn || usePopular ? await popularTalkIds(payload) : []
  return nudgeTalks(talks, context, popular, Boolean(flags.popularTalksOn || usePopular))
}

export async function setHijriOffset(payload: Payload, actor: CalendarActor, offset: number) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can set the moon-sighting offset.')
  const value = offset === 1 || offset === -1 ? offset : 0
  await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { hijriOffset: value } as never })
  await audit(payload, 'calendar.offset', { actor: actor.id, actorRole: actor.role, detail: { offset: value } })
}

export async function setPopularFlag(payload: Payload, actor: CalendarActor, on: boolean) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can change this.')
  await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { popularTalksOn: on } as never })
}

export async function saveSeason(payload: Payload, actor: CalendarActor, input: { id?: number; key: string; name: string; theme?: string; start: string; end: string }) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can add a season.')
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (!key) throw new Error('Give the season a short key.')
  const name = input.name.trim()
  if (name.length < 3) throw new Error('Give the season a name.')
  if (hasMarkup(name) || hasMarkup(input.theme || '')) throw new Error('Keep the words plain.')
  if (!input.start || !input.end) throw new Error('Write the dates as 4 October 2026.')
  const data = { key, name, theme: (input.theme || '').trim(), start: input.start, end: input.end }
  if (input.id) {
    await payload.update({ collection: col('calendar-seasons'), id: input.id, overrideAccess: true, data: data as never })
  } else {
    await payload.create({ collection: col('calendar-seasons'), overrideAccess: true, data: data as never })
  }
  await audit(payload, 'calendar.season', { actor: actor.id, actorRole: actor.role, detail: { key } })
}

function copyProblems(label: string) {
  const text = label.trim()
  if (!text) return ['Write a line first.']
  if (text.length > 80) return ['Keep the line under 80 characters.']
  if (hasMarkup(text)) return ['The line is plain text.']
  const hits = killListHits(text)
  if (hits.length) return [`The words ${hits.join(', ')} are not used in HEARTS.`]
  return []
}

export async function saveCopy(payload: Payload, actor: CalendarActor, input: { slot: string; context: string; label: string; source?: 'staff' | 'ai' | 'mock' }) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can write a seasonal line.')
  const problems = copyProblems(input.label)
  if (problems.length) throw new Error(problems[0])
  const created = await payload.create({
    collection: col('calendar-copy'),
    overrideAccess: true,
    data: {
      slot: input.slot,
      context: input.context,
      label: input.label.trim(),
      approved: false,
      source: input.source || 'staff',
      createdBy: actor.id,
    } as never,
  })
  await audit(payload, 'calendar.copy', { actor: actor.id, actorRole: actor.role, detail: { slot: input.slot, context: input.context } })
  return created
}

export async function setCopyApproval(payload: Payload, actor: CalendarActor, id: number, approved: boolean) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can approve a line.')
  await payload.update({
    collection: col('calendar-copy'),
    id,
    overrideAccess: true,
    data: { approved, approvedBy: approved ? actor.id : undefined } as never,
  })
}

export async function suggestSeasonal(payload: Payload, actor: CalendarActor, slot: string, contextKey: string) {
  if (!canEditCalendar(actor)) throw new Error('Only the master can ask for a draft.')
  const line = suggestedContextLine(slot, contextKey)
  if (!line) throw new Error('There is no built-in draft for that slot and day.')
  // Built-in lines only. The master desk does not call a model.
  void payload
  return saveCopy(payload, actor, { slot, context: contextKey, label: line, source: 'mock' })
}

export async function seedDefaultCopy(payload: Payload, actor?: CalendarActor | null) {
  const existing = await payload.find({ collection: col('calendar-copy'), overrideAccess: true, depth: 0, limit: 1 })
  if (existing.docs.length) return
  for (const [slot, lines] of Object.entries(DEFAULT_CONTEXT_LINES)) {
    for (const [context, label] of Object.entries(lines)) {
      await payload.create({
        collection: col('calendar-copy'),
        overrideAccess: true,
        data: { slot, context, label, approved: true, source: 'staff', createdBy: actor?.id } as never,
      })
    }
  }
}

export function previewSafe() {
  return !isProduction()
}
