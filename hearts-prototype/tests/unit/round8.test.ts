import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'path'
import { test } from 'node:test'
import { saveDuringAdvanceThenTap } from '../../src/lib/board-gestures'
import { swipeTarget } from '../../src/lib/feed-nav'
import { endedEventIsCurrent, horsWindowEnded, hostShouldShow, pictureSwipeCommit, showLaneEndNow } from '../../src/lib/film-advance'
import { clipCanPlayOnLane, dedicatedLaneFeed, lanesWithClips, playableLaneClips, takeDedicatedLane } from '../../src/lib/lanes'
import { STARTERS } from '../../src/seed/starters-data'
import { coverHoldMayStart } from '../../src/lib/yt-cover'
import type { CutInfo, LaneDef } from '../../src/lib/heart'
import type { FeedItem } from '../../src/server/learner'

const root = path.join(process.cwd(), 'src')
const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
const journeyCss = readFileSync(path.join(root, 'app/(frontend)/journey.css'), 'utf8')
const home = readFileSync(path.join(root, 'screens/app/home.tsx'), 'utf8')

function clip(cutId: number, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id: String(cutId),
    cutId,
    lane: 'company',
    laneLabel: 'Good company',
    speaker: extra.speaker || 's',
    speakerSlug: 's',
    portrait: null,
    poster: null,
    youtubeId: extra.youtubeId || `yt${cutId}xxxxx`.slice(0, 11),
    courseId: 1,
    courseTitle: 'c',
    lessonId: cutId,
    lessonTitle: extra.lessonTitle || `talk ${cutId}`,
    hors: extra.hors || { start: 0, end: 15, quote: '' },
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
    ...extra,
  }
}

const companyStarters = STARTERS.filter((row) => row.lane === 'company')

test('1: the last clip autoplays and the end card appears only at its end', () => {
  const last = [clip(1), clip(2), clip(3)]
  assert.equal(swipeTarget(last, 2, 'hors', 'next', undefined, true), null)
  assert.equal(showLaneEndNow({ thisClipEnded: false, nextIndex: null }), false)
  assert.equal(showLaneEndNow({ thisClipEnded: true, nextIndex: null }), true)
  assert.equal(endedEventIsCurrent({ watchKey: '3:hors:talk', eventKey: '2:hors:talk', watchEnded: false, playerState: -1 }), false)
  assert.equal(endedEventIsCurrent({ watchKey: '3:hors:talk', eventKey: '3:hors', watchEnded: false, playerState: 0 }), true)
  assert.equal(endedEventIsCurrent({ watchKey: '3:hors:talk', watchEnded: false, playerState: 0 }), false)
  assert.equal(horsWindowEnded(0, 0, 16), false)
  assert.equal(hostShouldShow(true, true, false), true)
  assert.match(journey, /endedEventIsCurrent/)
  assert.match(journey, /horsWindowEnded/)
  assert.match(journey, /showLaneEndNow/)
  assert.match(journey, /clipEnded && mode === 'hors'/)
  assert.match(journey, /swipe === 'next'\) \{\s*showLaneEnd\(\)/)
  const show = journey.slice(journey.indexOf('const showLaneEnd'), journey.indexOf('const advance ='))
  assert.match(show, /setClipEnded\(true\)/)
  assert.doesNotMatch(journey, /if \(next == null\) \{\s*showLaneEnd\(\)/)
})

test('2: the company lane order is deterministic and its count equals the card', () => {
  assert.deepEqual(
    companyStarters.map((row) => `${row.speaker} · ${row.title} · ${row.youtubeId}`),
    [
      'Shadee Elmasry · On Mosques, Companionship, & Knowledge · N_-YiwIb-u0',
      'Khalid Latif · Still Lonely in a Full Masjid? | Imam Khalid Latif & Imam Ahmad Saleem | Muslim Wellness Center · 45XUrfJS68Q',
      'Umair Haseeb · How to Give Good Advice - In Good Company ft. Shaykh Umair Haseeb · rUIMxBh3aqo',
    ],
  )
  const cuts: CutInfo[] = [
    { id: 1, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'first' } },
    { id: 2, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'next' } },
    { id: 3, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'mains' } },
    { id: 8, clause: null, lanes: [{ lane: 'company', weight: 2, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
    { id: 9, clause: null, lanes: [{ lane: 'company', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
    { id: 4, clause: null, lanes: [{ lane: 'trust', weight: 3, confirmed: true }], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'trust', role: 'mains' } },
  ]
  const clips = {
    1: clip(1, { speaker: companyStarters[0].speaker, lessonTitle: companyStarters[0].title, youtubeId: companyStarters[0].youtubeId }),
    2: clip(2, { speaker: companyStarters[1].speaker, lessonTitle: companyStarters[1].title, youtubeId: companyStarters[1].youtubeId }),
    3: clip(3, { speaker: companyStarters[2].speaker, lessonTitle: companyStarters[2].title, youtubeId: companyStarters[2].youtubeId }),
    8: clip(8, { speaker: 'Tagged A', lessonTitle: 'Company extra A', youtubeId: 'AAAAAAAAAAA' }),
    9: clip(9, { speaker: 'Tagged B', lessonTitle: 'Company extra B', youtubeId: 'BBBBBBBBBBB' }),
    4: clip(4, { speaker: 'Yasir Fahmy', lessonTitle: 'Dua 1', youtubeId: 'UGuKJLZnbi8', lane: 'trust' }),
  }
  const first = playableLaneClips(clips, cuts, 'company', 'Good company')
  const second = playableLaneClips(clips, cuts, 'company', 'Good company')
  assert.deepEqual(first.map((row) => row.cutId), [1, 2, 3, 8, 9])
  assert.deepEqual(second.map((row) => row.cutId), first.map((row) => row.cutId))
  assert.deepEqual(dedicatedLaneFeed(clips, cuts, { company: 'Good company' }, 'company').map((row) => row.youtubeId), first.map((row) => row.youtubeId))
  const mixed = [clips[4], clips[1], clips[3]]
  assert.deepEqual(takeDedicatedLane('company', first, mixed).map((row) => row.cutId), [1, 2, 3, 8, 9])
  assert.deepEqual(takeDedicatedLane(null, first, mixed).map((row) => row.cutId), [4, 1, 3])
  const route = { lanes: [{ key: 'company', title: 'Good company', optInOnly: false } as LaneDef], cuts }
  const card = lanesWithClips(route, clips, { company: 'Good company' }).find((lane) => lane.key === 'company')
  assert.equal(card?.clips.length, first.length)
  assert.equal(first.every(clipCanPlayOnLane), true)
  assert.match(home, /const count = lane\.clips\.length/)
  assert.match(journey, /takeDedicatedLane/)
  assert.match(journey, /playableLaneClips/)
  assert.doesNotMatch(journey.slice(journey.indexOf('if (props.lane) {'), journey.indexOf('const data = await fetchFeed')), /fetchFeed/)
})

test('3: Save during advance, then a tap pauses with the cover shown and does not skip', () => {
  const after = saveDuringAdvanceThenTap({
    holdReset: true,
    playStartedFromNewPlaying: true,
    tapTravelX: 1,
    tapTravelY: 4,
  })
  assert.equal(after.coverHeld, true)
  assert.equal(after.pause, true)
  assert.equal(after.skip, false)
  assert.equal(pictureSwipeCommit(0, 8), false)
  assert.equal(pictureSwipeCommit(0, 40), true)
  assert.equal(
    coverHoldMayStart({
      holdKey: '12:hors:12:hors',
      holdFor: '12:hors:12:hors',
      specKey: '12:hors',
      hostSpecKey: '11:hors',
      state: 1,
      currentTime: 314,
      start: 0,
    }),
    false,
  )
  assert.match(journey, /coverHoldStep/)
  assert.match(journey, /pictureSwipeCommit/)
  const catcherAt = journey.indexOf('data-testid="film-catcher"')
  const gestureAt = journey.indexOf('data-testid="gesture-layer"')
  assert.ok(gestureAt >= 0 && catcherAt > gestureAt, 'the catcher sits in the slot above the iframe, after the gesture layer')
  assert.match(journeyCss, /\.j-slot \.j-tap-catcher \{ z-index: 20/)
  assert.match(journeyCss, /\.j-tap-catcher \{[\s\S]*z-index: 20/)
  assert.match(journeyCss, /\.yt-host iframe[\s\S]*pointer-events: none !important/)
})
