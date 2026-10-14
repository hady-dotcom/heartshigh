import type { Payload, Where } from 'payload'
import { assignByHash, subjectKey, type WeightRow } from '@/lib/experiment-assign'
import { autoWeights, banditStop, conversionRate, mulberry32, verdictFor, versionLetter, type Arm, type Verdict } from '@/lib/experiment-bandit'
import { designExperiment, type ExperimentSetup } from '@/lib/experiment-designer'
import { isSafetyMetric, safetyGuard, safetyLabel } from '@/lib/experiment-guard'
import { suggestWording, type DraftVariant } from '@/lib/experiment-copy'
import {
  EXPERIMENT_RULE,
  EXPERIMENT_SLOTS,
  experimentDraftProblems,
  fallbackPayload,
  formatSlotLabel,
  isTestableSlot,
  isTrackedEvent,
  metricLabel,
  payloadProblems,
  remainingVariantSlots,
  slotOf,
  variantCopy,
  withinFirstWeek,
} from '@/lib/experiment-slots'
import type { VariantView } from '@/lib/experiment-slots'
import { isDemoStageEmail } from '@/lib/demo-stage'
import { portalIsDemo } from './demo-activity'
import { clipStepUpLabel, talkStepUpLabel } from '@/lib/feed-copy'
import { DEFAULT_EXPERIMENT_DAYS, experimentEndsAt, presetExperimentKey, presetOf } from '@/lib/experiment-presets'
import { now } from '@/lib/clock'
import { contextAt, resolveContextLabel } from '@/server/calendar'
import { isProduction, isRemoteDatabase } from '@/lib/env'
import { idOf, portalIdOf } from '@/lib/ids'
import { clientFromConnection, portalAiGate, type LlmClient } from '@/lib/portal-ai'
import { storedForPortal } from '@/server/portal-ai'
import { audit } from './viewas'
import type { SessionUser } from './context'

const col = (name: string) => name as 'users'

export type Actor = { id: number; role: SessionUser['role']; name?: string | null; email?: string; tenants?: { tenant?: unknown }[] }

export type ExperimentVariant = {
  key: string
  label: string
  payload: Record<string, unknown>
  weight: number
  approved: boolean
  source: 'staff' | 'ai' | 'mock'
}

export type ExperimentDoc = {
  id: number
  key: string
  name: string
  description?: string | null
  status: 'draft' | 'running' | 'paused' | 'finished'
  slot: string
  surface: string
  portal?: unknown
  allocation: 'fixed' | 'auto'
  primaryMetric: string
  secondaryMetrics?: string[] | null
  guardrailNote?: string | null
  variants: ExperimentVariant[]
  defaultVariant?: string | null
  winnerKey?: string | null
  promoted?: boolean | null
  createdBy?: unknown
  approvedBy?: unknown
  startedAt?: string | null
  finishedAt?: string | null
  durationDays?: number | null
  createdAt?: string
  updatedAt?: string
}

export type Subject = { kind: 'learner' | 'device'; id: string; learnerId?: number; deviceId?: string; portalId?: number | null }

type Flags = { experimentsOff?: boolean | null; experimentDefaults?: Record<string, { payload?: Record<string, unknown>; experimentKey?: string; variantKey?: string }> | null }

export function canViewExperiments(actor: Actor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

export function canEditExperiments(actor: Actor | null | undefined) {
  return actor?.role === 'master'
}

export function canDesignExperiments(actor: Actor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

function assertView(actor: Actor) {
  if (!canViewExperiments(actor)) throw new Error('Experiments are for the master desk and portal admins.')
}

function assertEdit(actor: Actor) {
  if (!canEditExperiments(actor)) throw new Error('Only the master can create or change an experiment.')
}

function assertDesign(actor: Actor) {
  if (!canDesignExperiments(actor)) throw new Error('Only the master or a portal admin can start an experiment.')
}

function asDoc(row: Record<string, unknown>): ExperimentDoc {
  const variants: ExperimentVariant[] = ((row.variants as ExperimentVariant[] | undefined) || []).map((item) => ({
    key: String(item.key || ''),
    label: String(item.label || ''),
    payload: item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) ? (item.payload as Record<string, unknown>) : {},
    weight: Number(item.weight || 0),
    approved: Boolean(item.approved),
    source: (item.source === 'ai' || item.source === 'mock' ? item.source : 'staff') as ExperimentVariant['source'],
  }))
  const secondary = Array.isArray(row.secondaryMetrics)
    ? (row.secondaryMetrics as unknown[]).map((item) => String(item)).filter(Boolean)
    : typeof row.secondaryMetrics === 'string'
      ? String(row.secondaryMetrics).split(',').map((item) => item.trim()).filter(Boolean)
      : []
  return {
    id: Number(row.id),
    key: String(row.key || ''),
    name: String(row.name || ''),
    description: row.description ? String(row.description) : '',
    status: (['draft', 'running', 'paused', 'finished'] as const).includes(row.status as never) ? (row.status as ExperimentDoc['status']) : 'draft',
    slot: String(row.slot || ''),
    surface: String(row.surface || slotOf(String(row.slot || ''))?.surface || 'feed'),
    portal: row.portal,
    allocation: row.allocation === 'auto' ? 'auto' : 'fixed',
    primaryMetric: String(row.primaryMetric || 'clip_cta_tap'),
    secondaryMetrics: secondary,
    guardrailNote: row.guardrailNote ? String(row.guardrailNote) : EXPERIMENT_RULE,
    variants,
    defaultVariant: row.defaultVariant ? String(row.defaultVariant) : variants[0]?.key || null,
    winnerKey: row.winnerKey ? String(row.winnerKey) : null,
    promoted: Boolean(row.promoted),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    startedAt: row.startedAt ? String(row.startedAt) : null,
    finishedAt: row.finishedAt ? String(row.finishedAt) : null,
    durationDays: Number(row.durationDays) > 0 ? Number(row.durationDays) : DEFAULT_EXPERIMENT_DAYS,
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  }
}

async function flagsOf(payload: Payload): Promise<Flags> {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as Flags | null
  return flags || {}
}

export async function experimentsKilled(payload: Payload) {
  const flags = await flagsOf(payload)
  return Boolean(flags.experimentsOff)
}

export async function promotedDefault(payload: Payload, slot: string): Promise<Record<string, unknown> | null> {
  const flags = await flagsOf(payload)
  const row = flags.experimentDefaults?.[slot]
  return row?.payload && typeof row.payload === 'object' ? row.payload : null
}

export function experimentProblems(input: Parameters<typeof experimentDraftProblems>[0]) {
  return experimentDraftProblems(input)
}

async function writeAudit(payload: Payload, actor: Actor, event: string, detail: Record<string, unknown>, portal?: unknown) {
  await audit(payload, event, {
    actor: actor.id,
    actorRole: actor.role,
    portal: idOf(portal) || portalIdOf(actor) || undefined,
    detail,
  })
}

const STARTERS: Omit<ExperimentDoc, 'id' | 'createdBy' | 'approvedBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    key: 'feed-cta-label',
    name: 'Feed clip CTA label',
    description: 'Three ways to invite a learner from a short clip into the longer cut.',
    status: 'draft',
    slot: 'feed-cta-label',
    surface: 'feed',
    allocation: 'fixed',
    primaryMetric: 'clip_cta_tap',
    secondaryMetrics: ['clip_watch_completion', 'appetiser_complete'],
    guardrailNote: EXPERIMENT_RULE,
    variants: [
      { key: 'ready', label: 'Ready for more?', payload: { label: 'Ready for more?' }, weight: 1, approved: true, source: 'staff' },
      { key: 'three-min', label: 'Watch the 3-minute version', payload: { label: 'Watch the 3-minute version' }, weight: 1, approved: true, source: 'staff' },
      { key: 'hear-more', label: 'Hear more of this', payload: { label: 'Hear more of this' }, weight: 1, approved: true, source: 'staff' },
    ],
    defaultVariant: 'ready',
    winnerKey: null,
    promoted: false,
    startedAt: null,
    finishedAt: null,
  },
  {
    key: 'full-talk-cta',
    name: 'Full-talk CTA',
    description: 'How the appetiser invites the learner into the whole sitting.',
    status: 'draft',
    slot: 'full-talk-cta-label',
    surface: 'feed',
    allocation: 'fixed',
    primaryMetric: 'full_talk_start',
    secondaryMetrics: ['full_talk_complete', 'clip_cta_tap'],
    guardrailNote: EXPERIMENT_RULE,
    variants: [
      { key: 'watch-whole', label: 'Watch the whole talk (N min)', payload: { label: 'Watch the whole talk ({n} min)' }, weight: 1, approved: true, source: 'staff' },
      { key: 'start-course', label: 'Start this course', payload: { label: 'Start this course' }, weight: 1, approved: true, source: 'staff' },
    ],
    defaultVariant: 'watch-whole',
    winnerKey: null,
    promoted: false,
    startedAt: null,
    finishedAt: null,
  },
  {
    key: 'wide-video-framing',
    name: 'Wide-video framing',
    description: 'Split (small uncropped video on top, timed words below) versus the current face-crop. The split player is not wired yet; this only registers the slot.',
    status: 'draft',
    slot: 'wide-video-framing',
    surface: 'feed',
    allocation: 'fixed',
    primaryMetric: 'clip_watch_completion',
    secondaryMetrics: ['clip_cta_tap'],
    guardrailNote: EXPERIMENT_RULE,
    variants: [
      { key: 'split', label: 'Split', payload: { framing: 'split' }, weight: 1, approved: true, source: 'staff' },
      { key: 'face-crop', label: 'Face-crop', payload: { framing: 'face-crop' }, weight: 1, approved: true, source: 'staff' },
    ],
    defaultVariant: 'face-crop',
    winnerKey: null,
    promoted: false,
    startedAt: null,
    finishedAt: null,
  },
  {
    key: 'lanes-tab-label',
    name: 'Lanes tab label',
    description: 'The bottom-bar word for the lanes tab: Lanes (control) versus Explore. Counts taps on that tab, and courses started from it in the first week after assignment.',
    status: 'draft',
    slot: 'lanes-tab-label',
    surface: 'lanes',
    allocation: 'fixed',
    primaryMetric: 'lanes_tab_tap',
    secondaryMetrics: ['lanes_course_start'],
    guardrailNote: EXPERIMENT_RULE,
    variants: [
      { key: 'lanes', label: 'Lanes', payload: { label: 'Lanes' }, weight: 1, approved: true, source: 'staff' },
      { key: 'explore', label: 'Explore', payload: { label: 'Explore' }, weight: 1, approved: true, source: 'staff' },
    ],
    defaultVariant: 'lanes',
    winnerKey: null,
    promoted: false,
    startedAt: null,
    finishedAt: null,
  },
]

export async function ensureStarterExperiments(payload: Payload, actor?: Actor | null) {
  for (const starter of STARTERS) {
    const existing = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: starter.key } } })
    if (existing.docs.length) continue
    await payload.create({
      collection: col('experiments'),
      overrideAccess: true,
      data: {
        ...starter,
        portal: undefined,
        createdBy: actor?.id,
        guardrailNote: EXPERIMENT_RULE,
      } as never,
    })
  }
}

export async function loadExperiment(payload: Payload, idOrKey: string | number): Promise<ExperimentDoc | null> {
  if (typeof idOrKey === 'number' || /^\d+$/.test(String(idOrKey))) {
    const row = await payload.findByID({ collection: col('experiments'), id: Number(idOrKey), depth: 0, overrideAccess: true }).catch(() => null)
    return row ? asDoc(row as never) : null
  }
  const found = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: String(idOrKey) } } })
  return found.docs[0] ? asDoc(found.docs[0] as never) : null
}

function portalWhere(actor: Actor): Where | undefined {
  if (actor.role === 'master') return undefined
  const portal = portalIdOf(actor)
  if (!portal) return { id: { equals: 0 } }
  return { or: [{ portal: { exists: false } }, { portal: { equals: portal } }] }
}

export async function listExperiments(payload: Payload, actor: Actor): Promise<ExperimentDoc[]> {
  assertView(actor)
  await ensureStarterExperiments(payload, actor)
  const found = await payload.find({
    collection: col('experiments'),
    overrideAccess: true,
    depth: 0,
    limit: 200,
    sort: '-updatedAt',
    where: portalWhere(actor),
  })
  return found.docs.map((row) => asDoc(row as never))
}

export async function createExperiment(payload: Payload, actor: Actor, input: {
  key: string
  name: string
  description?: string
  slot: string
  portalId?: number | null
  allocation?: 'fixed' | 'auto'
  primaryMetric: string
  secondaryMetrics?: string[]
  variants: ExperimentVariant[]
  durationDays?: number
}, options?: { designed?: boolean }): Promise<ExperimentDoc> {
  if (options?.designed) assertDesign(actor)
  else assertEdit(actor)
  const slot = slotOf(input.slot)
  const problems = experimentProblems(input)
  if (problems.length) throw new Error(problems[0])
  const existing = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: input.key } } })
  if (existing.docs.length) throw new Error('That key is already in use.')
  const created = await payload.create({
    collection: col('experiments'),
    overrideAccess: true,
    data: {
      key: input.key,
      name: input.name.trim(),
      description: (input.description || '').trim(),
      status: 'draft',
      slot: input.slot,
      surface: slot?.surface || 'feed',
      portal: input.portalId || undefined,
      allocation: input.allocation || 'fixed',
      primaryMetric: input.primaryMetric,
      secondaryMetrics: input.secondaryMetrics || [],
      guardrailNote: EXPERIMENT_RULE,
      variants: input.variants,
      defaultVariant: input.variants[0]?.key,
      createdBy: actor.id,
      durationDays: input.durationDays && input.durationDays > 0 ? input.durationDays : DEFAULT_EXPERIMENT_DAYS,
    } as never,
  })
  const doc = asDoc(created as never)
  await writeAudit(payload, actor, 'experiment.create', { id: doc.id, key: doc.key, name: doc.name, slot: doc.slot }, input.portalId)
  return doc
}

export async function createLabelExperiment(payload: Payload, actor: Actor, input: {
  slot?: string
  label?: string
  reason?: string
  portalId?: number | null
}) {
  const slot = input.slot && isTestableSlot(input.slot) ? input.slot : 'feed-cta-label'
  const control = slot === 'full-talk-cta-label' ? talkStepUpLabel(1) : clipStepUpLabel()
  let label = String(input.label || '').trim()
  if (!label || /^learn more\b/i.test(label)) {
    const context = await contextAt(payload, now())
    label = await resolveContextLabel(payload, slot, {}, context)
  }
  if (!label || /^learn more\b/i.test(label)) label = control === clipStepUpLabel() ? 'Watch a short clip for this season' : control
  const key = `label-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 40)
  return createExperiment(payload, actor, {
    key,
    name: (input.reason || `Test ${label}`).slice(0, 80),
    description: input.reason || `Variant B is ${label}`,
    slot,
    portalId: input.portalId,
    allocation: 'fixed',
    primaryMetric: slot === 'lanes-tab-label' ? 'lanes_tab_tap' : 'clip_cta_tap',
    variants: [
      { key: 'a', label: 'Usual', payload: { label: control }, weight: 1, approved: false, source: 'staff' },
      { key: 'b', label: 'Seasonal', payload: { label }, weight: 1, approved: false, source: 'staff' },
    ],
  })
}

/** Pick a preset, split traffic automatically, and start it for the default length. */
export async function createFromPreset(payload: Payload, actor: Actor, presetKey: string, portalId?: number | null) {
  const preset = presetOf(presetKey)
  if (!preset) throw new Error('Pick one of the tests on the list.')
  const running = await payload.find({
    collection: col('experiments'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ slot: { equals: preset.slot } }, { status: { equals: 'running' } }] },
  })
  if (running.docs[0]) {
    const existing = asDoc(running.docs[0] as never)
    const error = new Error('Another test is already running on this. Open it to pause or stop it.') as Error & { experimentId?: number }
    error.experimentId = existing.id
    throw error
  }
  const created = await createExperiment(payload, actor, {
    key: presetExperimentKey(preset.key),
    name: preset.name,
    description: preset.description,
    slot: preset.slot,
    portalId,
    allocation: 'auto',
    primaryMetric: preset.primaryMetric,
    durationDays: DEFAULT_EXPERIMENT_DAYS,
    variants: preset.variants.map((row) => ({
      key: row.key,
      label: row.label,
      payload: row.payload,
      weight: 1,
      approved: true,
      source: 'staff' as const,
    })),
  })
  return startExperiment(payload, actor, created.id)
}

/**
 * Turn a goal into a draft setup.
 * A portal admin with that portal’s own key, and a confirmed call, may use the designer.
 * Everyone else, including the master desk, gets a keyword preset. No platform key is read.
 */
export async function proposeExperiment(payload: Payload, actor: Actor, goal: string, portalId?: number | null, confirmed = false) {
  assertDesign(actor)
  const text = goal.trim()
  if (text.length < 3) throw new Error('Say what you are trying to solve, in a sentence.')
  const scoped = actor.role === 'portal-admin' ? portalIdOf(actor) : portalId || null
  const portal = scoped
    ? await payload.findByID({ collection: 'portals', id: scoped, depth: 0, overrideAccess: true }).catch(() => null) as { name?: string } | null
    : null
  let client: LlmClient | null = null
  if (actor.role === 'portal-admin' && scoped) {
    const stored = await storedForPortal(payload, scoped)
    if (stored) {
      const gate = portalAiGate({ role: 'portal-admin', realRole: actor.role, usePortalAi: true, confirmed })
      if (!gate.spend) throw new Error(gate.error || 'Confirm the call before it is sent.')
      client = clientFromConnection(stored)
    }
  }
  const setup = await designExperiment(text, { client, portalName: portal?.name || '' })
  return createFromDesign(payload, actor, setup, scoped)
}

/** Save a goal’s setup as a draft. It does not run until Start. */
export async function createFromDesign(payload: Payload, actor: Actor, setup: ExperimentSetup, portalId?: number | null) {
  assertDesign(actor)
  const scoped = actor.role === 'portal-admin' ? portalIdOf(actor) : portalId || null
  if (actor.role === 'portal-admin' && !scoped) throw new Error('This portal could not be found.')
  const created = await createExperiment(payload, actor, {
    key: presetExperimentKey(setup.presetKey || setup.slot),
    name: setup.name,
    description: `${setup.explanation}\n\nWho: ${setup.who}`,
    slot: setup.slot,
    portalId: scoped,
    allocation: 'auto',
    primaryMetric: setup.decidingMetric,
    secondaryMetrics: [setup.safetyMetric],
    durationDays: setup.durationDays,
    variants: setup.versions.map((row) => ({
      key: row.key,
      label: row.label,
      payload: row.payload,
      weight: 1,
      approved: true,
      source: setup.source === 'portal-ai' ? 'ai' as const : 'staff' as const,
    })),
  }, { designed: true })
  const note = `${EXPERIMENT_RULE} If ${safetyLabel(setup.safetyMetric).toLowerCase()} rise above the first version, the test pauses and the admin is told.`
  const updated = await payload.update({
    collection: col('experiments'),
    id: created.id,
    overrideAccess: true,
    data: { guardrailNote: note } as never,
  })
  return asDoc(updated as never)
}

export async function launchDesigned(payload: Payload, actor: Actor, id: number, edits: { name?: string; who?: string; labels?: Record<string, string> }) {
  assertDesign(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status !== 'draft') throw new Error('That setup has already been started.')
  if (actor.role === 'portal-admin') {
    const portal = portalIdOf(actor)
    if (!portal || idOf(current.portal) !== portal) throw new Error('That experiment is not for your portal.')
  }
  const labels = edits.labels || {}
  const variants = current.variants.map((row) => {
    const label = String(labels[row.key] || row.label).trim()
    const payloadValue = { ...row.payload }
    if (typeof payloadValue.label === 'string' || slotOf(current.slot)?.fields.some((field) => field.name === 'label')) payloadValue.label = label
    return { ...row, label, payload: payloadValue }
  })
  const who = String(edits.who || '').trim()
  const marker = '\n\nWho: '
  const held = String(current.description || '')
  const at = held.lastIndexOf(marker)
  const explanation = at === -1 ? held : held.slice(0, at)
  const description = who ? `${explanation}${marker}${who}` : held
  const name = String(edits.name || current.name).trim()
  await updateExperiment(payload, actor, id, {
    name,
    description,
    variants,
  }, { designed: true })
  return runExperiment(payload, actor, id)
}

export type ExperimentBrief = {
  tested: string
  portalName: string
  learnerLine: string
  startedLabel: string
  starterName: string
  sampleSize: number
  durationDays: number
  endsLabel: string
  appliedCopy: string
}

function personLabel(row: { name?: string | null; email?: string | null } | null | undefined) {
  const name = String(row?.name || '').trim()
  if (name) return name
  return ''
}

function londonDate(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
}

export async function experimentBrief(payload: Payload, actor: Actor, experiment: ExperimentDoc): Promise<ExperimentBrief> {
  assertView(actor)
  const portalFilter = actor.role === 'master' ? null : portalIdOf(actor)
  const where: Where = portalFilter
    ? { and: [{ experiment: { equals: experiment.id } }, { portal: { equals: portalFilter } }] }
    : { experiment: { equals: experiment.id } }
  const [assignments, sample] = await Promise.all([
    payload.find({ collection: col('experiment-assignments'), overrideAccess: true, depth: 0, limit: 40, where }),
    payload.count({ collection: col('experiment-assignments'), overrideAccess: true, where }),
  ])
  const learnerIds = [...new Set(assignments.docs.map((row) => idOf((row as { learner?: unknown }).learner)).filter((id): id is number => Boolean(id)))]
  const people = learnerIds.length
    ? await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: learnerIds.length, where: { id: { in: learnerIds } } })
    : { docs: [] as { id: number; name?: string | null }[] }
  const names = people.docs.map((person) => personLabel(person as { name?: string | null })).filter(Boolean)
  const shown = names.slice(0, 6)
  const extra = names.length - shown.length
  const portalIds = [...new Set([
    idOf(experiment.portal),
    ...assignments.docs.map((row) => idOf((row as { portal?: unknown }).portal)),
  ].filter((id): id is number => Boolean(id)))]
  const portals = portalIds.length
    ? await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: portalIds.length, where: { id: { in: portalIds } } })
    : { docs: [] as { id: number; name?: string | null }[] }
  const portalNames = portals.docs.map((portal) => String((portal as { name?: string }).name || '').trim()).filter(Boolean)
  const scoped = idOf(experiment.portal)
  const portalName = scoped ? portalNames[0] || 'One portal' : portalNames.length ? `Every portal · seen in ${portalNames.join(', ')}` : 'Every portal'
  const learnerLine = shown.length
    ? `${shown.join(', ')}${extra > 0 ? ` and ${extra} more` : ''}`
    : sample.totalDocs
      ? `${sample.totalDocs} ${sample.totalDocs === 1 ? 'person has' : 'people have'} been shown a version. Names stay off this line until a signed-in learner is assigned.`
      : 'No one has been shown a version yet.'
  const audits = await experimentAudit(payload, experiment.key, actor.role === 'master' ? null : portalIdOf(actor))
  const starts = audits.filter((row) => row.event === 'experiment.start')
  const starterId = idOf(starts[starts.length - 1]?.actor) || (experiment.status !== 'draft' ? idOf(experiment.createdBy) : null)
  const starter = starterId
    ? await payload.findByID({ collection: 'users', id: starterId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  const days = experiment.durationDays || DEFAULT_EXPERIMENT_DAYS
  const ends = experimentEndsAt(experiment.startedAt, days)
  const winner = experiment.variants.find((row) => row.key === (experiment.winnerKey || experiment.defaultVariant))
  return {
    tested: experiment.description || slotOf(experiment.slot)?.description || experiment.name,
    portalName,
    learnerLine,
    startedLabel: experiment.startedAt ? londonDate(experiment.startedAt) : 'Not started',
    starterName: experiment.status === 'draft' && !starts.length ? 'Not started yet' : personLabel(starter as { name?: string | null } | null) || 'Not recorded',
    sampleSize: sample.totalDocs,
    durationDays: days,
    endsLabel: ends ? londonDate(ends) : `Runs for ${days} days after you start it`,
    appliedCopy: experiment.promoted ? variantCopy(winner?.payload, winner?.label || '') : '',
  }
}

export async function updateExperiment(payload: Payload, actor: Actor, id: number, input: Partial<{
  name: string
  description: string
  allocation: 'fixed' | 'auto'
  primaryMetric: string
  secondaryMetrics: string[]
  variants: ExperimentVariant[]
  portalId: number | null
}>, options?: { designed?: boolean }): Promise<ExperimentDoc> {
  if (options?.designed) assertDesign(actor)
  else assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status === 'finished') throw new Error('A finished experiment cannot be edited. Start a new one if you want another test.')
  const nextVariants = input.variants || current.variants
  const problems = experimentProblems({
    key: current.key,
    name: input.name ?? current.name,
    slot: current.slot,
    primaryMetric: input.primaryMetric ?? current.primaryMetric,
    secondaryMetrics: input.secondaryMetrics ?? current.secondaryMetrics ?? [],
    variants: nextVariants,
    allocation: input.allocation ?? current.allocation,
  })
  if (problems.length) throw new Error(problems[0])
  if (current.status === 'running') {
    const keys = new Set(current.variants.map((row) => row.key))
    if (nextVariants.some((row) => !keys.has(row.key))) throw new Error('A running experiment can change weights, not add versions. Pause it first.')
  }
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: {
      name: (input.name ?? current.name).trim(),
      description: input.description ?? current.description,
      allocation: input.allocation ?? current.allocation,
      primaryMetric: input.primaryMetric ?? current.primaryMetric,
      secondaryMetrics: input.secondaryMetrics ?? current.secondaryMetrics,
      variants: nextVariants,
      portal: input.portalId === undefined ? current.portal : input.portalId || null,
    } as never,
  })
  const doc = asDoc(updated as never)
  await writeAudit(payload, actor, 'experiment.update', { id: doc.id, key: doc.key }, current.portal)
  return doc
}

export async function setVariantApproval(payload: Payload, actor: Actor, id: number, variantKey: string, approved: boolean) {
  assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  const variants = current.variants.map((row) => (row.key === variantKey ? { ...row, approved } : row))
  if (!variants.some((row) => row.key === variantKey)) throw new Error('That version is not on this experiment.')
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: { variants, approvedBy: approved ? actor.id : current.approvedBy } as never,
  })
  await writeAudit(payload, actor, approved ? 'experiment.approve_variant' : 'experiment.reject_variant', { id, key: current.key, variantKey }, current.portal)
  return asDoc(updated as never)
}

export async function addSuggestedVariants(payload: Payload, actor: Actor, id: number, drafts: DraftVariant[]) {
  assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status === 'finished') throw new Error('A finished experiment cannot take new versions.')
  const have = new Set(current.variants.map((row) => row.key))
  const extra: ExperimentVariant[] = []
  for (const draft of drafts) {
    const problems = payloadProblems(current.slot, draft.payload)
    if (problems.length) continue
    let key = draft.key
    let n = 2
    while (have.has(key)) {
      key = `${draft.key}-${n}`
      n += 1
    }
    have.add(key)
    extra.push({
      key,
      label: draft.label,
      payload: draft.payload,
      weight: 1,
      approved: false,
      source: draft.source === 'ai' ? 'ai' : 'mock',
    })
  }
  if (!extra.length) throw new Error('No new versions passed the checks.')
  const room = remainingVariantSlots(current.variants)
  if (room <= 0) throw new Error('Keep it to eight versions or fewer. Remove one before adding more.')
  const taking = extra.slice(0, room)
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: { variants: [...current.variants, ...taking] } as never,
  })
  await writeAudit(payload, actor, 'experiment.suggest', { id, key: current.key, added: taking.map((row) => row.key) }, current.portal)
  return { experiment: asDoc(updated as never), added: taking }
}

export async function startExperiment(payload: Payload, actor: Actor, id: number) {
  assertEdit(actor)
  return runExperiment(payload, actor, id)
}

async function runExperiment(payload: Payload, actor: Actor, id: number) {
  if (await experimentsKilled(payload)) throw new Error('The kill switch is on. No experiment can run until it is turned off.')
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status === 'finished') throw new Error('That experiment has finished.')
  const runnable = current.variants.filter((row) => row.approved && row.weight > 0)
  if (runnable.length < 2) throw new Error('Approve at least two versions, each with a weight above zero, before it can run.')
  const clash = await payload.find({
    collection: col('experiments'),
    overrideAccess: true,
    depth: 0,
    limit: 5,
    where: { and: [{ slot: { equals: current.slot } }, { status: { equals: 'running' } }, { id: { not_equals: id } }] },
  })
  if (clash.docs.length) throw new Error('Another experiment is already running on this slot. Pause or finish it first.')
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: { status: 'running', startedAt: current.startedAt || now().toISOString() } as never,
  })
  await writeAudit(payload, actor, 'experiment.start', { id, key: current.key }, current.portal)
  return asDoc(updated as never)
}

export async function pauseExperiment(payload: Payload, actor: Actor, id: number) {
  assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status !== 'running') throw new Error('Only a running experiment can be paused.')
  const updated = await payload.update({ collection: col('experiments'), id, overrideAccess: true, data: { status: 'paused' } as never })
  await writeAudit(payload, actor, 'experiment.pause', { id, key: current.key }, current.portal)
  return asDoc(updated as never)
}

export async function finishExperiment(payload: Payload, actor: Actor, id: number, winnerKey?: string) {
  assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  if (current.status === 'draft') throw new Error('A draft has not run yet, so there is nothing to finish.')
  const winner = winnerKey || current.winnerKey || current.defaultVariant || current.variants[0]?.key
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: { status: 'finished', finishedAt: now().toISOString(), winnerKey: winner } as never,
  })
  await writeAudit(payload, actor, 'experiment.finish', { id, key: current.key, winnerKey: winner }, current.portal)
  return asDoc(updated as never)
}

export async function promoteWinner(payload: Payload, actor: Actor, id: number, variantKey?: string) {
  assertEdit(actor)
  const current = await loadExperiment(payload, id)
  if (!current) throw new Error('That experiment was not found.')
  const key = variantKey || current.winnerKey
  const variant = current.variants.find((row) => row.key === key)
  if (!variant) throw new Error('Name the version that should become the default.')
  const flags = await flagsOf(payload)
  const defaults = { ...(flags.experimentDefaults || {}), [current.slot]: { payload: variant.payload, experimentKey: current.key, variantKey: variant.key } }
  await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { experimentDefaults: defaults } as never })
  const updated = await payload.update({
    collection: col('experiments'),
    id,
    overrideAccess: true,
    data: { winnerKey: variant.key, defaultVariant: variant.key, promoted: true, status: current.status === 'running' ? 'finished' : current.status, finishedAt: current.status === 'running' ? now().toISOString() : current.finishedAt } as never,
  })
  await writeAudit(payload, actor, 'experiment.promote', { id, key: current.key, variantKey: variant.key }, current.portal)
  return asDoc(updated as never)
}

export async function setKillSwitch(payload: Payload, actor: Actor, off: boolean) {
  assertEdit(actor)
  await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { experimentsOff: off } as never })
  if (off) {
    const running = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 100, where: { status: { equals: 'running' } } })
    for (const row of running.docs) {
      const doc = asDoc(row as never)
      await payload.update({ collection: col('experiments'), id: doc.id, overrideAccess: true, data: { status: 'paused' } as never })
      await writeAudit(payload, actor, 'experiment.kill', { id: doc.id, key: doc.key, off: true }, doc.portal)
    }
    if (!running.docs.length) await writeAudit(payload, actor, 'experiment.kill', { off: true })
  } else {
    await writeAudit(payload, actor, 'experiment.unkill', { off: false })
  }
}

type CountRow = { experiment: number; variantKey: string; kind: string; event: string; n: number }

async function eventCounts(payload: Payload, experimentId: number, portalId?: number | null): Promise<CountRow[]> {
  const where: Where = { experiment: { equals: experimentId } }
  if (portalId) Object.assign(where, { portal: { equals: portalId } })
  const found = await payload.find({
    collection: col('experiment-events'),
    overrideAccess: true,
    depth: 0,
    limit: 5000,
    pagination: false,
    where,
  })
  const bag = new Map<string, CountRow>()
  for (const row of found.docs as { experiment?: unknown; variantKey?: string; kind?: string; event?: string }[]) {
    const key = `${idOf(row.experiment)}|${row.variantKey}|${row.kind}|${row.event}`
    const held = bag.get(key)
    if (held) held.n += 1
    else bag.set(key, { experiment: idOf(row.experiment) || experimentId, variantKey: String(row.variantKey || ''), kind: String(row.kind || ''), event: String(row.event || ''), n: 1 })
  }
  return [...bag.values()]
}

export type VariantStats = {
  key: string
  label: string
  payload: Record<string, unknown>
  weight: number
  approved: boolean
  source: string
  exposures: number
  conversions: number
  rate: number
  chance: number
  letter: string
}

export type ExperimentResults = {
  experiment: ExperimentDoc
  variants: VariantStats[]
  verdict: Verdict
  killed: boolean
  totals: { exposures: number; conversions: number; assignments: number }
}

export async function resultsFor(payload: Payload, actor: Actor, id: number): Promise<ExperimentResults> {
  assertView(actor)
  const loaded = await loadExperiment(payload, id)
  if (!loaded) throw new Error('That experiment was not found.')
  const experiment = await enforceRunningPolicy(payload, loaded)
  if (actor.role !== 'master') {
    const portal = portalIdOf(actor)
    const scoped = idOf(experiment.portal)
    if (scoped && scoped !== portal) throw new Error('That experiment is not for your portal.')
  }
  const portalFilter = actor.role === 'master' ? null : portalIdOf(actor)
  const counts = await eventCounts(payload, experiment.id, portalFilter)
  const assignments = await payload.count({
    collection: col('experiment-assignments'),
    overrideAccess: true,
    where: portalFilter ? { and: [{ experiment: { equals: experiment.id } }, { portal: { equals: portalFilter } }] } : { experiment: { equals: experiment.id } },
  })
  const arms: Arm[] = experiment.variants.map((variant, index) => {
    const exposures = counts.filter((row) => row.variantKey === variant.key && row.kind === 'exposure').reduce((sum, row) => sum + row.n, 0)
    const conversions = counts.filter((row) => row.variantKey === variant.key && row.kind === 'conversion' && row.event === experiment.primaryMetric).reduce((sum, row) => sum + row.n, 0)
    return { key: variant.key, label: versionLetter(experiment.variants, variant.key) + ` · ${variant.label}`, exposures, conversions }
  })
  const chance = (await import('@/lib/experiment-bandit')).chanceOfBeingBest(arms, { rng: (await import('@/lib/experiment-bandit')).mulberry32(experiment.id * 97 + arms.reduce((sum, arm) => sum + arm.exposures * 13 + arm.conversions * 7, 0)) })
  const verdict = verdictFor(arms, { rng: (await import('@/lib/experiment-bandit')).mulberry32(experiment.id * 17 + 3) })
  const variants: VariantStats[] = experiment.variants.map((variant, index) => {
    const arm = arms[index]
    return {
      key: variant.key,
      label: variant.label,
      payload: variant.payload,
      weight: variant.weight,
      approved: variant.approved,
      source: variant.source,
      exposures: arm.exposures,
      conversions: arm.conversions,
      rate: conversionRate(arm.exposures, arm.conversions),
      chance: chance[variant.key] || 0,
      letter: versionLetter(experiment.variants, variant.key),
    }
  })
  return {
    experiment,
    variants,
    verdict,
    killed: await experimentsKilled(payload),
    totals: {
      exposures: variants.reduce((sum, row) => sum + row.exposures, 0),
      conversions: variants.reduce((sum, row) => sum + row.conversions, 0),
      assignments: assignments.totalDocs,
    },
  }
}

function liveVariants(experiment: ExperimentDoc, stats?: VariantStats[]): WeightRow[] {
  const runnable = experiment.variants.filter((row) => row.approved && (experiment.status !== 'running' || row.weight > 0))
  if (experiment.allocation !== 'auto' || experiment.status !== 'running' || !stats) {
    return runnable.map((row) => ({ key: row.key, weight: row.weight }))
  }
  const original = Object.fromEntries(runnable.map((row) => [row.key, row.weight]))
  const arms = stats.filter((row) => runnable.some((item) => item.key === row.key)).map((row) => ({ key: row.key, exposures: row.exposures, conversions: row.conversions }))
  const next = autoWeights(arms, original)
  return runnable.map((row) => ({ key: row.key, weight: Math.round((next[row.key] || 0) * 1000) }))
}

async function runningForSlot(payload: Payload, slot: string, portalId?: number | null): Promise<ExperimentDoc | null> {
  if (await experimentsKilled(payload)) return null
  if (!isTestableSlot(slot)) return null
  const found = await payload.find({
    collection: col('experiments'),
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ slot: { equals: slot } }, { status: { equals: 'running' } }] },
  })
  const docs = found.docs.map((row) => asDoc(row as never))
  const scoped = docs.find((row) => idOf(row.portal) && idOf(row.portal) === portalId)
  return scoped || docs.find((row) => !idOf(row.portal)) || null
}

export function subjectFrom(user: SessionUser | null | undefined, deviceId?: string | null, portalId?: number | null): Subject | null {
  if (isDemoStageEmail(user?.email)) return null
  if (user && (user.role === 'learner' || user.role === 'teacher' || user.role === 'portal-admin' || user.role === 'master')) {
    if (user.role === 'learner') {
      return { kind: 'learner', id: subjectKey('learner', user.id), learnerId: user.id, deviceId: deviceId || undefined, portalId: portalId ?? portalIdOf(user) }
    }
  }
  if (deviceId && /^[a-zA-Z0-9_-]{8,80}$/.test(deviceId)) {
    return { kind: 'device', id: subjectKey('device', deviceId), deviceId, portalId: portalId ?? null }
  }
  return null
}

async function storedAssignment(payload: Payload, experiment: ExperimentDoc, subject: Subject): Promise<{ variantKey: string; createdAt?: string } | null> {
  const where: Where = subject.kind === 'learner'
    ? { and: [{ experiment: { equals: experiment.id } }, { learner: { equals: subject.learnerId } }] }
    : { and: [{ experiment: { equals: experiment.id } }, { deviceId: { equals: subject.deviceId } }] }
  const found = await payload.find({ collection: col('experiment-assignments'), overrideAccess: true, depth: 0, limit: 1, where })
  const row = found.docs[0] as { variantKey?: string; createdAt?: string } | undefined
  if (!row?.variantKey) return null
  return { variantKey: String(row.variantKey), createdAt: row.createdAt ? String(row.createdAt) : undefined }
}

async function saveAssignment(payload: Payload, experiment: ExperimentDoc, subject: Subject, variantKey: string) {
  await payload.create({
    collection: col('experiment-assignments'),
    overrideAccess: true,
    data: {
      experiment: experiment.id,
      experimentKey: experiment.key,
      variantKey,
      subjectKind: subject.kind,
      learner: subject.learnerId,
      deviceId: subject.deviceId,
      subject: subject.id,
      portal: subject.portalId || idOf(experiment.portal) || undefined,
      sticky: true,
    } as never,
  })
}

async function alertSafety(payload: Payload, experiment: ExperimentDoc, metric: string) {
  const portalId = idOf(experiment.portal)
  const portal = portalId
    ? await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null) as { id?: number; slug?: string } | null
    : null
  const found = portalId
    ? await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 20, where: { and: [{ role: { equals: 'portal-admin' } }, { 'tenants.tenant': { equals: portalId } }] } })
    : await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 20, where: { role: { equals: 'master' } } })
  let people = found.docs as { id: number }[]
  if (!people.length && portalId) {
    const masters = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 10, where: { role: { equals: 'master' } } })
    people = masters.docs as { id: number }[]
  }
  const href = portal?.slug ? `/p/${portal.slug}/admin/experiments/${experiment.id}` : `/master/experiments/${experiment.id}`
  const title = 'An experiment paused itself'
  const body = `${experiment.name} is paused. ${safetyLabel(metric)} rose above the first version, so the test stopped on its own.`
  for (const person of people) {
    const key = `experiment-safety-${experiment.id}-${person.id}`
    const data = { user: person.id, portal: portalId || undefined, title, body, href, channel: 'in-app', key, read: false }
    const existing = await payload.find({ collection: 'notifications', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: person.id } }, { key: { equals: key } }] } })
    if (existing.docs[0]) await payload.update({ collection: 'notifications', id: existing.docs[0].id, overrideAccess: true, data })
    else await payload.create({ collection: 'notifications', overrideAccess: true, data })
  }
}

/**
 * The running engine. An automatic experiment stops at 95% or at 4 weeks,
 * and pauses itself when the safety metric rises above the first version.
 */
export async function enforceRunningPolicy(payload: Payload, experiment: ExperimentDoc): Promise<ExperimentDoc> {
  if (experiment.status !== 'running' || experiment.allocation !== 'auto') return experiment
  const counts = await eventCounts(payload, experiment.id)
  const arms: Arm[] = experiment.variants.map((variant) => ({
    key: variant.key,
    label: variant.label,
    exposures: counts.filter((row) => row.variantKey === variant.key && row.kind === 'exposure').reduce((sum, row) => sum + row.n, 0),
    conversions: counts.filter((row) => row.variantKey === variant.key && row.kind === 'conversion' && row.event === experiment.primaryMetric).reduce((sum, row) => sum + row.n, 0),
  }))
  const seed = experiment.id * 97 + arms.reduce((sum, arm) => sum + arm.exposures * 13 + arm.conversions * 7, 0)
  const decision = banditStop(arms, {
    rng: mulberry32(seed),
    draws: 1200,
    startedAt: experiment.startedAt,
    now: now().getTime(),
    maxWeeks: 4,
  })
  if (decision.stop) {
    const updated = await payload.update({
      collection: col('experiments'),
      id: experiment.id,
      overrideAccess: true,
      data: {
        status: 'finished',
        finishedAt: now().toISOString(),
        winnerKey: decision.reason === 'best' ? decision.leaderKey : experiment.winnerKey,
      } as never,
    })
    await audit(payload, 'experiment.bandit', {
      actor: idOf(experiment.createdBy) || undefined,
      actorRole: 'desk',
      portal: idOf(experiment.portal) || undefined,
      detail: { id: experiment.id, key: experiment.key, reason: decision.reason, variantKey: decision.leaderKey },
    })
    return asDoc(updated as never)
  }
  const metric = (experiment.secondaryMetrics || []).find((item) => isSafetyMetric(item))
  const control = experiment.variants[0]
  if (!metric || !control) return experiment
  const baseline = {
    exposures: arms.find((arm) => arm.key === control.key)?.exposures || 0,
    harms: counts.filter((row) => row.variantKey === control.key && row.event === metric).reduce((sum, row) => sum + row.n, 0),
  }
  const tripped = experiment.variants.slice(1).some((variant) => {
    const current = {
      exposures: arms.find((arm) => arm.key === variant.key)?.exposures || 0,
      harms: counts.filter((row) => row.variantKey === variant.key && row.event === metric).reduce((sum, row) => sum + row.n, 0),
    }
    return safetyGuard(baseline, current).dropped
  })
  if (!tripped) return experiment
  const updated = await payload.update({
    collection: col('experiments'),
    id: experiment.id,
    overrideAccess: true,
    data: { status: 'paused' } as never,
  })
  await audit(payload, 'experiment.safety', {
    actor: idOf(experiment.createdBy) || undefined,
    actorRole: 'desk',
    portal: idOf(experiment.portal) || undefined,
    detail: { id: experiment.id, key: experiment.key, metric },
  })
  await alertSafety(payload, experiment, metric)
  return asDoc(updated as never)
}

export async function assignVariant(payload: Payload, slot: string, subject: Subject | null): Promise<VariantView> {
  const fallback = fallbackPayload(slot)
  const promoted = await promotedDefault(payload, slot)
  const safe: VariantView = {
    slot,
    experimentKey: null,
    variantKey: null,
    payload: promoted || fallback,
    label: String((promoted || fallback).label || ''),
    framing: typeof (promoted || fallback).framing === 'string' ? String((promoted || fallback).framing) : undefined,
    running: false,
  }
  try {
    if (!subject) return safe
    const found = await runningForSlot(payload, slot, subject.portalId)
    if (!found) return safe
    const experiment = await enforceRunningPolicy(payload, found)
    if (experiment.status !== 'running') return safe
    const held = await storedAssignment(payload, experiment, subject)
    let variantKey = held?.variantKey || null
    if (!variantKey) {
      let stats: VariantStats[] | undefined
      if (experiment.allocation === 'auto') {
        const counts = await eventCounts(payload, experiment.id)
        stats = experiment.variants.map((variant) => ({
          key: variant.key,
          label: variant.label,
          payload: variant.payload,
          weight: variant.weight,
          approved: variant.approved,
          source: variant.source,
          exposures: counts.filter((row) => row.variantKey === variant.key && row.kind === 'exposure').reduce((sum, row) => sum + row.n, 0),
          conversions: counts.filter((row) => row.variantKey === variant.key && row.kind === 'conversion' && row.event === experiment.primaryMetric).reduce((sum, row) => sum + row.n, 0),
          rate: 0,
          chance: 0,
          letter: '',
        }))
      }
      variantKey = assignByHash(experiment.key, subject.id, liveVariants(experiment, stats))
      if (variantKey) {
        try {
          await saveAssignment(payload, experiment, subject, variantKey)
          await writeEvent(payload, { experiment, variantKey, kind: 'exposure', event: 'exposure', subject })
        } catch {
          variantKey = (await storedAssignment(payload, experiment, subject))?.variantKey || variantKey
        }
      }
    }
    const variant = experiment.variants.find((row) => row.key === variantKey)
    if (!variant) return safe
    return {
      slot,
      experimentKey: experiment.key,
      variantKey: variant.key,
      payload: variant.payload,
      label: variantCopy(variant.payload, variant.label),
      framing: typeof variant.payload.framing === 'string' ? String(variant.payload.framing) : undefined,
      running: true,
    }
  } catch {
    return safe
  }
}

export async function resolveSlots(payload: Payload, slots: string[], subject: Subject | null): Promise<Record<string, VariantView>> {
  const out: Record<string, VariantView> = {}
  for (const slot of slots) out[slot] = await assignVariant(payload, slot, subject)
  return out
}

async function writeEvent(payload: Payload, input: {
  experiment: ExperimentDoc
  variantKey: string
  kind: 'exposure' | 'conversion'
  event: string
  subject: Subject
  sessionId?: string
  props?: Record<string, unknown>
}) {
  const small: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input.props || {})) {
    if (['email', 'name', 'body', 'answer', 'transcript', 'quran', 'hadith'].includes(key)) continue
    if (typeof value === 'string') small[key] = value.slice(0, 80)
    else if (typeof value === 'number' || typeof value === 'boolean') small[key] = value
  }
  await payload.create({
    collection: col('experiment-events'),
    overrideAccess: true,
    data: {
      experiment: input.experiment.id,
      experimentKey: input.experiment.key,
      variantKey: input.variantKey,
      kind: input.kind,
      event: input.event,
      learner: input.subject.learnerId,
      deviceId: input.subject.deviceId,
      subject: input.subject.id,
      sessionId: input.sessionId || undefined,
      portal: input.subject.portalId || idOf(input.experiment.portal) || undefined,
      props: small,
      at: now().toISOString(),
    } as never,
  })
}

export async function logExposure(payload: Payload, slot: string, subject: Subject | null, sessionId?: string) {
  try {
    if (!subject) return { ok: false as const }
    const assigned = await assignVariant(payload, slot, subject)
    if (!assigned.running || !assigned.experimentKey || !assigned.variantKey) return { ok: false as const }
    const experiment = await loadExperiment(payload, assigned.experimentKey)
    if (!experiment) return { ok: false as const }
    const since: Where = sessionId
      ? { sessionId: { equals: sessionId } }
      : { at: { greater_than_equal: `${now().toISOString().slice(0, 10)}T00:00:00.000Z` } }
    const seen = await payload.find({
      collection: col('experiment-events'),
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ experiment: { equals: experiment.id } }, { subject: { equals: subject.id } }, { kind: { equals: 'exposure' } }, since] },
    })
    if (seen.docs.length) return { ok: true as const, skipped: true }
    await writeEvent(payload, { experiment, variantKey: assigned.variantKey, kind: 'exposure', event: 'exposure', subject, sessionId })
    return { ok: true as const }
  } catch {
    return { ok: false as const }
  }
}

async function maybeReturnNextDay(payload: Payload, subject: Subject) {
  const today = now().toISOString().slice(0, 10)
  const already = await payload.find({
    collection: col('experiment-events'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ subject: { equals: subject.id } }, { event: { equals: 'return_next_day' } }, { at: { greater_than_equal: `${today}T00:00:00.000Z` } }] },
  })
  if (already.docs.length) return
  const earlier = await payload.find({
    collection: col('experiment-events'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    sort: 'at',
    where: { and: [{ subject: { equals: subject.id } }, { at: { less_than: `${today}T00:00:00.000Z` } }] },
  })
  if (!earlier.docs.length) return
  const running = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 40, where: { status: { equals: 'running' } } })
  for (const row of running.docs) {
    const experiment = asDoc(row as never)
    const assigned = await storedAssignment(payload, experiment, subject)
    if (!assigned) continue
    if (experiment.primaryMetric === 'return_next_day' || (experiment.secondaryMetrics || []).includes('return_next_day')) {
      await writeEvent(payload, { experiment, variantKey: assigned.variantKey, kind: 'conversion', event: 'return_next_day', subject, props: { computed: true } })
    }
  }
}

export async function recordLearnerEvent(payload: Payload, input: {
  user?: SessionUser | null
  deviceId?: string | null
  event: string
  props?: Record<string, unknown>
  sessionId?: string
  portalId?: number | null
}) {
  try {
    if (!isTrackedEvent(input.event) && input.event !== 'exposure') return
    if (isDemoStageEmail(input.user?.email)) return
    const portalForEvent = input.portalId ?? (input.user ? portalIdOf(input.user) : null)
    if (portalForEvent && (await portalIsDemo(payload, portalForEvent))) return
    const subject = subjectFrom(input.user, input.deviceId, input.portalId ?? (input.user ? portalIdOf(input.user) : null))
    if (!subject) return
    if (await experimentsKilled(payload)) return
    const running = await payload.find({ collection: col('experiments'), overrideAccess: true, depth: 0, limit: 40, where: { status: { equals: 'running' } } })
    for (const row of running.docs) {
      const experiment = asDoc(row as never)
      const scoped = idOf(experiment.portal)
      if (scoped && subject.portalId && scoped !== subject.portalId) continue
      const assigned = await storedAssignment(payload, experiment, subject)
      if (!assigned) continue
      const watches = experiment.primaryMetric === input.event || (experiment.secondaryMetrics || []).includes(input.event)
      if (!watches && input.event !== 'clip_watch_seconds') continue
      if (input.event === 'lanes_course_start' && !withinFirstWeek(assigned.createdAt, now())) continue
      await writeEvent(payload, { experiment, variantKey: assigned.variantKey, kind: 'conversion', event: input.event, subject, sessionId: input.sessionId, props: input.props })
      await enforceRunningPolicy(payload, experiment)
    }
    if (input.event !== 'return_next_day') await maybeReturnNextDay(payload, subject)
  } catch {
    // A tracking miss must never break a tap or a save.
  }
}

export async function suggestFor(payload: Payload, actor: Actor, id: number, current?: string) {
  assertEdit(actor)
  const experiment = await loadExperiment(payload, id)
  if (!experiment) throw new Error('That experiment was not found.')
  const slot = slotOf(experiment.slot)
  if (!slot || slot.kind !== 'copy') throw new Error('Suggestions are for wording slots. Layout slots are written by hand.')
  const sample = current || variantCopy(experiment.variants[0]?.payload, experiment.variants[0]?.label || String(slot.fallback.label || ''))
  // The master desk starts experiments and never spends. Lines are the built-in set, or typed by hand.
  const suggested = await suggestWording(experiment.slot, sample, 4)
  return { ...suggested, experiment }
}

export async function fillTestNumbers(payload: Payload, actor: Actor, id: number) {
  assertEdit(actor)
  if (isProduction() || isRemoteDatabase()) throw new Error('Test numbers stay on a local or development database.')
  const experiment = await loadExperiment(payload, id)
  if (!experiment) throw new Error('That experiment was not found.')
  const existing = await payload.find({
    collection: col('experiment-events'),
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ experiment: { equals: experiment.id } }, { subject: { like: 'test-data:' } }] },
  })
  if (existing.docs.length) throw new Error('Labelled test numbers are already on this experiment.')
  const counts = [
    { exposures: 72, conversions: 14 },
    { exposures: 70, conversions: 29 },
    { exposures: 68, conversions: 12 },
  ]
  let n = 0
  const stamp = now().toISOString()
  for (const [index, variant] of experiment.variants.entries()) {
    const row = counts[index] || { exposures: 64, conversions: 16 }
    const jobs: Promise<unknown>[] = []
    const push = (kind: 'exposure' | 'conversion', event: string, i: number) => {
      n += 1
      jobs.push(payload.create({
        collection: col('experiment-events'),
        overrideAccess: true,
        data: {
          experiment: experiment.id,
          experimentKey: experiment.key,
          variantKey: variant.key,
          kind,
          event,
          subject: `test-data:${experiment.key}:${variant.key}:${kind[0]}${i}`,
          deviceId: `test-${variant.key}-${kind[0]}${i}`,
          props: { test: true, label: 'FAKE TEST DATA — local/dev only' },
          at: stamp,
        } as never,
      }))
    }
    for (let i = 0; i < row.exposures; i++) push('exposure', 'exposure', i)
    for (let i = 0; i < row.conversions; i++) push('conversion', experiment.primaryMetric, i)
    for (let i = 0; i < jobs.length; i += 25) await Promise.all(jobs.slice(i, i + 25))
  }
  await writeAudit(payload, actor, 'experiment.test_data', { id, key: experiment.key, rows: n })
  return n
}

export async function experimentAudit(payload: Payload, experimentKey: string, portalId?: number | null) {
  const found = await payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    sort: '-at',
    where: {
      and: [
        { event: { like: 'experiment.' } },
        ...(portalId ? [{ portal: { equals: portalId } }] : []),
      ],
    },
  })
  return (found.docs as { id: number; event?: string; actor?: unknown; actorRole?: string; at?: string; detail?: { key?: string; name?: string; variantKey?: string } }[])
    .filter((row) => {
      const key = row.detail && typeof row.detail === 'object' ? row.detail.key : undefined
      return !experimentKey || key === experimentKey
    })
}

export function csvFor(results: ExperimentResults) {
  const header = ['version', 'key', 'label', 'approved', 'weight', 'exposures', 'conversions', 'rate', 'chance_of_best']
  const lines = [header.join(',')]
  for (const row of results.variants) {
    lines.push([
      csv(row.letter),
      csv(row.key),
      csv(row.label),
      row.approved ? 'yes' : 'no',
      String(row.weight),
      String(row.exposures),
      String(row.conversions),
      row.rate.toFixed(4),
      row.chance.toFixed(4),
    ].join(','))
  }
  lines.push('')
  lines.push(`verdict,${csv(results.verdict.text)}`)
  lines.push(`primary_metric,${csv(metricLabel(results.experiment.primaryMetric))}`)
  lines.push(`status,${results.experiment.status}`)
  return `${lines.join('\n')}\n`
}

function csv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function parseVariants(raw: string, slot: string): ExperimentVariant[] {
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  return lines.map((line, index) => {
    const [keyPart, ...rest] = line.split('|')
    const label = (rest.join('|') || keyPart).trim()
    const key = (rest.length ? keyPart : `v${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `v${index + 1}`
    const slotSpec = slotOf(slot)
    const payload = slotSpec?.kind === 'layout' ? { framing: label === 'split' ? 'split' : 'face-crop' } : { label }
    return { key, label, payload, weight: 1, approved: true, source: 'staff' as const }
  })
}

export { formatSlotLabel, EXPERIMENT_SLOTS, EXPERIMENT_RULE, metricLabel, STARTERS }
