import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { DRAFT_NOTE } from '../../src/lib/tiers'
import { buildWorkbook, planCounts } from '../../src/lib/master-sheet'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-speakers-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'speakers-import-test-secret-32chars'
process.env.NODE_ENV = 'test'

const VARIANTS = [
  ['aaaaaaaaaaa', 'Sh. Mohammad Elshinawy', 'Mohammad Elshinawy'],
  ['bbbbbbbbbbb', 'Dr. Tesneem Alkiek', 'Tesneem Alkiek'],
  ['ccccccccccc', 'Dr. Umar Faruq Abd-Allah', 'Umar Faruq Abd-Allah'],
  ['ddddddddddd', 'Ustadh Naeem Baig (Hāfidh)', 'Naeem Baig'],
  ['eeeeeeeeeee', 'Alaeddin Albakri', 'Alauddin Elbakri'],
] as const

test('dry run, real import with the alias cases, export round trip, and the learner push', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { seedSpeakers } = await import('../../src/seed/speakers')
  const { applyImportedPlan, exportBuffer, planBuffer, scopeFrom } = await import('../../src/server/master-sheet')
  const { closePayload } = await import('../../src/lib/prepare-db')
  const payload = await getPayload({ config })
  try {
    await seedSpeakers(payload)
    const course = await payload.create({
      collection: 'courses', overrideAccess: true,
      data: { title: 'Alias sittings', origin: 'master', speaker: 'Sh. Mohammad Elshinawy', importable: true, visibility: 'published' } as never,
    })
    const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Talks', course: course.id, order: 1 } as never })
    const lessons = []
    for (const [youtubeId, speaker] of VARIANTS) {
      lessons.push(await payload.create({
        collection: 'lessons', overrideAccess: true,
        data: { title: speaker, course: course.id, unit: unit.id, speaker, youtubeId, order: 1, durationSeconds: 90, transcriptSource: 'none' } as never,
      }))
    }
    const quiet = await payload.create({
      collection: 'engagement-points', overrideAccess: true,
      data: { lesson: lessons[0].id, second: 10, kind: 'reflection', prompt: 'When did you last feel the quiet before suhoor?', triggerType: 'timestamp', status: 'published' } as never,
    })
    const draft = await payload.create({
      collection: 'engagement-points', overrideAccess: true,
      data: { lesson: lessons[0].id, second: 20, kind: 'reflection', prompt: 'What stayed with you from the opening line?', triggerType: 'timestamp', status: 'draft', draftNote: DRAFT_NOTE } as never,
    })
    const portal = await payload.create({
      collection: 'portals', overrideAccess: true,
      data: { name: 'Alias Mosque', slug: 'alias-mosque', kind: 'mosque', wizardDone: true } as never,
    })
    const pack = await payload.create({ collection: 'packs', overrideAccess: true, data: { title: 'Jibril sittings', owner: 'master', courses: [] } as never })
    const code = await payload.create({ collection: 'access-codes', overrideAccess: true, data: { code: 'ALIAS-PUSH-CODE', role: 'learner', packs: [pack.id], label: 'Alias push', portal: portal.id } as never })
    const saved = await payload.create({
      collection: 'users', overrideAccess: true,
      data: { email: 'alias-saved@hearts.test', password: 'hearts-learner-test-password', name: 'Saved list', role: 'learner', accessCode: code.id, courseList: [], tenants: [{ tenant: portal.id }] } as never,
    })
    const live = await payload.create({
      collection: 'users', overrideAccess: true,
      data: { email: 'alias-live@hearts.test', password: 'hearts-learner-test-password', name: 'Live list', role: 'learner', accessCode: code.id, tenants: [{ tenant: portal.id }] } as never,
    })
    const scope = scopeFrom('library', null, null, 'master')
    const buffer = await buildWorkbook({
      talks: VARIANTS.map(([youtubeId, speaker], index) => ({ talk_key: `yt-${youtubeId}`, speaker, ...(index === 0 ? { pack: 'Jibril sittings' } : {}) })),
      questions: [
        { talk_key: 'yt-aaaaaaaaaaa', question_id: quiet.id, text: 'When did you last feel the quiet before suhoor?', place: 'popup', evidence: 'none', show_imam: 'no', status: 'approved', source: 'human' },
        { talk_key: 'yt-aaaaaaaaaaa', question_id: draft.id, text: 'What stayed with you from the opening line?', source: 'human', notes: DRAFT_NOTE, status: 'draft' },
      ],
    })
    const dry = await planBuffer(payload, scope, buffer)
    assert.equal(dry.plan.errors.length, 0, dry.plan.errors.map((issue) => `${issue.column}: ${issue.message}`).join('\n'))
    assert.ok(dry.counts.update >= VARIANTS.length)
    assert.equal(dry.plan.ops.filter((op) => op.op === 'pack.add').length, 1)
    assert.equal(dry.plan.ops.filter((op) => op.op === 'point.update').length, 1)
    const before = await payload.findByID({ collection: 'users', id: saved.id, depth: 0, overrideAccess: true })
    assert.deepEqual((before as { courseList?: unknown }).courseList, [])

    const snapshot = await applyImportedPlan(payload, dry.plan, { id: saved.id, role: 'master' }, null, { pushLearners: true, fileName: 'aliases.xlsx' })
    assert.equal(snapshot.pushedLearners, 1)
    for (const [youtubeId, , canonical] of VARIANTS) {
      const found = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 1, where: { youtubeId: { equals: youtubeId } } })
      const row = found.docs[0] as { speaker?: string; speakerProfile?: number }
      assert.equal(row.speaker, canonical)
      assert.equal(typeof row.speakerProfile, 'number')
    }
    const packed = await payload.findByID({ collection: 'packs', id: pack.id, depth: 0, overrideAccess: true }) as { courses?: unknown[] }
    assert.deepEqual(packed.courses, [course.id])
    const afterSaved = await payload.findByID({ collection: 'users', id: saved.id, depth: 0, overrideAccess: true }) as { courseList?: unknown }
    assert.deepEqual(afterSaved.courseList, [course.id])
    const afterLive = await payload.findByID({ collection: 'users', id: live.id, depth: 0, overrideAccess: true }) as { courseList?: unknown }
    assert.equal(afterLive.courseList ?? null, null)
    const draftRow = await payload.findByID({ collection: 'engagement-points', id: draft.id, depth: 0, overrideAccess: true }) as { draftNote?: string }
    assert.equal(draftRow.draftNote, 'Written by a person on the master sheet.')
    const quietRow = await payload.findByID({ collection: 'engagement-points', id: quiet.id, depth: 0, overrideAccess: true }) as { family?: string | null; evidence?: string | null }
    assert.equal(quietRow.family || '', '')
    assert.equal(quietRow.evidence || '', '')
    const audit = await payload.find({ collection: 'audit-log', overrideAccess: true, depth: 0, limit: 5, where: { event: { equals: 'sheet.push-learners' } } })
    assert.equal(audit.totalDocs, 1)
    assert.equal((audit.docs[0] as { detail?: { pushedLearners?: number } }).detail?.pushedLearners, 1)

    const exported = await exportBuffer(payload, scope)
    const round = await planBuffer(payload, scope, exported)
    assert.equal(round.plan.errors.length, 0, round.plan.errors.map((issue) => `${issue.tab} ${issue.column}: ${issue.message}`).join('\n'))
    assert.equal(planCounts(round.plan).create, 0)
    assert.equal(planCounts(round.plan).update, 0)
    assert.equal(round.plan.ops.length, 0)

    const second = await applyImportedPlan(payload, round.plan, { id: saved.id, role: 'master' }, null, { pushLearners: false, fileName: 'aliases.xlsx' })
    assert.equal(second.pushedLearners, undefined)
    const still = await payload.findByID({ collection: 'users', id: saved.id, depth: 0, overrideAccess: true }) as { courseList?: unknown[] }
    assert.deepEqual(still.courseList, [course.id])
    const audits = await payload.find({ collection: 'audit-log', overrideAccess: true, depth: 0, limit: 5, where: { event: { equals: 'sheet.push-learners' } } })
    assert.equal(audits.totalDocs, 1)
  } finally {
    await closePayload(payload)
  }
})

after(() => {
  /* payload is closed inside the test */
})
