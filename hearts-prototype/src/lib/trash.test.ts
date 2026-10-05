import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  daysLeftInTrash,
  groupTrash,
  isExpiredTrash,
  isTrashCollection,
  staffMayUseTrash,
  trashCutoff,
  trashTitle,
  TRASH_COLLECTIONS,
  TRASH_KEEP_DAYS,
} from './trash'

describe('C15 trash helpers', () => {
  it('covers the listed collections and skips people', () => {
    const slugs = TRASH_COLLECTIONS.map((row) => row.slug)
    assert.ok(slugs.includes('courses'))
    assert.ok(slugs.includes('units'))
    assert.ok(slugs.includes('lessons'))
    assert.ok(slugs.includes('engagement-points'))
    assert.ok(slugs.includes('access-codes'))
    assert.ok(slugs.includes('packs'))
    assert.ok(TRASH_COLLECTIONS.some((row) => row.optional && row.slug.startsWith('announce')))
    assert.ok(TRASH_COLLECTIONS.some((row) => row.slug.startsWith('circle-')))
    assert.equal(isTrashCollection('users'), false)
    assert.equal(isTrashCollection('answers'), false)
    assert.equal(staffMayUseTrash('portal-admin'), true)
    assert.equal(staffMayUseTrash('teacher'), false)
    assert.equal(staffMayUseTrash('learner'), false)
  })

  it('empties after 30 days and groups with counts', () => {
    const when = new Date('2026-10-04T12:00:00.000Z')
    const fresh = new Date('2026-09-20T12:00:00.000Z').toISOString()
    const old = new Date('2026-08-01T12:00:00.000Z').toISOString()
    assert.equal(isExpiredTrash(fresh, when), false)
    assert.equal(isExpiredTrash(old, when), true)
    assert.equal(daysLeftInTrash(fresh, when) > 0, true)
    assert.equal(daysLeftInTrash(old, when), 0)
    assert.ok(trashCutoff(when) < when)
    assert.equal(TRASH_KEEP_DAYS, 30)
    const groups = groupTrash([
      { id: 1, collection: 'courses', title: 'A' },
      { id: 2, collection: 'courses', title: 'B' },
      { id: 3, collection: 'access-codes', title: 'ELM-X' },
    ])
    assert.equal(groups[0].label, 'Courses')
    assert.equal(groups[0].count, 2)
    assert.equal(groups[1].count, 1)
    assert.equal(trashTitle({ title: 'Saturday class' }, 'courses'), 'Saturday class')
    assert.equal(trashTitle({ code: 'ELM-LEARN' }, 'access-codes'), 'ELM-LEARN')
  })
})
