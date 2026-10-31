import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PAGE, PLAIN_PAGE, PLAIN_TOOL, TOOL, helpSentenceCount, pageHelp, toolHelp } from './desk-help'
import { hasHeartsWording } from './portal-look'

const PAGES = [
  'overview',
  'teach',
  'feedback',
  'compass',
  'plans',
  'diaries',
  'nights',
  'gather',
  'content',
  'bringIn',
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
  'questions',
  'lanes',
  'simulator',
  'personas',
  'trends',
  'course',
  'compassLearner',
  'attendance',
  'experiments',
  'insights',
  'calendar',
  'live',
  'framing',
  'missions',
  'portalCreate',
  'portalEdit',
  'safety',
  'announcements',
  'transcripts',

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
    assert.match(PAGE.calendar, /Event Calendar/)
    assert.match(PAGE.nights, /Live in person/)
    assert.match(PAGE.live, /Live recordings/)
    assert.equal(pageHelp('live', 'desk-live'), PAGE.live)
    assert.equal(pageHelp('live', 'master-live'), PAGE.live)
    assert.equal(pageHelp('framing', 'master-framing'), PAGE.framing)
    assert.equal(pageHelp('framing', 'framing-clip'), PAGE.framing)
    assert.equal(pageHelp('nights', 'master-nights'), PAGE.nights)
    assert.equal(pageHelp('opening', 'admin-opening'), PAGE.opening)
    assert.match(pageHelp('opening', 'admin-opening', { plain: true }) || '', /any kind of work/)
    assert.equal(pageHelp('teach', undefined, { plain: true }), PAGE.teach)
    assert.equal(toolHelp('timeZone'), TOOL.timeZone)
    assert.doesNotMatch(toolHelp('timeZone', true), /masjid/)
    for (const text of Object.values(PLAIN_PAGE)) {
      if (!text) continue
      assert.equal(hasHeartsWording(text), false)
      const count = helpSentenceCount(text)
      assert.ok(count >= 2 && count <= 4, text)
    }
    for (const text of Object.values(PLAIN_TOOL)) {
      if (!text) continue
      assert.equal(hasHeartsWording(text), false)
      const count = helpSentenceCount(text)
      assert.ok(count >= 2 && count <= 4, text)
    }
    assert.ok(Object.keys(TOOL).length > 10)
  })
})
