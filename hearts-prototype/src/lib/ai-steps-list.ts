import { parse as parseQuery } from 'qs-esm'

/**
 * The desk polls GET /api/ai-steps?job=<id>. Payload's admin list, and the
 * relationship cell on AI step versions, call the same path with a collection
 * query (depth, limit, where). The custom route used to answer every one of
 * those with "Name the job."
 */

const QS = { allowEmptyArrays: true, arrayLimit: 1000, depth: 10, ignoreQueryPrefix: true } as const

const LIST_KEYS = new Set([
  'depth',
  'draft',
  'fallbackLocale',
  'joins',
  'limit',
  'locale',
  'page',
  'pagination',
  'populate',
  'select',
  'sort',
  'where',
])

export type AiStepsGetKind = { kind: 'job'; jobId: number } | { kind: 'list' } | { kind: 'bare' }

export function classifyAiStepsGet(search: string): AiStepsGetKind {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  if (params.has('job')) {
    const jobId = Number(params.get('job'))
    return { kind: 'job', jobId: Number.isFinite(jobId) && jobId > 0 ? jobId : 0 }
  }
  let parsed: Record<string, unknown> = {}
  try {
    parsed = parseQuery(raw, QS) as Record<string, unknown>
  } catch {
    return { kind: 'bare' }
  }
  for (const key of Object.keys(parsed)) {
    if (LIST_KEYS.has(key)) return { kind: 'list' }
  }
  return { kind: 'bare' }
}

export type AiStepsListArgs = {
  depth: number
  draft: boolean
  limit: number
  page?: number
  sort?: string
  where?: unknown
  select?: Record<string, unknown>
  locale?: string
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function tidySelect(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === 'true' || item === true) out[key] = true
    else if (item === 'false' || item === false) out[key] = false
    else if (item && typeof item === 'object') {
      const nested = tidySelect(item)
      if (nested) out[key] = nested
    }
  }
  return Object.keys(out).length ? out : undefined
}

/** The same query shape Payload's REST handler reads, capped so a list cell cannot ask for the whole table. */
export function aiStepsListArgs(search: string): AiStepsListArgs {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const parsed = parseQuery(raw, QS) as Record<string, unknown>
  let where = parsed.where
  if (typeof where === 'string' && where.trim()) {
    try {
      where = JSON.parse(where) as unknown
    } catch {
      where = undefined
    }
  }
  const depth = asNumber(parsed.depth)
  const limit = asNumber(parsed.limit)
  const page = asNumber(parsed.page)
  const draft = parsed.draft === true || parsed.draft === 'true'
  const sort = typeof parsed.sort === 'string' && parsed.sort.trim() ? parsed.sort : undefined
  const locale = typeof parsed.locale === 'string' && parsed.locale.trim() ? parsed.locale : undefined
  return {
    depth: depth !== undefined && depth >= 0 ? Math.min(Math.floor(depth), 2) : 0,
    draft,
    limit: limit !== undefined && limit > 0 ? Math.min(Math.floor(limit), 250) : 10,
    page: page !== undefined && page > 0 ? Math.floor(page) : undefined,
    sort,
    where,
    select: tidySelect(parsed.select),
    locale,
  }
}
