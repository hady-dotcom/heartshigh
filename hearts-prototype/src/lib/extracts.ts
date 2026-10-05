// Many extracts on one talk. An appetiser is a hook, turn and land. Hors d'oeuvres sit inside it.
// Density target: 1 hors d'oeuvre per 6 minutes, 1 full appetiser per 15 minutes.

import { saidInTalk } from './tiers'
import type { PieceRef } from './nesting'
import { talkChain } from './nesting'

export const HORS_TARGET_MINUTES = 6
export const APPETISER_TARGET_MINUTES = 15
export const OVERLAP_SLACK = 1

export type ExtractKind = 'hors' | 'appetiser'
export type ExtractStatus = 'draft' | 'suggested' | 'approved' | 'rejected'
export type ExtractArc = 'hook' | 'turn' | 'land'

export type TimedWord = { at: number; text: string }

export type TalkExtract = {
  id?: number
  lesson: number
  kind: ExtractKind
  start: number
  end: number
  quote: string
  words?: TimedWord[] | null
  score?: number | null
  status: ExtractStatus
  door?: number | null
  seat?: number | null
  order: number
  parent?: number | null
  arc?: ExtractArc | null
  hook?: string | null
  turn?: string | null
  land?: string | null
  source?: string | null
}

export type DensityReport = {
  minutes: number
  horsTarget: number
  appetiserTarget: number
  hors: number
  appetiser: number
  horsDraft: number
  appetiserDraft: number
  horsSuggested: number
  appetiserSuggested: number
  horsMet: boolean
  appetiserMet: boolean
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function densityTargets(durationSeconds: number) {
  const minutes = Math.max(0, Number(durationSeconds) || 0) / 60
  return {
    minutes,
    hors: Math.max(1, Math.round(minutes / HORS_TARGET_MINUTES) || 1),
    appetiser: Math.max(1, Math.round(minutes / APPETISER_TARGET_MINUTES) || 1),
  }
}

/** Learners only meet approved extracts. Suggested is an AI pick waiting on the admin timeline. */
export function extractVisible(extract: Pick<TalkExtract, 'status'>, _showUnchecked = false) {
  return extract.status === 'approved'
}

export function densityReport(durationSeconds: number, extracts: TalkExtract[]): DensityReport {
  const targets = densityTargets(durationSeconds)
  const hors = extracts.filter((row) => row.kind === 'hors')
  const appetiser = extracts.filter((row) => row.kind === 'appetiser')
  const horsApproved = hors.filter((row) => row.status === 'approved').length
  const appetiserApproved = appetiser.filter((row) => row.status === 'approved').length
  return {
    minutes: targets.minutes,
    horsTarget: targets.hors,
    appetiserTarget: targets.appetiser,
    hors: horsApproved,
    appetiser: appetiserApproved,
    horsDraft: hors.filter((row) => row.status === 'draft').length,
    appetiserDraft: appetiser.filter((row) => row.status === 'draft').length,
    horsSuggested: hors.filter((row) => row.status === 'suggested').length,
    appetiserSuggested: appetiser.filter((row) => row.status === 'suggested').length,
    horsMet: horsApproved >= targets.hors,
    appetiserMet: appetiserApproved >= targets.appetiser,
  }
}

export function windowInside(inner: { start: number; end: number }, outer: { start: number; end: number }, slack = OVERLAP_SLACK) {
  return inner.start >= outer.start - slack && inner.end <= outer.end + slack
}

export function windowsOverlap(left: { start: number; end: number }, right: { start: number; end: number }, slack = 0) {
  return left.start < right.end - slack && right.start < left.end - slack
}

export function sameTypeOverlapProblem(extracts: TalkExtract[]) {
  const live = extracts.filter((row) => row.status !== 'rejected')
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      if (live[i].kind !== live[j].kind) continue
      if (!windowsOverlap(live[i], live[j])) continue
      const kind = live[i].kind === 'hors' ? "hors d'oeuvres" : 'appetisers'
      return `Two ${kind} overlap. Keep the same kind of extract from covering the same stretch.`
    }
  }
  return null
}

export function timeInTalkProblem(extract: { start: number; end: number }, duration: number | null) {
  if (!(extract.end > extract.start)) return 'The extract has to end after it starts.'
  if (extract.start < 0) return 'Times start at 0.'
  if (duration && extract.end > duration + 0.05) return `That extract ends after the talk (${Math.round(duration)} seconds).`
  return null
}

/** Which part of the appetiser arc a hors sits in: a named span, or thirds of the window. */
export function arcOfHors(
  hors: { start: number; end: number },
  appetiser: { start: number; end: number; hook?: string | null; turn?: string | null; land?: string | null },
  spans?: { role?: ExtractArc; start: number; end: number }[] | null,
) {
  const mid = (hors.start + hors.end) / 2
  const named = (spans || []).filter((span) => span.role && mid >= span.start - OVERLAP_SLACK && mid <= span.end + OVERLAP_SLACK)
  if (named.length) return named.sort((a, b) => a.end - a.start - (b.end - b.start))[0].role as ExtractArc
  const length = Math.max(0.001, appetiser.end - appetiser.start)
  const third = length / 3
  if (mid < appetiser.start + third) return 'hook'
  if (mid < appetiser.start + third * 2) return 'turn'
  return 'land'
}

/** Tightest appetiser whose window holds this hors. */
export function parentAppetiserFor(hors: TalkExtract, appetisers: TalkExtract[]) {
  const holding = appetisers.filter((row) => row.kind === 'appetiser' && windowInside(hors, row))
  if (!holding.length) return null
  return holding.sort((a, b) => a.end - a.start - (b.end - b.start) || a.start - b.start)[0]
}

/**
 * When an appetiser is created or nudged, attach every hors whose time falls inside it.
 * A follow-up file may later name the real parents; until then we compute them by overlap.
 */
export function attachHorsToAppetisers(extracts: TalkExtract[]): TalkExtract[] {
  const appetisers = extracts.filter((row) => row.kind === 'appetiser')
  return extracts.map((row) => {
    if (row.kind !== 'hors') return { ...row, parent: row.parent ?? null, arc: null }
    // A later file may name the real parent. Keep that name when the window still holds.
    const named = row.parent != null ? appetisers.find((appetiser) => appetiser.id === row.parent && windowInside(row, appetiser)) : null
    const parent = named || parentAppetiserFor(row, appetisers)
    if (!parent) return { ...row, parent: null, arc: row.arc ?? null }
    return { ...row, parent: parent.id ?? row.parent ?? null, arc: row.arc || arcOfHors(row, parent) }
  })
}

export function horsInsideAppetiser(appetiser: TalkExtract, extracts: TalkExtract[]) {
  return extracts.filter((row) => row.kind === 'hors' && windowInside(row, appetiser))
}

export type TimelineGroup = {
  appetiser: TalkExtract
  hors: TalkExtract[]
  empty: boolean
}

export function nestForTimeline(extracts: TalkExtract[]): { groups: TimelineGroup[]; orphans: TalkExtract[] } {
  const linked = attachHorsToAppetisers(extracts)
  const appetisers = linked.filter((row) => row.kind === 'appetiser').sort((a, b) => a.start - b.start || (a.order || 0) - (b.order || 0))
  const hors = linked.filter((row) => row.kind === 'hors')
  const used = new Set<number>()
  const groups = appetisers.map((appetiser) => {
    const children = hors
      .filter((row) => (appetiser.id != null && row.parent === appetiser.id) || (!row.parent && windowInside(row, appetiser)))
      .sort((a, b) => a.start - b.start)
    for (const child of children) if (child.id != null) used.add(child.id)
    return { appetiser, hors: children, empty: children.length === 0 }
  })
  const orphans = hors.filter((row) => row.id == null || !used.has(row.id)).sort((a, b) => a.start - b.start)
  return { groups, orphans }
}

export type TierLike = {
  lesson?: number
  horsStart: number
  horsEnd: number
  horsQuote?: string | null
  horsLines?: unknown
  appetiserStart: number
  appetiserEnd: number
  hook?: string | null
  turn?: string | null
  land?: string | null
  appetiserSpans?: { role?: ExtractArc; start: number; end: number }[] | null
  status?: string | null
}

function lineList(value: unknown): TimedWord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const at = Number((row as { at?: unknown }).at)
    const text = String((row as { text?: unknown }).text || '').trim()
    return Number.isFinite(at) && text ? [{ at, text }] : []
  })
}

export function parseExtractStatus(value: unknown): ExtractStatus {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'approved' || raw === 'checked' || raw === 'live' || raw === 'published') return 'approved'
  if (raw === 'rejected') return 'rejected'
  if (raw === 'draft') return 'draft'
  if (raw === 'suggested' || raw === 'pass' || raw === 'ai' || raw === 'machine') return 'suggested'
  return 'draft'
}

export function extractStatusFromTier(status: string | null | undefined): ExtractStatus {
  if (status === 'checked' || status === 'approved' || status === 'live') return 'approved'
  if (status === 'rejected') return 'rejected'
  return 'suggested'
}

export function extractStatusFromSheet(status: string): ExtractStatus | null {
  const raw = status.trim().toLowerCase()
  if (!raw || raw === 'delete') return null
  if (raw === 'approved' || raw === 'checked' || raw === 'live' || raw === 'published') return 'approved'
  if (raw === 'rejected') return 'rejected'
  if (raw === 'draft') return 'draft'
  return 'suggested'
}

/** Copy the old single pair on a talk-tier into two extracts, hors nested under the appetiser. */
export function extractsFromTier(tier: TierLike, lessonId = Number(tier.lesson || 0)): TalkExtract[] {
  const status = extractStatusFromTier(tier.status)
  const appetiser: TalkExtract = {
    lesson: lessonId,
    kind: 'appetiser',
    start: Number(tier.appetiserStart),
    end: Number(tier.appetiserEnd),
    quote: String(tier.land || tier.hook || ''),
    hook: tier.hook || '',
    turn: tier.turn || '',
    land: tier.land || '',
    status,
    order: 1,
    parent: null,
    arc: null,
    source: 'talk-tier',
  }
  const hors: TalkExtract = {
    lesson: lessonId,
    kind: 'hors',
    start: Number(tier.horsStart),
    end: Number(tier.horsEnd),
    quote: String(tier.horsQuote || ''),
    words: lineList(tier.horsLines),
    status,
    order: 1,
    parent: appetiser.id ?? null,
    arc: arcOfHors({ start: Number(tier.horsStart), end: Number(tier.horsEnd) }, appetiser, tier.appetiserSpans),
    source: 'talk-tier',
  }
  return attachHorsToAppetisers([appetiser, hors])
}

export function extractParents(hors: TalkExtract, appetiser: TalkExtract | null, lessonId: number): { hors: PieceRef; appetiser: PieceRef } {
  const chain = talkChain(lessonId)
  const appetiserId = appetiser?.id != null ? `appetiser:${appetiser.id}` : chain.hors.parentId
  return {
    hors: {
      id: hors.id != null ? `hors:${hors.id}` : chain.hors.id,
      level: 'hors',
      parentId: appetiserId,
      parentLevel: 'appetiser',
    },
    appetiser: {
      id: appetiser?.id != null ? `appetiser:${appetiser.id}` : chain.appetiser.id,
      level: 'appetiser',
      parentId: chain.appetiser.parentId,
      parentLevel: 'talk',
    },
  }
}

export function wordsToLines(words: TimedWord[] | null | undefined) {
  if (!words?.length) return undefined
  return words.map((word) => ({ at: word.at, text: word.text }))
}

export function sameExtractWindow(left: { kind: ExtractKind; start: number; end: number }, right: { kind: ExtractKind; start: number; end: number }, slack = 0.6) {
  return left.kind === right.kind && Math.abs(left.start - right.start) <= slack && Math.abs(left.end - right.end) <= slack
}

export function orderExtracts(extracts: TalkExtract[]) {
  return [...extracts].sort((a, b) => a.start - b.start || (a.order || 0) - (b.order || 0) || Number(a.id || 0) - Number(b.id || 0)).map((row, index) => ({
    ...row,
    order: index + 1,
  }))
}

type Sentence = { start: number; end: number }

/** Move the in or out point by one sentence, staying on the pause around it. */
export function nudgeBySentence(extract: TalkExtract, sentences: Sentence[], edge: 'start' | 'end', step: -1 | 1): TalkExtract | null {
  if (!sentences.length) return null
  const at = edge === 'start' ? extract.start : extract.end
  let index = 0
  let best = Infinity
  for (const [i, sentence] of sentences.entries()) {
    const point = edge === 'start' ? sentence.start : sentence.end
    const gap = Math.abs(point - at)
    if (gap < best) {
      best = gap
      index = i
    }
  }
  const next = index + step
  if (next < 0 || next >= sentences.length) return null
  const point = edge === 'start' ? sentences[next].start : sentences[next].end
  const start = edge === 'start' ? point : extract.start
  const end = edge === 'end' ? point : extract.end
  if (!(end > start)) return null
  return { ...extract, start: round2(start), end: round2(end) }
}

export function extractKindFromSheet(raw: string): ExtractKind | null {
  const text = raw.trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (!text) return null
  if (text === 'hors' || text === "hors d'oeuvre" || text === 'hors doeuvre' || text === 'phrase') return 'hors'
  if (text === 'appetiser' || text === 'appetizer' || text === 'app') return 'appetiser'
  return null
}

export function verbatimProblem(quote: string, source: string) {
  if (!quote.trim() || !source.trim()) return null
  return saidInTalk(quote, source) ? null : "The extract has to be the speaker's words, word for word from the transcript."
}

/** Drop a run of the same extract. Different extracts from one talk may sit next to each other. */
export function withoutBackToBackExtract<T extends { extractId?: number | null; id?: string }>(items: T[]) {
  const out: T[] = []
  for (const item of items) {
    const prev = out[out.length - 1]
    if (prev && item.extractId && prev.extractId === item.extractId) continue
    if (prev && !item.extractId && item.id && prev.id === item.id) continue
    out.push(item)
  }
  return out
}

export type ExtractableItem = {
  id: string
  lessonId: number
  extractId?: number | null
  parentExtractId?: number | null
  extracts?: TalkExtract[]
  hors: { start: number; end: number; quote: string; lines?: { at: number; text: string }[] }
  appetiser: { start: number; end: number; quote: string; lines?: { at: number; text: string; role?: ExtractArc }[] }
  hook: string
  turn: string
  land: string
  parents: { hors: ReturnType<typeof extractParents>['hors']; appetiser: ReturnType<typeof extractParents>['appetiser'] }
  card?: 'talk' | 'film' | 'text' | 'question' | 'scene'
}

/**
 * One feed item per approved hors when a talk holds several. A single hors stays one item
 * so existing talks (the old pair) keep their place in the loop.
 */
export function expandTalkExtracts<T extends ExtractableItem>(item: T, showUnchecked = false): T[] {
  if (item.card && item.card !== 'talk') return [item]
  if (item.extractId != null) return [item]
  const all = item.extracts || []
  const hors = all.filter((row) => row.kind === 'hors' && extractVisible(row, showUnchecked))
  const appetisers = all.filter((row) => row.kind === 'appetiser' && extractVisible(row, showUnchecked))
  const asItem = (row: TalkExtract): T => {
    const parent = (row.parent != null ? appetisers.find((appetiser) => appetiser.id === row.parent) : null) || parentAppetiserFor(row, appetisers)
    const lines = (row.words || []).map((word) => ({ at: word.at, text: word.text }))
    return {
      ...item,
      id: row.id != null ? `${item.id}-ex-${row.id}` : item.id,
      extractId: row.id ?? null,
      parentExtractId: parent?.id ?? null,
      hors: { start: row.start, end: row.end, quote: row.quote, lines: lines.length ? lines : undefined },
      appetiser: parent
        ? {
            start: parent.start,
            end: parent.end,
            quote: parent.land || parent.quote,
            lines: [
              parent.hook ? { at: parent.start, text: parent.hook, role: 'hook' as const } : null,
              parent.turn ? { at: parent.start + (parent.end - parent.start) / 2, text: parent.turn, role: 'turn' as const } : null,
              parent.land || parent.quote ? { at: parent.end, text: parent.land || parent.quote, role: 'land' as const } : null,
            ].filter((line): line is { at: number; text: string; role: ExtractArc } => Boolean(line)),
          }
        : item.appetiser,
      hook: parent?.hook || item.hook,
      turn: parent?.turn || item.turn,
      land: parent?.land || item.land,
      parents: extractParents(row, parent || null, item.lessonId),
    }
  }
  if (hors.length <= 1) {
    const only = hors[0]
    if (!only) return [item]
    return [{ ...asItem(only), id: item.id }]
  }
  return hors.map(asItem)
}

export function expandFeedItems<T extends ExtractableItem>(items: T[], showUnchecked = false): T[] {
  return items.flatMap((item) => expandTalkExtracts(item, showUnchecked))
}

/** Expand multi-hors talks, then drop a run of the same extract. */
export function presentClips<T extends ExtractableItem>(items: T[], showUnchecked = false): T[] {
  return withoutBackToBackExtract(expandFeedItems(items, showUnchecked))
}

export function groupExtractSummary(groups: TimelineGroup[], orphans: TalkExtract[]) {
  const empty = groups.filter((group) => group.empty).length
  const hors = groups.reduce((total, group) => total + group.hors.length, 0)
  const parts = [`${groups.length} ${groups.length === 1 ? 'appetiser' : 'appetisers'}`, `${hors} ${hors === 1 ? "hors d'oeuvre" : "hors d'oeuvres"}`]
  if (orphans.length) parts.push(`${orphans.length} ${orphans.length === 1 ? "hors d'oeuvre with no appetiser" : "hors d'oeuvres with no appetiser"}`)
  if (empty) parts.push(`${empty} ${empty === 1 ? 'appetiser with no hors d\'oeuvre yet' : 'appetisers with no hors d\'oeuvre yet'}`)
  return parts.join(' · ')
}

/** Suggested AI picks waiting on the admin timeline, in talk order. */
export function suggestedQueue(extracts: TalkExtract[]) {
  return extracts
    .filter((row) => row.status === 'suggested' && row.id != null)
    .sort((a, b) => a.start - b.start || (a.order || 0) - (b.order || 0) || Number(a.id) - Number(b.id))
}

export function neighborSuggested(extracts: TalkExtract[], currentId: number | null, step: 1 | -1) {
  const queue = suggestedQueue(extracts)
  if (!queue.length) return null
  const index = currentId == null ? 0 : queue.findIndex((row) => row.id === currentId)
  if (index < 0) return queue[0]?.id ?? null
  return queue[index + step]?.id ?? null
}

/** After approve or set aside, land on the next suggested pick still waiting. */
export function reviewAfterDecision(extracts: TalkExtract[], decidedId: number) {
  const remaining = suggestedQueue(extracts).filter((row) => row.id !== decidedId)
  const decided = extracts.find((row) => row.id === decidedId)
  if (!decided) return remaining[0]?.id ?? null
  return remaining.find((row) => row.start > decided.start || (row.start === decided.start && Number(row.id) > decidedId))?.id ?? remaining[0]?.id ?? null
}

export function withExtractParam(path: string, extractId: number | null) {
  const hashAt = path.indexOf('#')
  const before = hashAt >= 0 ? path.slice(0, hashAt) : path
  const after = hashAt >= 0 ? path.slice(hashAt) : ''
  const queryAt = before.indexOf('?')
  const pathname = queryAt >= 0 ? before.slice(0, queryAt) : before
  const params = new URLSearchParams(queryAt >= 0 ? before.slice(queryAt + 1) : '')
  if (extractId != null) params.set('extract', String(extractId))
  else params.delete('extract')
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}${after}`
}
