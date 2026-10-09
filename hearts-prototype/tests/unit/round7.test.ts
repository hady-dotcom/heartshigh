import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { BOARD_CLOSE_DY, PICTURE_SWALLOW_MS, boardShouldClose, moreAfterAdvanceThenScrim, pictureTapIgnored } from '../../src/lib/board-gestures'
import { clipCanPlayOnLane, dedicatedLaneFeed, playableLaneClips } from '../../src/lib/lanes'
import { YT_CHROME_HOLD_MS, coverHoldKey, coverHoldMsLeft } from '../../src/lib/yt-cover'
import type { CutInfo } from '../../src/lib/heart'
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
    speaker: 's',
    speakerSlug: 's',
    portrait: null,
    poster: null,
    youtubeId: `yt${cutId}xxxxx`.slice(0, 11),
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
    ...extra,
  }
}

test('1: More, the board and the scrim never pause the film after an advance', () => {
  const after = moreAfterAdvanceThenScrim({
    userPausedAfterAdvance: false,
    boardOpen: false,
    leftoverTapAt: 900,
    swallowUntil: 1000,
    playerState: 1,
  })
  assert.equal(after.playing, true)
  assert.equal(after.pictureIgnored, true)
  assert.equal(pictureTapIgnored({ boardOpen: true, swallowUntil: 0, now: 10 }), true)
  assert.equal(PICTURE_SWALLOW_MS, 400)
  const closeDrawer = journey.slice(journey.indexOf('const closeDrawer'), journey.indexOf('const boardAction'))
  assert.match(closeDrawer, /swallowPicture|ignorePictureUntil/)
  assert.match(journey, /onPointerUp=\{\(event\) => \{ event\.stopPropagation\(\); event\.preventDefault\(\); closeDrawer\(event\) \}\}/)
  const scrimDown = journey.slice(journey.indexOf('data-testid="board-back"'), journey.indexOf('data-testid="board-back"') + 420)
  assert.doesNotMatch(scrimDown, /onPointerDown=\{\(event\) => \{ event\.stopPropagation\(\); event\.preventDefault\(\); closeDrawer/)
  assert.match(journey, /data-testid="board-handle"/)
  assert.match(journey, /pictureTapIgnored/)
  assert.match(journey, /userPausedRef\.current = next == null/)
  assert.match(journey, /horsWindowEnded/)
})

test('2: a 20px drag or a fast flick on the grab area closes the board', () => {
  assert.equal(BOARD_CLOSE_DY, 20)
  assert.equal(boardShouldClose(19), false)
  assert.equal(boardShouldClose(21), true)
  assert.equal(boardShouldClose(12, 0.4), true)
  assert.match(journeyCss, /\.j-board-grab \{[\s\S]*touch-action: none/)
  assert.match(journey, /data-testid="board-grab"/)
  assert.match(journey, /setPointerCapture/)
  const finish = journey.slice(journey.indexOf('const finishBoard'), journey.indexOf('const visiblePlayer'))
  assert.match(finish, /velocity/)
  assert.match(finish, /boardShouldClose\(dy, velocity\)/)
})

test('3: the end card closes the board and stays under its z-index', () => {
  assert.match(journey, /const showLaneEnd/)
  assert.match(journey, /setBoardOpen\(false\)/)
  const endCardAt = journeyCss.indexOf('\n.end-card {')
  const endCard = journeyCss.slice(endCardAt, endCardAt + 180)
  const board = journeyCss.slice(journeyCss.indexOf('.j-board {'), journeyCss.indexOf('.j-board {') + 280)
  assert.match(endCard, /z-index: 8/)
  assert.match(board, /z-index: 28/)
  assert.match(journey, /showLaneEnd\(\)/)
})

test('4: the lane card counts exactly the clips the player will play', () => {
  const cuts: CutInfo[] = [
    { id: 1, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'first' } },
    { id: 2, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'next' } },
    { id: 3, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'mains' } },
    { id: 4, clause: null, lanes: [{ lane: 'company', weight: 2, confirmed: true }], approved: true, hasHors: false, portalOwn: false },
    { id: 5, clause: null, lanes: [{ lane: 'company', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
  ]
  const clips = {
    1: clip(1),
    2: clip(2),
    3: clip(3),
    4: clip(4, { hors: { start: 0, end: 0, quote: '' } }),
    5: clip(5, { style: 'kinetic' }),
  }
  assert.equal(clipCanPlayOnLane(clips[1]), true)
  assert.equal(clipCanPlayOnLane(clips[4]), false)
  assert.equal(clipCanPlayOnLane(clips[5]), false)
  assert.deepEqual(playableLaneClips(clips, cuts, 'company', 'Good company').map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(dedicatedLaneFeed(clips, cuts, { company: 'Good company' }, 'company').map((row) => row.cutId), [1, 2, 3])
  assert.match(home, /const count = lane\.clips\.length/)
  assert.match(home, /lanesWithClips/)
  assert.match(journey, /playableLaneClips/)
  assert.match(journey, /dedicatedLaneFeed/)
})

test('5: every item switch restarts the 4.5s cover hold', () => {
  assert.equal(coverHoldMsLeft(0, 12_000), YT_CHROME_HOLD_MS)
  assert.equal(coverHoldMsLeft(1000, 2500), 3000)
  assert.equal(coverHoldKey(8, 'hors'), '8:hors')
  assert.notEqual(coverHoldKey(2, 'hors'), coverHoldKey(3, 'hors'))
  assert.match(journey, /coverHoldKey\(item\?\.cutId, mode/)
  assert.match(journey, /coverHoldStep/)
  assert.match(journey, /freshCoverHold/)
})

test('6: a last-clip swipe shows the end card, not a paused film', () => {
  const show = journey.slice(journey.indexOf('const showLaneEnd'), journey.indexOf('const advance ='))
  assert.match(show, /userPausedRef\.current = true/)
  assert.match(show, /endCardPlayerAction/)
  assert.match(show, /pauseVideo\(\)/)
  assert.match(show, /stopVideo\(\)/)
  assert.match(show, /setCoverHeld\(true\)/)
  assert.match(show, /setClipEnded\(true\)/)
  assert.match(show, /setBoardOpen\(false\)/)
  assert.match(journey, /swipe === 'next'\) \{\s*showLaneEnd\(\)/)
  assert.match(journey, /clipEnded/)
  assert.match(journey, /hostShouldShow\(at === visibleHost, revealed, Boolean\(slide \|\| scenic \|\| !currentSpec \|\| clipEnded\)\)/)
})

test('7: swipe handlers are on the catcher from the first paint', () => {
  const catcher = journey.slice(journey.indexOf('data-testid="film-catcher"'), journey.indexOf('data-testid="film-catcher"') + 280)
  assert.match(catcher, /\{\.\.\.swipe\}/)
  assert.match(catcher, /data-ready="yes"/)
  assert.doesNotMatch(catcher, /revealed/)
  assert.doesNotMatch(journey, /await wait\(0\)/)
  assert.match(journeyCss, /\.j-coach-card \{\s*pointer-events: none/)
  assert.match(journey, /data-testid="gesture-layer"/)
})

test('8: the first paint does not render live spoken words or read the clock', () => {
  assert.match(journey, /const \[wordsLive, setWordsLive\] = useState\(false\)/)
  assert.match(journey, /setWordsLive\(true\)/)
  assert.match(journey, /suppressHydrationWarning/)
  const debugInit = journey.slice(journey.indexOf('const [debugOn'), journey.indexOf('const [debugOn') + 80)
  assert.match(debugInit, /useState\(false\)/)
  assert.match(journey, /setDebugOn\(ytDebugOn\(window\.location\.search\)\)/)
})
