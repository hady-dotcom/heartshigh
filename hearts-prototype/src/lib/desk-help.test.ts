import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PAGE, TOOL, helpSentenceCount, pageHelp } from './desk-help'

const PAGES = [
  'overview',
  'teach',
  'feedback',
  'compass',
  'plans',
  'nights',
  'gather',
  'content',
  'sheet',
  'create',
  'library',
  'access',
  'opening',
  'circle',
  'ai',
  'settings',
  'wizard',
  'portals',
  'review',
  'tiers',
  'packs',
  'questions',
  'lanes',
  'simulator',
  'personas',
  'trends',
  'course',
  'compassLearner',
  'attendance',
]

describe('desk help', () => {
  it('has two to four short sentences for every desk page', () => {
    for (const key of PAGES) {
      const text = PAGE[key]
      assert.ok(text, key)
      const count = helpSentenceCount(text)
      assert.ok(count >= 2 && count <= 4, `${key} has ${count} sentences`)
      assert.doesNotMatch(text, /\b(color|favorite|normalize|center the)\b/i)
    }
    for (const [key, text] of Object.entries(TOOL)) {
      const count = helpSentenceCount(text)
      assert.ok(count >= 2 && count <= 4, `${key} has ${count} sentences`)
    }
  })

  it('resolves a page from the nav key or the screen test id', () => {
    assert.equal(pageHelp('teach'), PAGE.teach)
    assert.equal(pageHelp('overview', 'admin-overview'), PAGE.overview)
    assert.equal(pageHelp('create', 'portal-creator'), PAGE.create)
    assert.equal(pageHelp('sheet', 'master-sheet'), PAGE.sheet)
    assert.ok(Object.keys(TOOL).length > 10)
  })
})
