import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { courseCatcherTap } from '../../src/lib/course-controls'
import { maybeWidenPlaylist, sessionPlaylist } from '../../src/lib/feed-mix'
import { swipeTarget } from '../../src/lib/feed-nav'
import { dedicatedLaneFeed, feedMayWiden, playableLaneClips } from '../../src/lib/lanes'
import { STARTERS } from '../../src/seed/starters-data'
import { filmCoverKey, filmCoverVisible, filmIframeCrop } from '../../src/lib/yt-cover'
import type { CutInfo } from '../../src/lib/heart'
import type { FeedItem } from '../../src/server/learner'

const root = path.join(process.cwd(), 'src')

function clip(cutId: number, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id: String(cutId),
    cutId,
    lane: 'x',
    laneLabel: 'x',
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

test('1: Framing F is uncropped 16:9 contain, and the crop CSS is gone', () => {
  const crop = filmIframeCrop()
  assert.equal(crop.heightPct, 100)
  assert.equal(crop.topPct, 0)
  const journeyCss = readFileSync(path.join(root, 'app/(frontend)/journey.css'), 'utf8')
  const appCss = readFileSync(path.join(root, 'app/(frontend)/app.css'), 'utf8')
  const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
  const player = readFileSync(path.join(root, 'components/app/course-player.tsx'), 'utf8')
  assert.doesNotMatch(journeyCss, /height: 131\.6%/)
  assert.doesNotMatch(appCss, /height: 131\.6%/)
  assert.doesNotMatch(journeyCss, /top: -18\.4%/)
  assert.doesNotMatch(appCss, /top: -18\.4%/)
  assert.match(appCss, /object-fit: contain/)
  assert.match(appCss, /aspect-ratio: 16 \/ 9/)
  assert.doesNotMatch(journey, /yt-crop/)
  assert.doesNotMatch(player, /yt-crop/)
})

test('2: a course catcher tap while playing calls pauseVideo and not seek or reload', () => {
  const calls: string[] = []
  const player = {
    getPlayerState: () => 1,
    pauseVideo: () => calls.push('pauseVideo'),
    playVideo: () => calls.push('playVideo'),
    seekTo: () => calls.push('seekTo'),
    loadVideoById: () => calls.push('loadVideoById'),
    cueVideoById: () => calls.push('cueVideoById'),
  }
  assert.equal(courseCatcherTap(player), 'pause')
  assert.deepEqual(calls, ['pauseVideo'])
  calls.length = 0
  player.getPlayerState = () => 3
  assert.equal(courseCatcherTap(player), 'pause')
  assert.deepEqual(calls, ['pauseVideo'])
  calls.length = 0
  player.getPlayerState = () => 2
  assert.equal(courseCatcherTap(player), 'play')
  assert.deepEqual(calls, ['playVideo'])
  calls.length = 0
  player.getPlayerState = () => 5
  assert.equal(courseCatcherTap(player), 'play')
  assert.deepEqual(calls, ['playVideo'])
  const src = readFileSync(path.join(root, 'components/app/course-player.tsx'), 'utf8')
  assert.match(src, /courseCatcherTap/)
  assert.match(src, /userPausedRef/)
  const tap = src.slice(src.indexOf('const togglePlay'), src.indexOf('const close ='))
  assert.doesNotMatch(tap, /seekTo|loadVideoById|cueVideoById/)
  assert.equal(filmCoverVisible({ playing: false, playingForMs: 8000, paused: false, ended: false }), true, 'cover stays up while buffering / not playing')
  assert.equal(filmCoverVisible({ playing: true, playingForMs: 400, paused: false, ended: false }), true, 'cover stays for 4.5s of PLAYING')
})

test('3: a dedicated lane plays only its listed clips, then next is null', () => {
  const patience = STARTERS.filter((row) => row.lane === 'patience')
  assert.deepEqual(
    patience.map((row) => `${row.role}:${row.youtubeId}`),
    ['first:9k7QxXtCzaQ', 'next:fBzrLN77gng', 'mains:Rd0e9kXdPvI'],
  )
  assert.equal(patience[0].title.includes('Patience And Complaining'), true)
  assert.equal(patience[1].title.includes('Anger'), true)
  assert.equal(patience[2].title.includes('Anger Management'), true)
  const cuts: CutInfo[] = [
    { id: 1, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'patience', role: 'first' } },
    { id: 2, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'patience', role: 'next' } },
    { id: 3, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'patience', role: 'mains' } },
    { id: 9, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'gifts', role: 'first' } },
  ]
  const clips = Object.fromEntries([1, 2, 3, 9].map((id) => [String(id), clip(id)]))
  const own = playableLaneClips(clips, cuts, 'patience', 'Patience')
  assert.deepEqual(own.map((row) => row.cutId), [1, 2, 3])
  assert.equal(feedMayWiden('patience'), false)
  assert.equal(feedMayWiden(null), true)
  const catalogue = [clip(1), clip(2), clip(3), clip(9), clip(10)]
  assert.deepEqual(maybeWidenPlaylist(own, catalogue, 0, null, true).map((row) => row.cutId), [1, 2, 3])
  assert.ok(sessionPlaylist(own, catalogue, 0, null).length > 3)
  assert.equal(swipeTarget(own, 0, 'hors', 'next', undefined, true), 1)
  assert.equal(swipeTarget(own, 1, 'hors', 'next', undefined, true), 2)
  assert.equal(swipeTarget(own, 2, 'hors', 'next', undefined, true), null)
  const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
  assert.match(journey, /maybeWidenPlaylist/)
  assert.match(journey, /if \(props\.lane \|\| refilling/)
  assert.match(journey, /data-testid="feed-end"/)
  assert.match(journey, /Try another lane/)
  const home = readFileSync(path.join(root, 'screens/app/home.tsx'), 'utf8')
  assert.match(home, /const count = lane\.clips\.length/)
  assert.deepEqual(dedicatedLaneFeed(clips, cuts, { patience: 'Patience' }, 'patience').map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(dedicatedLaneFeed(clips, cuts, { patience: 'Patience' }, null), [])
})

test('4: the cover image is keyed to the clip being loaded', () => {
  assert.equal(filmCoverKey({ cutId: 4, youtubeId: 'N_-YiwIb-u0' }), '4:N_-YiwIb-u0')
  assert.equal(filmCoverKey({ cutId: 8, youtubeId: 'RZmsvGE785o' }), '8:RZmsvGE785o')
  assert.notEqual(filmCoverKey({ cutId: 4, youtubeId: 'N_-YiwIb-u0' }), filmCoverKey({ cutId: 8, youtubeId: 'RZmsvGE785o' }))
  assert.equal(filmCoverKey({ youtubeId: '' }), '')
  const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
  assert.match(journey, /setCoverKey\(filmCoverKey\(item\)\)/)
  assert.match(journey, /key=\{coverKey \|\| filmCoverKey\(item\)\}/)
  const player = readFileSync(path.join(root, 'components/app/course-player.tsx'), 'utf8')
  assert.match(player, /key=\{coverKey\}/)
})

test('5: the feed first paint does not read the clock, storage, or the window', () => {
  const journey = readFileSync(path.join(root, 'components/journey/journey.tsx'), 'utf8')
  assert.match(journey, /useState\(false\)/)
  assert.match(journey, /setDebugOn\(ytDebugOn\(window\.location\.search\)\)/)
  const debugInit = journey.slice(journey.indexOf('const [debugOn'), journey.indexOf('const [debugOn') + 80)
  assert.match(debugInit, /useState\(false\)/)
  const tabInit = journey.slice(journey.indexOf('const [tabs'), journey.indexOf('const [tabs') + 60)
  assert.match(tabInit, /useState\(false\)/)
  assert.match(journey, /suppressHydrationWarning|setTabs\(true\)/)
  const layout = readFileSync(path.join(root, 'app/(frontend)/layout.tsx'), 'utf8')
  assert.match(layout, /<body suppressHydrationWarning>/)
  assert.match(layout, /data-theme="evening"/)
})
