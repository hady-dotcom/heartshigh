// Seeds the opening: Leon's scales, the Jibril lanes, the six scenes, the starter map (spec 2.9), the opening
// setups, lane tags, the people the view-as tests need, and two weeks of ordinary use for the admin charts.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { idOf } from '../lib/ids'
import { DEFAULT_COPY, FOCUS_NAMES, LIFE_OPTIONS, LIFE_PROMPT, MONTH_WORDING } from '../lib/compass-data'
import { DEFAULT_HELP_CONTACTS, DEFAULT_LANE, LANES, SCALES, SCENES } from '../lib/opening-data'
import { PERSONA_BANDS } from '../lib/persona-data'
import { DRAFT_NOTE, draftTiers, timingProblems, type TimingRow } from '../lib/tiers'
import { buildLineTidy } from '../lib/tidy-caption'
import { formatTimestamp } from '../lib/transcript'
import { STARTERS } from './starters-data'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function starterTranscript(youtubeId: string) {
  const file = path.join(root, 'content/transcripts/starters', `${youtubeId}.vtt`)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

type Doc = Record<string, unknown> & { id: number }

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 1, where: where as never })
  return (found.docs[0] as unknown as Doc | undefined) || null
}

async function upsert(payload: Payload, collection: string, where: Record<string, unknown>, data: Record<string, unknown>) {
  const found = await one(payload, collection, where)
  if (found) return (await payload.update({ collection: collection as never, id: found.id, overrideAccess: true, data: data as never })) as unknown as Doc
  return (await payload.create({ collection: collection as never, overrideAccess: true, data: data as never })) as unknown as Doc
}

const slugOf = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export async function seedOpening(payload: Payload, opts: { clauseIds: Map<number, number>; portalIds: Map<string, number>; now: Date; showUnchecked?: boolean }) {
  const { clauseIds, portalIds } = opts
  const scaleIds = new Map<string, number>()
  for (const scale of SCALES) {
    const doc = await upsert(payload, 'heart-scales', { key: { equals: scale.key } }, {
      key: scale.key,
      leonName: scale.leonName,
      room: scale.room,
      polishLabel: scale.polishLabel,
      focusName: FOCUS_NAMES[scale.key],
      firstOpenRead: scale.firstOpenRead,
      anchors: scale.anchors,
    })
    scaleIds.set(scale.key, doc.id)
  }

  for (const band of PERSONA_BANDS) {
    await upsert(payload, 'persona-bands', { key: { equals: band.key } }, {
      key: band.key,
      title: band.title,
      status: band.status,
      source: band.source,
      placeholder: band.placeholder,
      identicalGroup: band.identicalGroup,
      note: band.note,
      version: band.version || 2,
      description: band.description || band.note,
      doors: band.doors || [],
      talks: band.talks || [],
      ranges: band.ranges.map((row) => ({ scale: row.scale, present: row.present, ...(row.min == null ? {} : { min: row.min }), ...(row.max == null ? {} : { max: row.max }) })),
    })
  }

  await upsert(payload, 'compass-settings', { key: { equals: 'default' } }, {
    key: 'default',
    frame: DEFAULT_COPY.frame,
    focusLead: DEFAULT_COPY.focusLead,
    movementUp: DEFAULT_COPY.movementUp,
    movementSame: DEFAULT_COPY.movementSame,
    movementOnward: DEFAULT_COPY.movementOnward,
    lifeCaption: LIFE_PROMPT.caption,
    lifeSubline: LIFE_PROMPT.subline,
    places: DEFAULT_COPY.places,
    lifeOptions: LIFE_OPTIONS,
  })

  const laneIds = new Map<string, number>()
  for (const lane of LANES) {
    const doc = await upsert(payload, 'lanes', { key: { equals: lane.key } }, {
      key: lane.key,
      title: lane.title,
      scale: lane.scale ? scaleIds.get(lane.scale) : undefined,
      fit: lane.fit,
      clauses: lane.clauses.map((row) => ({ clause: clauseIds.get(row.clause), rank: row.rank })),
      excludeClauses: lane.excludeClauses.map((number) => clauseIds.get(number)).filter(Boolean),
      seriesNote: lane.seriesNote,
      optInOnly: lane.optInOnly,
      order: lane.order,
      reachPhrase: lane.title,
    })
    laneIds.set(lane.key, doc.id)
  }
  const pseudo = await upsert(payload, 'lanes', { key: { equals: DEFAULT_LANE } }, { key: DEFAULT_LANE, title: 'Default clip', pseudo: true, order: 99, fit: 'workable' })
  laneIds.set(DEFAULT_LANE, pseudo.id)

  // Scenes start as drafts, then the one carrying the crisis option is published first so the publish rules hold.
  const sceneIds = new Map<string, number>()
  for (const scene of SCENES.filter((row) => row.key !== 'account')) {
    const existing = await one(payload, 'opening-scenes', { key: { equals: scene.key } })
    const data = {
      key: scene.key,
      order: scene.order,
      caption: scene.caption,
      subline: scene.subline,
      layout: scene.layout,
      adaptedFrom: scene.adaptedFrom,
      monthCaption: MONTH_WORDING[scene.key]?.caption,
      monthSubline: MONTH_WORDING[scene.key]?.subline,
      monthLabels: MONTH_WORDING[scene.key]?.labels,
      options: scene.options.map((option) => ({
        key: option.key,
        label: option.label,
        replyPill: option.replyPill,
        nudges: option.nudges.map((item) => ({ scale: item.scale, delta: item.delta })),
        intentLane: option.intentLane ? laneIds.get(option.intentLane) : undefined,
        spineFirst: Boolean(option.spineFirst),
        crisis: Boolean(option.crisis),
        sensitivity: option.sensitivity || 'normal',
      })),
    }
    const doc = existing
      ? existing
      : ((await payload.create({ collection: 'opening-scenes', overrideAccess: true, data: { ...data, status: 'draft' } as never })) as unknown as Doc)
    sceneIds.set(scene.key, doc.id)
  }
  const publishOrder = SCENES.filter((row) => row.key !== 'account').sort((a, b) => Number(b.options.some((o) => o.crisis)) - Number(a.options.some((o) => o.crisis)))
  for (const scene of publishOrder) {
    const doc = await payload.findByID({ collection: 'opening-scenes', id: sceneIds.get(scene.key)!, overrideAccess: true, depth: 0 })
    if ((doc as { status?: string }).status !== 'published') {
      await payload.update({ collection: 'opening-scenes', id: doc.id, overrideAccess: true, data: { status: 'published' } as never })
    }
  }

  // Starter map.
  const starterCourseIds: number[] = []
  const laneStarters = new Map<string, { lesson: number; role: string; order: number }[]>()
  let d0CutId: number | null = null
  for (const [index, row] of STARTERS.entries()) {
    let lesson: Doc | null = null
    if (row.existingTitle) {
      lesson = await one(payload, 'lessons', { title: { equals: row.existingTitle } })
      if (lesson) {
        lesson = (await payload.update({
          collection: 'lessons',
          id: lesson.id,
          overrideAccess: true,
          data: { youtubeId: (lesson.youtubeId as string) || row.youtubeId, youtubeUrl: (lesson.youtubeUrl as string) || `https://www.youtube.com/watch?v=${row.youtubeId}`, sourceTitle: row.title, starterLane: row.lane, ...(row.lengthSec ? { durationSeconds: row.lengthSec } : {}) } as never,
        })) as unknown as Doc
      }
    }
    if (!lesson) lesson = await one(payload, 'lessons', { youtubeId: { equals: row.youtubeId } })
    const captions = starterTranscript(row.youtubeId)
    const captionFields = captions
      ? { transcript: captions, transcriptSource: 'youtube', transcriptNote: `English captions from YouTube, repeats removed (content/transcripts/starters/${row.youtubeId}.vtt).` }
      : { transcriptSource: 'pending', transcriptNote: 'No captions are shipped for this talk yet. The talk plays; the transcript is pending.' }
    if (lesson && !row.existingTitle) {
      lesson = (await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { ...captionFields, durationSeconds: row.lengthSec ?? undefined } as never })) as unknown as Doc
    }
    if (!lesson) {
      const courseTitle = row.series || row.title
      const token = `STARTER-${slugOf(courseTitle)}`
      let course = await one(payload, 'courses', { importToken: { equals: token } })
      if (!course) {
        course = (await payload.create({
          collection: 'courses',
          overrideAccess: true,
          data: { title: courseTitle, speaker: row.speaker, summary: row.series ? `${row.series}, with ${row.speaker}.` : `A talk by ${row.speaker}.`, origin: 'master', importable: true, isPublic: true, importToken: token, visibility: 'published' } as never,
        })) as unknown as Doc
      }
      let unit = await one(payload, 'units', { course: { equals: course.id } })
      if (!unit) unit = (await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Talks', course: course.id, order: 1 } as never })) as unknown as Doc
      lesson = (await payload.create({
        collection: 'lessons',
        overrideAccess: true,
        data: {
          title: row.title,
          sourceTitle: row.title,
          unit: unit.id,
          course: course.id,
          master: true,
          order: index + 1,
          speaker: row.speaker,
          youtubeUrl: `https://www.youtube.com/watch?v=${row.youtubeId}`,
          youtubeId: row.youtubeId,
          durationSeconds: row.lengthSec ?? undefined,
          ...captionFields,
          starterLane: row.lane,
        } as never,
      })) as unknown as Doc
    }
    const courseId = idOf(lesson.course)
    if (courseId && !row.existingTitle && !starterCourseIds.includes(courseId)) starterCourseIds.push(courseId)

    let cut: Doc | null = null
    if (row.existingTitle) {
      const cuts = await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 50, sort: 'start', where: { and: [{ lesson: { equals: lesson.id } }, { status: { equals: 'approved' } }] } })
      cut = (cuts.docs[0] as unknown as Doc) || null
    } else {
      cut = await one(payload, 'cuts', { and: [{ lesson: { equals: lesson.id } }, { placeholder: { equals: true } }] })
      if (!cut) {
        cut = (await payload.create({
          collection: 'cuts',
          overrideAccess: true,
          data: { lesson: lesson.id, course: courseId, status: 'suggested', placeholder: true, presentation: 'video', start: 0, end: 20, timestamp: '0:00', hook: row.title, turn: row.title, land: row.title, theme: row.lane, kind: 'hors', engine: 'starter map' } as never,
        })) as unknown as Doc
      }
      const tier = await seedTier(payload, lesson, row.youtubeId, row.lengthSec)
      if (tier) {
        cut = (await payload.update({
          collection: 'cuts',
          id: cut.id,
          overrideAccess: true,
          data: { start: tier.appetiser.start, end: tier.appetiser.end, timestamp: formatTimestamp(tier.appetiser.start), hook: tier.hook, turn: tier.turn, land: tier.land, engine: 'line-mode draft' } as never,
        })) as unknown as Doc
      }
      const tagged = await one(payload, 'tags', { and: [{ 'item.value': { equals: cut.id } }, { lane: { equals: laneIds.get(row.lane) } }] })
      if (!tagged && row.lane !== DEFAULT_LANE) {
        await payload.create({ collection: 'tags', overrideAccess: true, data: { item: { relationTo: 'cuts', value: cut.id }, lane: laneIds.get(row.lane), scale: LANES.find((lane) => lane.key === row.lane)?.scale ? scaleIds.get(LANES.find((lane) => lane.key === row.lane)!.scale!) : undefined, state: 'confirmed', weight: 1, note: 'Starter map' } as never })
      }
    }
    if (row.existingTitle) await seedTier(payload, lesson, row.youtubeId, row.lengthSec)
    if (row.lane === DEFAULT_LANE && row.role === 'first' && cut) d0CutId = cut.id
    const list = laneStarters.get(row.lane) || []
    list.push({ lesson: lesson.id, role: row.role, order: list.length + 1 })
    laneStarters.set(row.lane, list)
  }
  for (const [key, starters] of laneStarters) {
    await payload.update({ collection: 'lanes', id: laneIds.get(key)!, overrideAccess: true, data: { starters } as never })
  }

  // Lesson 1 (Fahmy, session 6) now has its YouTube id, so its cuts play as video like every other talk.
  const fahmy = await one(payload, 'lessons', { title: { equals: 'How to Live Like the Prophet, Session 6' } })
  if (fahmy) {
    const cuts = await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 200, where: { lesson: { equals: fahmy.id } } })
    for (const cut of cuts.docs as unknown as Doc[]) {
      if (cut.presentation !== 'video') await payload.update({ collection: 'cuts', id: cut.id, overrideAccess: true, data: { presentation: 'video' } as never })
    }
  }

  // Lane tags suggested from each cut's best clause (rank 1 weight 1, lower ranks 0.6), at most two per cut.
  // Approved cuts are marked confirmed, standing in for the human pass in the tagging queue.
  const clauseNumber = new Map([...clauseIds.entries()].map(([number, id]) => [id, number]))
  const allCuts = (await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 1000, where: { placeholder: { not_equals: true } } })).docs as unknown as Doc[]
  for (const cut of allCuts) {
    const clause = Number(cut.bestClause || 0)
    if (!clause) continue
    const matches = LANES.filter((lane) => !lane.optInOnly)
      .map((lane) => ({ lane, rank: lane.clauses.find((row) => row.clause === clause)?.rank }))
      .filter((row): row is { lane: (typeof LANES)[number]; rank: number } => Boolean(row.rank))
      .sort((a, b) => a.rank - b.rank || a.lane.order - b.lane.order)
      .slice(0, 2)
    for (const match of matches) {
      const existing = await one(payload, 'tags', { and: [{ 'item.value': { equals: cut.id } }, { lane: { equals: laneIds.get(match.lane.key) } }] })
      const scale = match.lane.scale ? scaleIds.get(match.lane.scale) : undefined
      if (existing) {
        if (scale && !idOf(existing.scale)) await payload.update({ collection: 'tags', id: existing.id, overrideAccess: true, data: { scale } as never })
        continue
      }
      await payload.create({
        collection: 'tags',
        overrideAccess: true,
        data: {
          item: { relationTo: 'cuts', value: cut.id },
          lane: laneIds.get(match.lane.key),
          scale,
          weight: match.rank === 1 ? 1 : 0.6,
          state: cut.status === 'approved' ? 'confirmed' : 'suggested',
          note: `Clause ${clause} sits in ${match.lane.title} at rank ${match.rank}.`,
        } as never,
      })
    }
  }
  void clauseNumber

  // The local demo shows machine drafts to learners while they wait for review. A starter load for production leaves this off.
  await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { showUnchecked: opts.showUnchecked !== false } as never })

  await upsert(payload, 'opening-configs', { portal: { exists: false } }, { defaultClip: d0CutId, helpContacts: DEFAULT_HELP_CONTACTS, trendsContributionPrompt: true })
  const elm = portalIds.get('east-london')
  const leeds = portalIds.get('leeds')
  if (elm) {
    await upsert(payload, 'opening-configs', { portal: { equals: elm } }, {
      portal: elm,
      defaultClip: d0CutId,
      helpContacts: [
        { label: 'Samaritans, free from any phone, any time', phone: '116 123', url: 'https://www.samaritans.org', hours: '24 hours, every day' },
        { label: 'Muslim Youth Helpline, faith and culture aware', phone: '0808 808 2008', url: 'https://myh.org.uk', hours: 'Every day, 4pm to 10pm' },
        { label: 'If you are in danger right now, call 999', phone: '999' },
      ],
      trendsContributionPrompt: true,
    })
  }

  let starterPack = await one(payload, 'packs', { title: { equals: 'Starter map' } })
  if (!starterPack) {
    starterPack = (await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title: 'Starter map', summary: 'The first talk, the next talk and a longer course for each lane of the opening.', owner: 'master', courses: starterCourseIds } as never,
    })) as unknown as Doc
  }
  for (const portalId of [elm, leeds].filter((id): id is number => Boolean(id))) {
    const already = await one(payload, 'adoptions', { and: [{ portal: { equals: portalId } }, { pack: { equals: starterPack.id } }] })
    if (!already) await payload.create({ collection: 'adoptions', overrideAccess: true, data: { kind: 'pack', portal: portalId, pack: starterPack.id } as never })
  }
  for (const label of ['elm-learner', 'leeds-learner', 'elm-teacher', 'leeds-teacher', 'elm-admin']) {
    const doc = await one(payload, 'access-codes', { label: { equals: label } })
    if (!doc) continue
    const packs = ((doc.packs as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    if (!packs.includes(starterPack.id)) await payload.update({ collection: 'access-codes', id: doc.id, overrideAccess: true, data: { packs: [...packs, starterPack.id] } as never })
  }
  const seededPeople = (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 100, where: { email: { like: '@hearts.test' } } })).docs as unknown as Doc[]
  for (const person of seededPeople) {
    const list = Array.isArray(person.courseList) ? (person.courseList as unknown[]).map(Number) : null
    if (list && starterCourseIds.some((id) => !list.includes(id))) {
      await payload.update({ collection: 'users', id: person.id, overrideAccess: true, data: { courseList: [...new Set([...list, ...starterCourseIds])] } as never })
    }
  }

  return { laneIds, sceneIds, d0CutId, starterCourseIds, starterPackId: starterPack.id }
}

/**
 * The talk's tier record, drafted from its captions in line mode, and 2 or 3 draft pop-ups for the main. A record a
 * person has checked is left alone.
 */
async function seedTier(payload: Payload, lesson: Doc, youtubeId: string, lengthSec: number | null) {
  const raw = starterTranscript(youtubeId) || (typeof lesson.transcript === 'string' ? lesson.transcript : '')
  if (!raw) return null
  const draft = draftTiers(raw, lengthSec ?? (Number(lesson.durationSeconds) || null))
  if (!draft) return null
  const existing = await one(payload, 'talk-tiers', { lesson: { equals: lesson.id } })
  if (existing?.status === 'checked') {
    return { ...draft, hors: { start: Number(existing.horsStart), end: Number(existing.horsEnd), quote: String(existing.horsQuote || '') }, appetiser: { start: Number(existing.appetiserStart), end: Number(existing.appetiserEnd) }, hook: String(existing.hook || ''), turn: String(existing.turn || ''), land: String(existing.land || ''), popups: [], note: String(existing.note || '') }
  }
  const data = {
    lesson: lesson.id,
    horsStart: draft.hors.start,
    horsEnd: draft.hors.end,
    horsQuote: draft.hors.quote,
    appetiserStart: draft.appetiser.start,
    appetiserEnd: draft.appetiser.end,
    hook: draft.hook,
    turn: draft.turn,
    land: draft.land,
    hookAt: draft.hookAt,
    turnAt: draft.turnAt,
    landAt: draft.landAt,
    horsLines: draft.horsLines,
    lineTidy: buildLineTidy({
      speaker: String(lesson.speaker || ''),
      quote: draft.hors.quote,
      hook: draft.hook,
      turn: draft.turn,
      land: draft.land,
      horsLines: draft.horsLines,
    }),
    status: 'draft',
    offerResume: true,
    source: starterTranscript(youtubeId) ? `content/transcripts/starters/${youtubeId}.vtt` : 'the lesson transcript',
    note: draft.note,
  }
  if (existing) await payload.update({ collection: 'talk-tiers', id: existing.id, overrideAccess: true, data: data as never })
  else await payload.create({ collection: 'talk-tiers', overrideAccess: true, data: data as never })
  const drafts = await payload.count({ collection: 'engagement-points', overrideAccess: true, where: { and: [{ lesson: { equals: lesson.id } }, { status: { equals: 'draft' } }] } })
  if (!drafts.totalDocs) {
    for (const popup of draft.popups) {
      await payload.create({
        collection: 'engagement-points',
        overrideAccess: true,
        data: { lesson: lesson.id, second: popup.second, kind: 'reflection', prompt: popup.prompt, timing: 'immediate', delayAmount: 0, audience: 'everyone', status: 'draft', draftNote: DRAFT_NOTE } as never,
      })
    }
  }
  return draft
}

/** Every cut, ladder rung, pop-up and tier must sit inside its talk's real duration (bug 15). */
export async function timingCheck(payload: Payload) {
  const all = async (collection: string) => (await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as unknown as Doc[]
  const [lessons, cuts, ladder, points, tiers] = await Promise.all([all('lessons'), all('cuts'), all('ladder-items'), all('engagement-points'), all('talk-tiers')])
  const problems: string[] = []
  for (const lesson of lessons) {
    const rows: TimingRow[] = [
      ...cuts.filter((row) => idOf(row.lesson) === lesson.id).map((row) => ({ label: `Cut ${row.id}`, start: Number(row.start), end: Number(row.end) })),
      ...ladder.filter((row) => idOf(row.lesson) === lesson.id).map((row) => ({ label: `${String(row.kind)} ${row.id}`, start: Number(row.start), end: Number(row.end) })),
      ...points.filter((row) => idOf(row.lesson) === lesson.id).map((row) => ({ label: `Pop-up ${row.id}`, start: Number(row.second) })),
      ...tiers
        .filter((row) => idOf(row.lesson) === lesson.id)
        .flatMap((row) => [
          { label: "Hors d'oeuvre", start: Number(row.horsStart), end: Number(row.horsEnd) },
          { label: 'Appetiser', start: Number(row.appetiserStart), end: Number(row.appetiserEnd) },
        ]),
    ]
    if (!rows.length) continue
    for (const problem of timingProblems(Number(lesson.durationSeconds) || null, rows)) problems.push(`${String(lesson.title)}: ${problem}`)
  }
  return problems
}

const ACTIVITY_NAMES = ['Aisha Patel', 'Bilal Ahmed', 'Fatima Noor', 'Hamza Ali', 'Khadija Rahman', 'Musa Hassan', 'Nadia Karim', 'Omar Siddiqui', 'Ruqayyah Shah', 'Sami Chowdhury', 'Zainab Uddin', 'Yahya Begum']

/** Two looks for Maryam, a talk in between, and an older look for Hamza so the monthly card is due. */
async function seedCompassHistory(payload: Payload, maryam: Doc | null, hamza: Doc | null, portalId: number, now: Date) {
  const day = 86_400_000
  if (maryam && !(await one(payload, 'compass-attempts', { user: { equals: maryam.id } }))) {
    await payload.create({ collection: 'compass-attempts', overrideAccess: true, data: { user: maryam.id, portal: portalId, bank: 'opening', at: new Date(now.getTime() - 40 * day).toISOString(), scales: { anger: -0.8, gratitude: -0.6, worry: 0.4 } } as never })
    await payload.create({ collection: 'compass-attempts', overrideAccess: true, data: { user: maryam.id, portal: portalId, bank: 'month', lifeKey: 'people', at: new Date(now.getTime() - day).toISOString(), scales: { anger: 0.1, gratitude: -0.5, worry: 0.4 } } as never })
    const lesson = await lessonForScale(payload, 'anger')
    if (lesson) {
      const watchedAt = new Date(now.getTime() - 20 * day).toISOString()
      await payload.create({ collection: 'completions', overrideAccess: true, data: { user: maryam.id, lesson: lesson.id, percent: 100, onTime: true, portal: portalId, watchedAt } as never })
    }
  }
  if (hamza && !(await one(payload, 'compass-attempts', { user: { equals: hamza.id } }))) {
    await payload.create({ collection: 'compass-attempts', overrideAccess: true, data: { user: hamza.id, portal: portalId, bank: 'opening', at: new Date(now.getTime() - 40 * day).toISOString(), scales: { worry: -0.5 } } as never })
  }
}

async function lessonForScale(payload: Payload, scaleKey: string) {
  const scale = await one(payload, 'heart-scales', { key: { equals: scaleKey } })
  if (!scale) return null
  const lane = await one(payload, 'lanes', { scale: { equals: scale.id } })
  if (!lane) return null
  const tag = await one(payload, 'tags', { lane: { equals: lane.id } })
  if (!tag) return null
  const item = tag.item as { relationTo?: string; value?: unknown }
  const value = idOf(item?.value)
  if (!value) return null
  if (item.relationTo === 'lessons') return one(payload, 'lessons', { id: { equals: value } })
  const cut = (await payload.findByID({ collection: 'cuts', id: value, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
  const lessonId = cut ? idOf(cut.lesson) : null
  return lessonId ? one(payload, 'lessons', { id: { equals: lessonId } }) : null
}

/** The people the view-as tests use, and twelve learners with two weeks of ordinary use for the charts. */
export async function seedPeople(payload: Payload, opts: { portalIds: Map<string, number>; sceneIds: Map<string, number>; now: Date; courseList: number[] }) {
  const elm = opts.portalIds.get('east-london')!
  const leeds = opts.portalIds.get('leeds')!
  const code = async (label: string) => (await one(payload, 'access-codes', { label: { equals: label } }))?.id
  const ensure = async (data: Record<string, unknown>) => {
    const found = await one(payload, 'users', { email: { equals: data.email } })
    if (found) return found
    return (await payload.create({ collection: 'users', overrideAccess: true, data: data as never })) as unknown as Doc
  }
  await ensure({ email: 'leeds-admin@hearts.test', password: 'portal-admin', name: 'Bushra Iqbal', role: 'portal-admin', tenants: [{ tenant: leeds }], onboarded: true, seenWelcome: true, courseList: opts.courseList })
  await ensure({ email: 'master2@hearts.test', password: 'hearts-master', name: 'Idris Rahman', role: 'master', onboarded: true, seenWelcome: true })
  await ensure({ email: 'elm-learner2@hearts.test', password: 'portal-learner', name: 'Hamza Ali', role: 'learner', audience: 'learner', accessCode: await code('elm-learner'), tenants: [{ tenant: elm }], onboarded: true, seenWelcome: true, courseList: opts.courseList })

  // Maryam (L1 in the view-as tests): a finished opening with private answers, sharing on, and two pop-up answers.
  const maryam = await one(payload, 'users', { email: { equals: 'elm-learner@hearts.test' } })
  const teacher = await one(payload, 'users', { email: { equals: 'elm-teacher@hearts.test' } })
  if (maryam) {
    await payload.update({ collection: 'users', id: maryam.id, overrideAccess: true, data: { shareOpening: true } as never })
    const has = await one(payload, 'opening-answers', { user: { equals: maryam.id } })
    if (!has) {
      const picks: [string, string][] = [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['doors', 'calmer']]
      const { SCENES: scenes } = await import('../lib/opening-data')
      for (const [index, [sceneKey, optionKey]] of picks.entries()) {
        const option = scenes.find((scene) => scene.key === sceneKey)!.options.find((row) => row.key === optionKey)!
        const isPrivate = option.sensitivity === 'private'
        await payload.create({
          collection: 'opening-answers',
          overrideAccess: true,
          data: {
            user: maryam.id,
            portal: elm,
            scene: opts.sceneIds.get(sceneKey),
            sceneKey,
            optionKey,
            labelSnapshot: option.label,
            private: isPrivate,
            staffVisible: !isPrivate,
            mentors: teacher ? [teacher.id] : [],
            scenesVersion: 1,
            answeredAt: new Date(opts.now.getTime() - 2 * 86_400_000 + index * 9000).toISOString(),
            recordedAt: new Date(opts.now.getTime() - 2 * 86_400_000 + 70_000).toISOString(),
          } as never,
        })
      }
      const nur = await one(payload, 'lessons', { title: { equals: 'The Names Class 20: Al-Nur' } })
      const points = nur ? ((await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 10, sort: 'second', where: { lesson: { equals: nur.id } } })).docs as unknown as Doc[]) : []
      const reflection = 'First week of Ramadan. The house goes quiet before suhoor and I just sit there.'
      const picked = 'You start to incline towards the Akhira'
      for (const point of points.filter((row) => row.status !== 'draft').slice(0, 2)) {
        const choice = point.kind === 'multiple_choice'
        const body = choice ? picked : reflection
        const answer = (await payload.create({
          collection: 'answers',
          overrideAccess: true,
          data: { point: point.id, user: maryam.id, lesson: nur!.id, body: choice ? '' : body, choice: choice ? body : '', portal: elm, shareWithTeacher: true, answeredAt: new Date(opts.now.getTime() - 86_400_000).toISOString(), atSecond: point.second } as never,
        })) as unknown as Doc
        await payload.create({ collection: 'workbook-entries', overrideAccess: true, data: { user: maryam.id, answer: answer.id, lesson: nur!.id, course: idOf(nur!.course), body, consent: true, portal: elm } as never })
      }
    }
  }

  const hamza = await one(payload, 'users', { email: { equals: 'elm-learner2@hearts.test' } })
  await seedCompassHistory(payload, maryam, hamza, elm, opts.now)

  // Twelve learners, each coming back on a few of the last fourteen days.
  const first = await one(payload, 'users', { email: { equals: 'activity-1@hearts.test' } })
  if (first) return
  const lessons = (await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 40, where: { course: { in: opts.courseList } } })).docs as unknown as Doc[]
  const points = (await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 20, where: { status: { not_equals: 'draft' } } })).docs as unknown as Doc[]
  const learnCode = await code('elm-learner')
  let seed = 7
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (const [index, name] of ACTIVITY_NAMES.entries()) {
    const joined = new Date(opts.now.getTime() - (16 + index) * 86_400_000)
    const person = (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: `activity-${index + 1}@hearts.test`, password: 'portal-learner', name, role: 'learner', audience: 'learner', accessCode: learnCode, tenants: [{ tenant: elm }], onboarded: true, seenWelcome: true, joinedAt: joined.toISOString(), courseList: opts.courseList } as never,
    })) as unknown as Doc
    for (let day = 13; day >= 0; day -= 1) {
      // Busier towards Thursday's circle and at weekends, quieter midweek.
      const date = new Date(opts.now.getTime() - day * 86_400_000)
      const weekday = date.getUTCDay()
      const chance = weekday === 4 ? 0.7 : weekday === 0 || weekday === 6 ? 0.55 : 0.3
      if (random() > chance) continue
      const at = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 7 + Math.floor(random() * 14), Math.floor(random() * 60))).toISOString()
      const lesson = lessons[Math.floor(random() * lessons.length)]
      if (lesson) {
        await payload.create({ collection: 'completions', overrideAccess: true, data: { user: person.id, lesson: lesson.id, percent: 60 + Math.floor(random() * 41), portal: elm, createdAt: at, updatedAt: at } as never })
      }
      if (points.length && random() < 0.35) {
        const point = points[Math.floor(random() * points.length)]
        const exists = await one(payload, 'answers', { and: [{ user: { equals: person.id } }, { point: { equals: point.id } }] })
        if (!exists) {
          await payload.create({
            collection: 'answers',
            overrideAccess: true,
            data: { point: point.id, user: person.id, lesson: idOf(point.lesson), body: 'Not for anyone else. The bus was packed and I was late for work.', keepPrivate: true, portal: elm, answeredAt: at, createdAt: at, updatedAt: at } as never,
          })
        }
      }
    }
  }
}
