import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { afterClipEnds, showLaneEndNow } from '../../src/lib/film-advance'
import { swipeTarget } from '../../src/lib/feed-nav'
import { playableLaneClips } from '../../src/lib/lanes'
import type { CutInfo } from '../../src/lib/heart'
import type { FeedItem } from '../../src/server/learner'

const root = path.join(process.cwd(), 'src')
const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
const sheet = readFileSync(path.join(root, 'components/journey/sheet.tsx'), 'utf8')
const device = readFileSync(path.join(root, 'lib/device.ts'), 'utf8')

function clip(cutId: number): FeedItem {
  return {
    id: String(cutId),
    cutId,
    lane: 'company',
    laneLabel: 'Good company',
    speaker: 's',
    speakerSlug: 's',
    portrait: null,
    poster: null,
    youtubeId: `yt${cutId}xxxxxxxx`.slice(0, 11),
    courseId: 1,
    courseTitle: 'c',
    lessonId: cutId,
    hors: { start: 0, end: 15, quote: '' },
    appetiser: { start: 0, end: 60, quote: '' },
    hook: '',
    turn: '',
    land: '',
    style: null,
    clause: null,
    parents: {
      hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' },
      appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${cutId}`, parentLevel: 'talk' },
    },
  } as FeedItem
}

/** A six-clip lane: three starters, then three confirmed tags. */
function sixClipLane() {
  const cuts: CutInfo[] = [
    { id: 1, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'first' } },
    { id: 2, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'next' } },
    { id: 3, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'mains' } },
    { id: 4, clause: null, lanes: [{ lane: 'company', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
    { id: 5, clause: null, lanes: [{ lane: 'company', weight: 0.8, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
    { id: 6, clause: null, lanes: [{ lane: 'company', weight: 0.6, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
  ]
  const clips = Object.fromEntries(cuts.map((cut) => [String(cut.id), clip(cut.id)]))
  return playableLaneClips(clips, cuts, 'company', 'Good company')
}

test('a guest lane plays through every clip on its own, then shows the lane end', () => {
  const lane = sixClipLane()
  assert.deepEqual(lane.map((row) => row.cutId), [1, 2, 3, 4, 5, 6])
  const played = [lane[0].cutId]
  let index = 0
  let ends = 0
  for (;;) {
    ends += 1
    assert.ok(ends <= lane.length, 'the walk must stop at the lane end')
    const next = swipeTarget(lane, index, 'hors', 'next', undefined, true)
    const step = afterClipEnds({ nextIndex: next })
    if (step.kind === 'lane-end') {
      assert.equal(showLaneEndNow({ thisClipEnded: true, nextIndex: next }), true)
      break
    }
    index = step.next
    played.push(lane[index].cutId)
  }
  assert.deepEqual(played, [1, 2, 3, 4, 5, 6], 'five auto-advances, in lane order, with nothing in between')
  assert.equal(ends, 6)
})

test('the step after a clip ends has no sign-up branch and takes no signed-in flag', () => {
  assert.deepEqual(afterClipEnds({ nextIndex: 3 }), { kind: 'advance', next: 3 })
  assert.deepEqual(afterClipEnds({ nextIndex: null }), { kind: 'lane-end' })
  assert.equal(afterClipEnds.length, 1)
})

test('the clip-end handler never opens the Keep my place sheet', () => {
  const start = journey.indexOf('const runEndAdvance = useCallback(')
  const end = journey.indexOf('runEndAdvanceRef.current = runEndAdvance')
  assert.ok(start > 0 && end > start)
  const body = journey.slice(start, end)
  assert.match(body, /afterClipEnds\(\{ nextIndex: next \}\)/)
  assert.doesNotMatch(body, /openSheet|needsAccount|signedIn|sessionFlags|pendingAfterSheet/)
  assert.doesNotMatch(journey, /openSheet\('ended'\)|firstEnded|pendingAfterSheet|sheetCount/)
  assert.doesNotMatch(device, /sheetCount|firstEnded/)
})

test('the sheet only answers a guest tap: no clip-end reason, and only needsAccount opens it', () => {
  assert.match(sheet, /export type SheetReason = 'save' \| 'place'\n/)
  assert.doesNotMatch(sheet, /'ended'/)
  const opens = [...journey.matchAll(/openSheet\(/g)].length
  assert.equal(opens, 1, 'openSheet is called from one place')
  assert.match(journey, /const needsAccount = \(reason: SheetReason\) => \{\n\s+if \(signedIn\) return false\n\s+openSheet\(reason\)\n\s+return true/)
})
