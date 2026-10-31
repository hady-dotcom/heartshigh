import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { changedTierFields, straddlingTiers, TIER_TIMING_FIELDS } from '../../src/lib/tiers'

const dir = mkdtempSync(path.join(tmpdir(), 'hearts-straddle-'))
process.env.DATABASE_URL = `file:${path.join(dir, 'hearts.db')}`
process.env.DATABASE_ADAPTER = 'sqlite'
process.env.PAYLOAD_SECRET = 'tier-straddle-test-secret-32chars'
Object.assign(process.env, { NODE_ENV: 'test' })

const SPANS = [
  { role: 'hook', start: 10, end: 40 },
  { role: 'turn', start: 60, end: 100 },
  { role: 'land', start: 120, end: 150 },
]

test('changed fields: an unchanged copy of a field is not a change, a new value is, a new tier counts everything sent', () => {
  const original = { horsStart: 12, horsEnd: 34, appetiserSpans: SPANS, lesson: 7, hook: 'a' }
  assert.deepEqual(changedTierFields({ lineTidy: { version: 1 } }, original, TIER_TIMING_FIELDS), [])
  assert.deepEqual(changedTierFields({ ...original, lineTidy: {} }, original, TIER_TIMING_FIELDS), [])
  assert.deepEqual(changedTierFields({ horsStart: '12' }, original, TIER_TIMING_FIELDS), [])
  assert.deepEqual(changedTierFields({ appetiserSpans: JSON.parse(JSON.stringify(SPANS)) }, original, TIER_TIMING_FIELDS), [])
  assert.deepEqual(changedTierFields({ lesson: { id: 7, title: 'x' } }, original, ['lesson']), [])
  assert.deepEqual(changedTierFields({ horsEnd: 35 }, original, TIER_TIMING_FIELDS), ['horsEnd'])
  assert.deepEqual(changedTierFields({ hook: 'b' }, original, ['hook']), ['hook'])
  assert.deepEqual(changedTierFields({ horsStart: 1, horsEnd: 2 }, undefined, TIER_TIMING_FIELDS), ['horsStart', 'horsEnd'])
})

test('straddle report lists only tiers whose hors d\'oeuvre crosses two cuts', () => {
  const rows = [
    { id: 1, lesson: { id: 11, title: 'Inside' }, horsStart: 15, horsEnd: 35, appetiserStart: 10, appetiserEnd: 150, appetiserSpans: SPANS },
    { id: 2, lesson: { id: 12, title: 'Across' }, horsStart: 30, horsEnd: 65, appetiserStart: 10, appetiserEnd: 150, appetiserSpans: SPANS },
    { id: 3, lesson: 13, horsStart: 20, horsEnd: 40, appetiserStart: 10, appetiserEnd: 150, appetiserSpans: null },
  ]
  const report = straddlingTiers(rows)
  assert.equal(report.length, 1)
  assert.equal(report[0].id, 2)
  assert.equal(report[0].lesson, 12)
  assert.equal(report[0].title, 'Across')
  assert.match(report[0].problem, /within one of its cuts/)
})

test('a tier saved before the nesting rule takes a lines-only update, a timing change is still checked', { timeout: 180_000 }, async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  const { closePayload } = await import('../../src/lib/prepare-db')
  const payload = await getPayload({ config })
  try {
    const course = await payload.create({ collection: 'courses', overrideAccess: true, data: { title: 'Straddle', origin: 'master', visibility: 'published' } as never })
    const unit = await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Talks', course: course.id, order: 1 } as never })
    const lesson = await payload.create({
      collection: 'lessons', overrideAccess: true,
      data: { title: 'Straddle talk', course: course.id, unit: unit.id, speaker: 'A speaker', youtubeId: 'straddle001', order: 1, durationSeconds: 600, transcriptSource: 'none' } as never,
    })
    const tier = await payload.create({
      collection: 'talk-tiers', overrideAccess: true,
      data: { lesson: lesson.id, horsStart: 15, horsEnd: 35, appetiserStart: 10, appetiserEnd: 150, appetiserSpans: SPANS, hook: 'One', turn: 'Two', land: 'Three' } as never,
    })
    // Written straight to the table, as the older imports did, so the hook never sees it.
    await payload.db.updateOne({ collection: 'talk-tiers', id: tier.id, data: { horsStart: 30, horsEnd: 65 } as never })
    const before = await payload.findByID({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, depth: 0 })
    assert.equal(straddlingTiers([before as unknown as Record<string, unknown>]).length, 1)

    const lineTidy = { version: 1, source: 'fallback', quote: { raw: '', text: '' }, hook: { raw: 'One', text: 'One.' }, turn: { raw: 'Two', text: 'Two.' }, land: { raw: 'Three', text: 'Three.' }, horsLines: [] }
    const saved = await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: { lineTidy } as never })
    assert.deepEqual((saved as { lineTidy?: unknown }).lineTidy, lineTidy)
    const again = await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: { lineTidy } as never })
    assert.deepEqual((again as { lineTidy?: unknown }).lineTidy, lineTidy)

    await assert.rejects(
      payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: { horsEnd: 66 } as never }),
      /sit inside the appetiser/,
    )
    const fixed = await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: { horsStart: 62, horsEnd: 90 } as never })
    assert.equal(straddlingTiers([fixed as unknown as Record<string, unknown>]).length, 0)
  } finally {
    await closePayload(payload)
  }
})
