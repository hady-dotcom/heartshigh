import type { Payload, Where } from 'payload'
import { authorTextProblems } from '@/lib/opening-data'
import {
  ENV_VARS,
  STEP_SPECS,
  TIER_FIELDS,
  canEditSteps,
  canViewSteps,
  clipText,
  defaultModel,
  extractJson,
  fillPrompt,
  keyPresence,
  liveVersion,
  markLive,
  mockBanner,
  mockOutput,
  nextVersion,
  placeholderProblems,
  pointProtect,
  runMode,
  runQueue,
  schemaProblems,
  stepBySlug,
  tierProtect,
  type KeyPresence,
  type Placeholder,
  type ProviderName,
  type StepSpec,
  type TalkContext,
  type VersionState,
} from '@/lib/ai-steps'
import { saidInTalk } from '@/lib/tiers'
import { buildLineTidy, type TidyLine } from '@/lib/tidy-caption'
import type { SessionUser } from './context'
import { tierSourceText } from './tier-source'
import { audit } from './viewas'

type Doc = Record<string, unknown> & { id: number }
type Person = { id: number; role?: string | null; name?: string | null; email?: string | null }

/** The generated collection union does not know these slugs until types are regenerated. */
const col = (name: string) => name as 'users'
const asDoc = (value: unknown) => value as unknown as Doc

async function one(payload: Payload, collection: string, where: Where, sort = '-createdAt') {
  const found = await payload.find({ collection: collection as 'users', overrideAccess: true, depth: 0, limit: 1, sort, where })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

async function many(payload: Payload, collection: string, where?: Where, limit = 200, sort?: string) {
  const found = await payload.find({ collection: collection as 'users', overrideAccess: true, depth: 0, limit, sort, where, pagination: false })
  return found.docs as unknown as Doc[]
}

export async function ensureSteps(payload: Payload) {
  let settings = await one(payload, 'ai-desk', { key: { equals: 'settings' } })
  if (!settings) {
    settings = asDoc(await payload.create({ collection: col('ai-desk'), overrideAccess: true, data: { key: 'settings', portalMayEdit: false } as never }))
  }
  for (const spec of STEP_SPECS) {
    const existing = await one(payload, 'ai-steps', { slug: { equals: spec.slug } })
    if (existing) continue
    const step = asDoc(
      await payload.create({
        collection: col('ai-steps'),
        overrideAccess: true,
        data: {
          slug: spec.slug,
          name: spec.name,
          description: spec.description,
          placeholders: spec.placeholders,
          prompt: spec.prompt,
          provider: spec.provider,
          model: spec.model,
          temperature: spec.temperature,
          maxTokens: spec.maxTokens,
          outputSchema: spec.outputSchema,
          fills: spec.fills,
          pipelineOrder: spec.pipelineOrder,
          inPipeline: spec.inPipeline,
          fillsTier: spec.fillsTier || '',
          fillsPoints: spec.fillsPoints || '',
          liveVersion: 1,
        } as never,
      }),
    )
    await payload.create({
      collection: col('ai-step-versions'),
      overrideAccess: true,
      data: {
        step: step.id,
        number: 1,
        prompt: spec.prompt,
        provider: spec.provider,
        model: spec.model,
        temperature: spec.temperature,
        maxTokens: spec.maxTokens,
        note: 'First version, from the HEARTS prompt set.',
        authorName: 'HEARTS',
        authorRole: 'master',
        live: true,
      } as never,
    })
  }
  return settings
}

export async function loadDesk(payload: Payload, actor: Person | null) {
  const settings = await ensureSteps(payload)
  const keys = keyPresence()
  const may = Boolean(settings.portalMayEdit)
  return {
    canEdit: canEditSteps(actor, may),
    canView: canViewSteps(actor),
    portalMayEdit: may,
    keys,
    mode: !keys.anthropic && !keys.openai ? ('mock' as const) : ('live' as const),
    banner: mockBanner(keys),
    env: ENV_VARS,
  }
}

export async function portalMayEdit(payload: Payload) {
  const settings = await ensureSteps(payload)
  return Boolean(settings.portalMayEdit)
}

function assertView(actor: Person) {
  if (!canViewSteps(actor)) {
    const error = new Error('The AI steps are for the master desk and portal admins.')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }
}

async function assertEdit(payload: Payload, actor: Person) {
  assertView(actor)
  const allowed = canEditSteps(actor, await portalMayEdit(payload))
  if (!allowed) {
    await audit(payload, 'ai.step.denied', { actor: actor.id, actorRole: actor.role, reason: 'Portal admins can read the steps. The master has not granted editing.', detail: { role: actor.role } })
    const error = new Error('You can read the steps. The master has not granted editing.')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }
}

function versionsOf(rows: Doc[]): VersionState[] {
  return rows.map((row) => ({
    number: Number(row.number),
    prompt: String(row.prompt || ''),
    provider: (row.provider === 'openai' ? 'openai' : 'anthropic') as ProviderName,
    model: String(row.model || ''),
    temperature: Number(row.temperature ?? 0),
    maxTokens: Number(row.maxTokens ?? 1200),
    note: String(row.note || ''),
    authorName: String(row.authorName || ''),
    live: Boolean(row.live),
  }))
}

async function versionRows(payload: Payload, stepId: number) {
  const found = await payload.find({
    collection: col('ai-step-versions'),
    overrideAccess: true,
    depth: 0,
    limit: 100,
    sort: 'number',
    where: { step: { equals: stepId } },
  })
  return found.docs as unknown as Doc[]
}

export async function saveVersion(
  payload: Payload,
  actor: Person,
  input: { slug: string; prompt: string; provider: string; model: string; temperature: number; maxTokens: number; note: string },
) {
  await assertEdit(payload, actor)
  const step = await one(payload, 'ai-steps', { slug: { equals: input.slug } })
  if (!step) throw new Error('That step is not in the registry.')
  const spec = specOf(step)
  const provider: ProviderName = input.provider === 'openai' ? 'openai' : 'anthropic'
  const temperature = Math.min(1, Math.max(0, Number.isFinite(input.temperature) ? input.temperature : 0))
  const maxTokens = Math.min(8000, Math.max(64, Math.round(input.maxTokens || spec.maxTokens)))
  const problems = placeholderProblems(input.prompt, (step.placeholders as Placeholder[]) || spec.placeholders)
  if (problems.length) throw new Error(problems[0])
  const rows = await versionRows(payload, step.id)
  const draft = nextVersion(versionsOf(rows), {
    prompt: input.prompt,
    provider,
    model: input.model.trim() || defaultModel(provider),
    temperature,
    maxTokens,
    note: input.note.trim() || 'No note added.',
    authorName: actor.name || actor.email || 'Someone',
  })
  const created = draft[draft.length - 1]
  const version = asDoc(
    await payload.create({
      collection: col('ai-step-versions'),
      overrideAccess: true,
      data: {
        step: step.id,
        number: created.number,
        prompt: created.prompt,
        provider: created.provider,
        model: created.model,
        temperature: created.temperature,
        maxTokens: created.maxTokens,
        note: created.note,
        author: actor.id,
        authorName: created.authorName,
        authorRole: actor.role || '',
        live: false,
      } as never,
    }),
  )
  await audit(payload, 'ai.step.version', {
    actor: actor.id,
    actorRole: actor.role,
    reason: created.note,
    detail: { slug: input.slug, version: created.number, versionId: version.id },
  })
  return { step, version: created }
}

export async function publishVersion(payload: Payload, actor: Person, slug: string, number: number, rollback: boolean) {
  await assertEdit(payload, actor)
  const step = await one(payload, 'ai-steps', { slug: { equals: slug } })
  if (!step) throw new Error('That step is not in the registry.')
  const rows = await versionRows(payload, step.id)
  let marked: VersionState[]
  try {
    marked = markLive(versionsOf(rows), number)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'That version is not in the history.')
  }
  const live = liveVersion(marked)
  if (!live) throw new Error('That version is not in the history.')
  for (const row of rows) {
    const should = Number(row.number) === number
    if (Boolean(row.live) !== should) {
      await payload.update({ collection: col('ai-step-versions'), id: row.id, overrideAccess: true, data: { live: should } as never })
    }
  }
  await payload.update({
    collection: col('ai-steps'),
    id: step.id,
    overrideAccess: true,
    data: { prompt: live.prompt, provider: live.provider, model: live.model, temperature: live.temperature, maxTokens: live.maxTokens, liveVersion: live.number } as never,
  })
  await audit(payload, rollback ? 'ai.step.rollback' : 'ai.step.live', {
    actor: actor.id,
    actorRole: actor.role,
    reason: rollback ? `Rolled back to version ${number}.` : `Marked version ${number} live.`,
    detail: { slug, version: number },
  })
  return live
}

export async function setGrant(payload: Payload, actor: Person, allowed: boolean) {
  if (actor.role !== 'master') {
    await audit(payload, 'ai.step.denied', { actor: actor.id, actorRole: actor.role, reason: 'Only the master grants editing.', detail: { attempted: allowed } })
    throw Object.assign(new Error('Only the master can grant editing.'), { status: 403 })
  }
  const settings = await ensureSteps(payload)
  await payload.update({ collection: col('ai-desk'), id: settings.id, overrideAccess: true, data: { portalMayEdit: allowed } as never })
  await audit(payload, 'ai.grant', { actor: actor.id, actorRole: actor.role, reason: allowed ? 'Portal admins may edit the AI steps.' : 'Portal admins may only read the AI steps.', detail: { portalMayEdit: allowed } })
  return allowed
}

function specOf(step: Doc): StepSpec {
  const known = stepBySlug(String(step.slug))
  if (known) return { ...known, prompt: String(step.prompt || known.prompt), provider: step.provider === 'openai' ? 'openai' : 'anthropic', model: String(step.model || known.model), temperature: Number(step.temperature ?? known.temperature), maxTokens: Number(step.maxTokens ?? known.maxTokens) }
  return {
    slug: String(step.slug),
    name: String(step.name),
    description: String(step.description || ''),
    placeholders: (step.placeholders as Placeholder[]) || [],
    prompt: String(step.prompt || ''),
    provider: step.provider === 'openai' ? 'openai' : 'anthropic',
    model: String(step.model || ''),
    temperature: Number(step.temperature ?? 0),
    maxTokens: Number(step.maxTokens ?? 1200),
    outputSchema: (step.outputSchema as Record<string, unknown>) || {},
    fills: String(step.fills || ''),
    pipelineOrder: Number(step.pipelineOrder || 0),
    inPipeline: Boolean(step.inPipeline),
    fillsTier: step.fillsTier === 'hors' || step.fillsTier === 'appetiser' ? step.fillsTier : null,
    fillsPoints: step.fillsPoints === 'popup' || step.fillsPoints === 'reflection' ? step.fillsPoints : null,
  }
}

async function talkContext(payload: Payload, lesson: Doc, promptOverride?: { rubric?: string }): Promise<TalkContext> {
  const transcript = tierSourceText(lesson as { youtubeId?: string | null; transcript?: string | null })
  const tier = await one(payload, 'talk-tiers', { lesson: { equals: lesson.id } })
  const rubricStep = await one(payload, 'ai-steps', { slug: { equals: 'rubric' } })
  const clauses = await many(payload, 'clauses', undefined, 50)
  const seats = await many(payload, 'seats', undefined, 200)
  const hook = String(tier?.hook || '')
  const turn = String(tier?.turn || '')
  const land = String(tier?.land || '')
  const cards = clauses
    .sort((a, b) => Number(a.number) - Number(b.number))
    .map((clause) => {
      const own = seats.filter((seat) => Number(seat.clause) === clause.id).sort((a, b) => Number(a.position) - Number(b.position))
      const printed = own.map((seat) => `(${seat.position}) ${seat.text}`).join(' ')
      return `${clause.number}. ${clause.fragment}\nTEACHING. ${clause.teaching || ''}\nSEATS. ${printed || 'none printed'}`
    })
    .join('\n\n')
  return {
    title: String(lesson.sourceTitle || lesson.title || 'A talk'),
    speaker: String(lesson.speaker || ''),
    duration: Number(lesson.durationSeconds || 0),
    transcript,
    hook,
    turn,
    land,
    landAt: Number(tier?.landAt ?? tier?.appetiserEnd ?? 0),
    appetiser: tier ? { start: Number(tier.appetiserStart), end: Number(tier.appetiserEnd) } : null,
    clauseCards: cards || 'No clause cards are loaded.',
    rubric: promptOverride?.rubric ?? String(rubricStep?.prompt || ''),
    clip: clipText(hook, turn, land),
    captionLines: captionLinesOf(tier, hook, turn, land),
  }
}

function captionLinesOf(tier: Doc | null, hook: string, turn: string, land: string) {
  const hors = Array.isArray(tier?.horsLines) ? (tier.horsLines as { at?: number; text?: string }[]) : []
  const rows = [
    ...hors.filter((line) => line?.text).map((line) => `hors\t${Number(line.at) || 0}\t${line.text}`),
    hook ? `hook\t${Number(tier?.hookAt) || 0}\t${hook}` : '',
    turn ? `turn\t${Number(tier?.turnAt) || 0}\t${turn}` : '',
    land ? `land\t${Number(tier?.landAt) || 0}\t${land}` : '',
    tier?.horsQuote ? `quote\t0\t${tier.horsQuote}` : '',
  ]
  return rows.filter(Boolean).join('\n') || '(no caption lines yet)'
}

function varsFor(talk: TalkContext): Record<string, string> {
  return {
    TRANSCRIPT: talk.transcript.slice(0, 24_000),
    TITLE: talk.title,
    DURATION: String(talk.duration || 'unknown'),
    SPEAKER: talk.speaker,
    HOOK: talk.hook || '(no hook drafted yet)',
    TURN: talk.turn || '(no turn drafted yet)',
    LAND: talk.land || '(no land drafted yet)',
    LAND_AT: String(talk.landAt || 0),
    APPETISER: talk.appetiser ? `${talk.appetiser.start} to ${talk.appetiser.end} seconds` : 'not cut yet, so keep to the talk',
    CLAUSE_CARDS: talk.clauseCards.slice(0, 24_000),
    RUBRIC: talk.rubric,
    CLIP: talk.clip,
    LINES: talk.captionLines || '(no caption lines yet)',
  }
}

async function completeLive(spec: StepSpec, system: string, user: string, keys: KeyPresence) {
  const model = spec.model || defaultModel(spec.provider)
  if (spec.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: spec.maxTokens, temperature: spec.temperature, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) throw new Error(`Anthropic returned ${response.status}.`)
    const body = (await response.json()) as { content?: { text?: string }[] }
    return body.content?.map((part) => part.text || '').join('\n') || ''
  }
  if (!keys.openai) throw new Error('OpenAI has no key configured.')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}` },
    body: JSON.stringify({ model, temperature: spec.temperature, max_tokens: spec.maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}.`)
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return body.choices?.[0]?.message?.content || ''
}

async function runSpec(spec: StepSpec, prompt: string, talk: TalkContext) {
  const keys = keyPresence()
  const mode = runMode(spec.provider, keys)
  if (spec.slug === 'rubric' || mode === 'mock') {
    const output = mockOutput(spec, talk, prompt)
    const problems = schemaProblems(spec.outputSchema as never, output)
    return { output, mock: mode === 'mock' || spec.slug === 'rubric', problems }
  }
  const system = fillPrompt(prompt, varsFor(talk))
  const reply = await completeLive(spec, system, talk.transcript.slice(0, 24_000) || '(empty transcript)', keys)
  const output = extractJson(reply)
  const problems = schemaProblems(spec.outputSchema as never, output)
  return { output, mock: false, problems }
}

export async function tryStep(payload: Payload, actor: Person, slug: string, lessonId: number, prompt: string) {
  await assertEdit(payload, actor)
  const step = await one(payload, 'ai-steps', { slug: { equals: slug } })
  if (!step) throw new Error('That step is not in the registry.')
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!lesson) throw new Error('That talk was not found.')
  const spec = specOf(step)
  const using = prompt.trim() || String(step.prompt || '')
  const problems = placeholderProblems(using, (step.placeholders as Placeholder[]) || spec.placeholders)
  if (problems.length) throw new Error(problems[0])
  const talk = await talkContext(payload, lesson as unknown as Doc, spec.slug === 'rubric' ? { rubric: using } : undefined)
  const liveSpec = { ...spec, prompt: String(step.prompt || spec.prompt) }
  const [draft, live] = await Promise.all([
    runSpec({ ...spec, prompt: using }, using, talk).catch((error: Error) => ({ output: null, mock: runMode(spec.provider) === 'mock', problems: [error.message] })),
    runSpec(liveSpec, liveSpec.prompt, talk).catch((error: Error) => ({ output: null, mock: runMode(spec.provider) === 'mock', problems: [error.message] })),
  ])
  const versionNumber = Number(step.liveVersion || 1)
  await payload.create({
    collection: col('ai-step-outputs'),
    overrideAccess: true,
    data: {
      step: step.id,
      stepSlug: spec.slug,
      versionNumber,
      lesson: lessonId,
      mode: 'try',
      disposition: draft.problems.length ? 'failed' : 'preview',
      output: { draft: draft.output, live: live.output, draftProblems: draft.problems, liveProblems: live.problems },
      error: draft.problems[0] || '',
      mock: draft.mock,
    } as never,
  })
  await audit(payload, 'ai.step.try', {
    actor: actor.id,
    actorRole: actor.role,
    reason: 'Tried a prompt on one talk. Nothing was saved for learners.',
    detail: { slug, lessonId, mock: draft.mock, version: versionNumber },
  })
  return { draft, live, mock: draft.mock, lessonTitle: talk.title }
}

type ApplyResult = { disposition: 'applied' | 'pending' | 'failed'; error?: string; protectsKind?: string; protectsId?: number; protectsReason?: string; written?: Record<string, unknown> }

export async function applyToTalk(payload: Payload, spec: StepSpec, lesson: Doc, output: unknown, versionNumber: number): Promise<ApplyResult> {
  const transcript = tierSourceText(lesson as { youtubeId?: string | null; transcript?: string | null })
  if (spec.slug === 'tidy-caption-line') return applyTidy(payload, lesson, output as Record<string, unknown>)
  if (spec.fillsTier) return applyTier(payload, spec, lesson, output as Record<string, unknown>, versionNumber, transcript)
  if (spec.fillsPoints) return applyPoints(payload, spec, lesson, output as Record<string, unknown>, versionNumber)
  return { disposition: 'applied', written: {} }
}

async function applyTidy(payload: Payload, lesson: Doc, output: Record<string, unknown>): Promise<ApplyResult> {
  const existing = await one(payload, 'talk-tiers', { lesson: { equals: lesson.id } })
  if (!existing) return { disposition: 'failed', error: "No hors d'oeuvre or appetiser lines to tidy yet." }
  const horsLines = (Array.isArray(existing.horsLines) ? existing.horsLines : []) as { at?: number; text?: string }[]
  const sources = {
    speaker: String(lesson.speaker || ''),
    quote: String(existing.horsQuote || ''),
    hook: String(existing.hook || ''),
    turn: String(existing.turn || ''),
    land: String(existing.land || ''),
    horsLines: horsLines.filter((line) => typeof line?.text === 'string').map((line) => ({ at: Number(line.at) || 0, text: String(line.text) })),
  }
  if (!sources.quote && !sources.hook && !sources.turn && !sources.land && !sources.horsLines.length) {
    return { disposition: 'failed', error: "No hors d'oeuvre or appetiser lines to tidy yet." }
  }
  const chosen = (Array.isArray(output.lines) ? output.lines : []) as TidyLine[]
  const pure = buildLineTidy(sources)
  const mixed = buildLineTidy(sources, chosen, 'fallback')
  const usedModel = JSON.stringify({ ...mixed, source: '' }) !== JSON.stringify({ ...pure, source: '' })
  const lineTidy = { ...mixed, source: usedModel ? 'ai' : 'fallback' }
  await payload.update({ collection: 'talk-tiers', id: existing.id, overrideAccess: true, data: { lineTidy } as never })
  return { disposition: 'applied', written: { lineTidy } }
}

async function applyTier(payload: Payload, spec: StepSpec, lesson: Doc, output: Record<string, unknown>, versionNumber: number, transcript: string): Promise<ApplyResult> {
  const kind = spec.fillsTier === 'appetiser' ? 'appetiser' : 'hors'
  const fields = [...TIER_FIELDS[kind]]
  const written = kind === 'hors'
    ? { horsStart: Number(output.start), horsEnd: Number(output.end), horsQuote: String(output.quote || ''), horsLines: output.lines || [] }
    : {
        appetiserStart: Number(output.start),
        appetiserEnd: Number(output.end),
        hook: String(output.hook || ''),
        turn: String(output.turn || ''),
        land: String(output.land || ''),
        hookAt: Number(output.hookAt),
        turnAt: Number(output.turnAt),
        landAt: Number(output.landAt),
      }
  if (transcript) {
    const lines = kind === 'hors' ? [String(written.horsQuote || '')] : [String(written.hook || ''), String(written.turn || ''), String(written.land || '')]
    for (const line of lines) {
      if (line && !saidInTalk(line, transcript)) return { disposition: 'failed', error: 'A quote is not in the transcript word for word, so it was not saved.' }
    }
  }
  const existing = await one(payload, 'talk-tiers', { lesson: { equals: lesson.id } })
  const previous = await one(payload, 'ai-step-outputs', { and: [{ stepSlug: { equals: spec.slug } }, { lesson: { equals: lesson.id } }, { mode: { equals: 'run' } }, { disposition: { equals: 'applied' } }] })
  const snapshot = (previous?.written as Record<string, unknown>) || null
  const reason = tierProtect(existing, snapshot, fields)
  if (reason && existing) return { disposition: 'pending', protectsKind: 'talk-tier', protectsId: existing.id, protectsReason: reason, written }
  const source = `ai:${spec.slug}@v${versionNumber}`
  try {
    if (!existing) {
      const drafted = (await import('@/lib/tiers')).draftTiers(transcript, Number(lesson.durationSeconds) || null)
      if (!drafted) return { disposition: 'failed', error: 'There is not enough speech to open a tier record.' }
      await payload.create({
        collection: 'talk-tiers',
        overrideAccess: true,
        data: {
          lesson: lesson.id,
          horsStart: drafted.hors.start,
          horsEnd: drafted.hors.end,
          horsQuote: drafted.hors.quote,
          horsLines: drafted.horsLines,
          appetiserStart: drafted.appetiser.start,
          appetiserEnd: drafted.appetiser.end,
          hook: drafted.hook,
          turn: drafted.turn,
          land: drafted.land,
          hookAt: drafted.hookAt,
          turnAt: drafted.turnAt,
          landAt: drafted.landAt,
          status: 'draft',
          offerResume: true,
          source,
          note: 'Draft from an AI step. Needs a human check.',
          ...written,
        } as never,
      })
    } else {
      await payload.update({ collection: 'talk-tiers', id: existing.id, overrideAccess: true, data: { ...written, source, status: 'draft' } as never })
    }
  } catch (error) {
    return { disposition: 'failed', error: error instanceof Error ? error.message : 'The tier draft was not saved.' }
  }
  return { disposition: 'applied', written }
}

async function applyPoints(payload: Payload, spec: StepSpec, lesson: Doc, output: Record<string, unknown>, versionNumber: number): Promise<ApplyResult> {
  const rows = spec.fillsPoints === 'reflection'
    ? ((output.questions as { prompt?: string; second?: number }[]) || []).map((row) => ({ second: Number(row.second), kind: 'reflection', prompt: String(row.prompt || ''), options: [] as string[] }))
    : ((output.points as { second?: number; kind?: string; prompt?: string; options?: string[] }[]) || []).map((row) => ({
        second: Number(row.second),
        kind: ['question', 'multiple_choice', 'reflection', 'task'].includes(String(row.kind)) ? String(row.kind) : 'question',
        prompt: String(row.prompt || ''),
        options: Array.isArray(row.options) ? row.options.map(String) : [],
      }))
  const kept: typeof rows = []
  const skipped: string[] = []
  for (const row of rows) {
    const problems = authorTextProblems([['The question', row.prompt], ...row.options.map((option, index): [string, string] => [`Option ${index + 1}`, option])])
    if (problems.length) skipped.push(problems[0])
    else if (row.prompt.trim().length >= 10 && Number.isFinite(row.second)) kept.push(row)
  }
  if (!kept.length) return { disposition: 'failed', error: skipped[0] || 'The step returned no pop-up that can be shown to a learner.' }
  const note = `AI draft from ${spec.slug} v${versionNumber}. Needs a human check.`
  const ours = await many(payload, 'engagement-points', { and: [{ lesson: { equals: lesson.id } }, { draftNote: { like: `AI draft from ${spec.slug}` } }] }, 50)
  const blocked = ours.filter((point) => pointProtect(point as never))
  const free = ours.filter((point) => !pointProtect(point as never))
  const writtenIds: number[] = []
  for (let index = 0; index < kept.length; index++) {
    const row = kept[index]
    const data = { lesson: lesson.id, second: row.second, kind: row.kind, prompt: row.prompt, options: row.options, status: 'draft', draftNote: note, timing: 'immediate', triggerType: 'timestamp', audience: 'everyone', delayAmount: 0 }
    const target = free[index]
    if (target) {
      await payload.update({ collection: 'engagement-points', id: target.id, overrideAccess: true, data: data as never })
      writtenIds.push(target.id)
    } else {
      const created = asDoc(await payload.create({ collection: 'engagement-points', overrideAccess: true, data: data as never }))
      writtenIds.push(created.id)
    }
  }
  for (const extra of free.slice(kept.length)) {
    await payload.delete({ collection: 'engagement-points', id: extra.id, overrideAccess: true }).catch(() => undefined)
  }
  if (blocked.length) {
    return { disposition: 'pending', protectsKind: 'engagement-point', protectsId: blocked[0].id, protectsReason: pointProtect(blocked[0] as never) || 'human-edited', written: { ids: writtenIds, skipped } }
  }
  return { disposition: 'applied', written: { ids: writtenIds, skipped } }
}

export async function runOnLesson(payload: Payload, spec: StepSpec, lesson: Doc, versionNumber: number, prompt: string, jobId?: number) {
  const talk = await talkContext(payload, lesson)
  let output: unknown
  let mock = false
  try {
    const ran = await runSpec({ ...spec, prompt }, prompt, talk)
    output = ran.output
    mock = ran.mock
    if (ran.problems.length) {
      return record(payload, spec, lesson, versionNumber, jobId, { disposition: 'failed', error: ran.problems[0] }, output, mock)
    }
  } catch (error) {
    return record(payload, spec, lesson, versionNumber, jobId, { disposition: 'failed', error: error instanceof Error ? error.message : 'The step failed.' }, null, runMode(spec.provider) === 'mock')
  }
  const applied = await applyToTalk(payload, spec, lesson, output, versionNumber)
  return record(payload, spec, lesson, versionNumber, jobId, applied, output, mock)
}

async function record(payload: Payload, spec: StepSpec, lesson: Doc, versionNumber: number, jobId: number | undefined, applied: ApplyResult, output: unknown, mock: boolean) {
  const step = await one(payload, 'ai-steps', { slug: { equals: spec.slug } })
  await payload.create({
    collection: col('ai-step-outputs'),
    overrideAccess: true,
    data: {
      step: step?.id,
      stepSlug: spec.slug,
      versionNumber,
      lesson: lesson.id,
      mode: 'run',
      disposition: applied.disposition,
      output,
      written: applied.written || null,
      error: applied.error || '',
      job: jobId,
      protectsKind: applied.protectsKind || '',
      protectsId: applied.protectsId,
      protectsReason: applied.protectsReason || '',
      mock,
    } as never,
  })
  return { ok: applied.disposition !== 'failed', error: applied.error, disposition: applied.disposition, mock }
}

export async function lessonsInScope(payload: Payload, scope: string, lessonIds: number[], courseId?: number) {
  if (scope === 'course' && courseId) return many(payload, 'lessons', { course: { equals: courseId } }, 500)
  if (scope === 'all') return many(payload, 'lessons', undefined, 500)
  if (!lessonIds.length) return []
  return many(payload, 'lessons', { id: { in: lessonIds } }, 500)
}

export async function startJob(
  payload: Payload,
  actor: Person,
  input: { slug: string; scope: string; lessonIds: number[]; courseId?: number; gapMs?: number },
) {
  await assertEdit(payload, actor)
  const scope = ['talk', 'selection', 'course', 'all'].includes(input.scope) ? input.scope : 'talk'
  if (input.slug !== 'pipeline' && !stepBySlug(input.slug)) throw new Error('That step is not in the registry.')
  const lessons = await lessonsInScope(payload, scope, input.lessonIds, input.courseId)
  if (!lessons.length) throw new Error('Choose at least one talk.')
  const job = asDoc(
    await payload.create({
      collection: col('ai-step-jobs'),
      overrideAccess: true,
      data: {
        stepSlug: input.slug,
        scope,
        lessonIds: lessons.map((lesson) => lesson.id),
        course: input.courseId,
        status: 'queued',
        total: lessons.length,
        finished: 0,
        failedCount: 0,
        results: [],
        actor: actor.id,
        actorName: actor.name || actor.email || '',
        note: input.slug === 'pipeline' ? 'Whole pipeline' : input.slug,
      } as never,
    }),
  )
  await audit(payload, 'ai.job.start', { actor: actor.id, actorRole: actor.role, reason: `Re-run ${input.slug} on ${lessons.length} talk${lessons.length === 1 ? '' : 's'}.`, detail: { jobId: job.id, slug: input.slug, scope, total: lessons.length } })
  const gap = process.env.HEARTS_E2E === '1' ? Math.min(2000, Math.max(0, input.gapMs || 0)) : 0
  return { job, run: () => processJob(payload, job.id, actor, gap) }
}

export async function processJob(payload: Payload, jobId: number, actor: Person, gapMs = 0) {
  const job = asDoc(await payload.findByID({ collection: col('ai-step-jobs'), id: jobId, depth: 0, overrideAccess: true }))
  if (job.status === 'done' || job.status === 'failed') return job
  await payload.update({ collection: col('ai-step-jobs'), id: jobId, overrideAccess: true, data: { status: 'running' } as never })
  const ids = Array.isArray(job.lessonIds) ? (job.lessonIds as unknown[]).map(Number).filter(Boolean) : []
  const lessons = await lessonsInScope(payload, 'selection', ids)
  const steps = (await many(payload, 'ai-steps', undefined, 50, 'pipelineOrder')).map(specOf).filter((step) => (job.stepSlug === 'pipeline' ? step.inPipeline : step.slug === job.stepSlug)).sort((a, b) => a.pipelineOrder - b.pipelineOrder)
  try {
    const progress = await runQueue(lessons, async (lesson) => {
      if (gapMs) await new Promise((resolve) => setTimeout(resolve, gapMs))
      const fresh = asDoc(await payload.findByID({ collection: 'lessons', id: lesson.id, depth: 0, overrideAccess: true }))
      const stepResults: { slug: string; ok: boolean; error?: string; disposition?: string }[] = []
      for (const spec of steps) {
        const current = await one(payload, 'ai-steps', { slug: { equals: spec.slug } })
        const prompt = String(current?.prompt || spec.prompt)
        const versionNumber = Number(current?.liveVersion || 1)
        const result = await runOnLesson(payload, { ...spec, prompt }, fresh, versionNumber, prompt, jobId)
        stepResults.push({ slug: spec.slug, ok: result.ok, error: result.error, disposition: result.disposition })
      }
      const failed = stepResults.filter((step) => !step.ok)
      return {
        ok: failed.length === 0,
        error: failed[0]?.error,
        detail: { title: String(fresh.sourceTitle || fresh.title || 'A talk'), steps: stepResults },
      }
    }, async (state) => {
      await payload.update({
        collection: col('ai-step-jobs'),
        id: jobId,
        overrideAccess: true,
        data: { finished: state.finished, failedCount: state.failed, total: state.total, results: state.results, status: 'running' } as never,
      })
    })
    await payload.update({
      collection: col('ai-step-jobs'),
      id: jobId,
      overrideAccess: true,
      data: { status: 'done', finished: progress.finished, failedCount: progress.failed, total: progress.total, results: progress.results } as never,
    })
    await audit(payload, 'ai.job.finish', { actor: actor.id, actorRole: actor.role, reason: `${progress.finished} talks finished, ${progress.failed} with an error.`, detail: { jobId, failed: progress.failed, total: progress.total } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The job stopped.'
    await payload.update({ collection: col('ai-step-jobs'), id: jobId, overrideAccess: true, data: { status: 'failed', error: message } as never })
    await audit(payload, 'ai.job.finish', { actor: actor.id, actorRole: actor.role, reason: message, detail: { jobId, failed: true } })
  }
  return payload.findByID({ collection: col('ai-step-jobs'), id: jobId, depth: 0, overrideAccess: true })
}

export async function pendingForLesson(payload: Payload, lessonId: number) {
  try {
    const found = await payload.find({
      collection: col('ai-step-outputs'),
      overrideAccess: true,
      depth: 0,
      limit: 20,
      sort: '-createdAt',
      where: { and: [{ lesson: { equals: lessonId } }, { disposition: { equals: 'pending' } }] },
    })
    return found.docs as unknown as Doc[]
  } catch {
    return []
  }
}

export function statusCode(error: unknown) {
  return Number((error as { status?: number })?.status) || 400
}

export function actorOf(user: SessionUser): Person {
  return { id: user.id, role: user.role, name: user.name, email: user.email }
}

export async function latestTry(payload: Payload, slug: string, lessonId: number) {
  return one(payload, 'ai-step-outputs', { and: [{ stepSlug: { equals: slug } }, { lesson: { equals: lessonId } }, { mode: { equals: 'try' } }] })
}
