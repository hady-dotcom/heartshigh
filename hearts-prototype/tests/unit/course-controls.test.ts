import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { courseCatcherTap, coursePlayVisible, feedCatcherPointer } from '../../src/lib/course-controls'
import { maybeWidenPlaylist, sessionPlaylist } from '../../src/lib/feed-mix'
import { dedicatedLaneFeed, playableLaneClips, takeDedicatedLane } from '../../src/lib/lanes'
import { helpFor } from '../../src/lib/page-help'
import type { CutInfo } from '../../src/lib/heart'
import type { FeedItem } from '../../src/server/learner'

const courseScreen = readFileSync(new URL('../../src/screens/app/course.tsx', import.meta.url), 'utf8')
const player = readFileSync(new URL('../../src/components/app/course-player.tsx', import.meta.url), 'utf8')
const journey = readFileSync(new URL('../../src/components/journey/journey.tsx', import.meta.url), 'utf8')

test('the course parts list does not offer Ready for more? jumps', () => {
  assert.equal(courseScreen.includes('course-appetiser'), false)
  assert.equal(courseScreen.includes('Ready for more?'), false)
  assert.equal(courseScreen.includes('talk-tiers'), false)
  assert.match(courseScreen, /data-testid="part-link"/)
  assert.match(courseScreen, /Parts of this course/)
  assert.match(courseScreen, /lessons\.map\(\(row, index\)/)
  assert.equal(courseScreen.includes('courseDoors('), false)
  assert.equal(courseScreen.includes('groupByDoor('), false)
  assert.match(courseScreen, /data-testid="part-week"/)
})

test('a tap on the course catcher while playing calls pauseVideo, not seek or reload', () => {
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
})

test('a feed picture tap with dy under 10 pauses, and a 40px vertical swipe does not', () => {
  const calls: string[] = []
  const live = {
    getPlayerState: () => 1,
    pauseVideo: () => calls.push('pauseVideo'),
    playVideo: () => calls.push('playVideo'),
    seekTo: () => calls.push('seekTo'),
    loadVideoById: () => calls.push('loadVideoById'),
    cueVideoById: () => calls.push('cueVideoById'),
  }
  assert.equal(feedCatcherPointer(live, 0, 9), 'pause')
  assert.deepEqual(calls, ['pauseVideo'])
  assert.equal(feedCatcherPointer(live, 0, 40), 'swipe')
  assert.deepEqual(calls, ['pauseVideo'])
  assert.match(journey, /courseCatcherTap/)
  assert.match(journey, /pictureIsTap/)
  assert.match(journey, /runPictureTap/)
  assert.match(journey, /setPointerCapture/)
  const catcher = journey.slice(journey.indexOf('data-testid="film-catcher"'), journey.indexOf('data-testid="film-catcher"') + 420)
  assert.match(catcher, /onClick/)
  assert.match(catcher, /runPictureTap/)
})

test('play and pause stay on the lecture while it is playing', () => {
  assert.equal(coursePlayVisible({ loading: false, questionOpen: false }), true)
  assert.equal(coursePlayVisible({ loading: true, questionOpen: false }), false)
  assert.equal(coursePlayVisible({ loading: false, questionOpen: true }), false)
  assert.match(player, /coursePlayVisible/)
  assert.match(player, /data-testid="player-play"/)
  assert.match(player, /j-tap-catcher/)
  assert.match(player, /setPointerCapture/)
  assert.doesNotMatch(player, /className="big-play"/)
  assert.doesNotMatch(player, /Hide more/)
  assert.match(journey, /setPointerCapture/)
  assert.doesNotMatch(journey, /Hide more/)
  assert.match(journey, /data-catcher="yes"/)
  assert.match(journey, /data-testid="film-catcher"/)
  assert.match(journey, /boardTapFires\(/)
  assert.match(journey, /coverHoldStep/)
  const openDrawer = journey.slice(journey.indexOf('const openDrawer'), journey.indexOf('const closeDrawer'))
  assert.doesNotMatch(openDrawer, /pause|mute|playVideo|silence|stopVisible|hush/)
  assert.match(journey, /if \(boardOpenRef\.current\) return/)
  const own = [
    { cutId: 1, youtubeId: 'N_-YiwIb-u0', hors: { start: 0, end: 15 } },
    { cutId: 2, youtubeId: '45XUrfJS68Q', hors: { start: 0, end: 15 } },
    { cutId: 3, youtubeId: 'rUIMxBh3aqo', hors: { start: 0, end: 15 } },
  ] as FeedItem[]
  const mixed = [{ cutId: 9, youtubeId: 'UGuKJLZnbi8', hors: { start: 0, end: 15 } }, own[0]] as FeedItem[]
  assert.deepEqual(takeDedicatedLane('company', own, mixed).map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(takeDedicatedLane(null, own, mixed).map((row) => row.cutId), [9, 1])
  const cuts: CutInfo[] = [
    { id: 1, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'first' } },
    { id: 2, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'next' } },
    { id: 3, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'company', role: 'mains' } },
    { id: 9, clause: null, lanes: [], approved: true, hasHors: true, portalOwn: false, starter: { lane: 'trust', role: 'mains' } },
  ]
  const clips = Object.fromEntries([...own, mixed[0]].map((row) => [String(row.cutId), row]))
  assert.deepEqual(playableLaneClips(clips, cuts, 'company', 'Good company').map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(dedicatedLaneFeed(clips, cuts, { company: 'Good company' }, 'company').map((row) => row.cutId), [1, 2, 3])
  assert.deepEqual(maybeWidenPlaylist(own, mixed, 0, null, true).map((row) => row.cutId), [1, 2, 3])
  assert.ok(sessionPlaylist(own, mixed, 0, null).some((row) => row.cutId === 9))
  assert.match(journey, /takeDedicatedLane/)
  assert.match(journey, /playableLaneClips/)
  assert.doesNotMatch(journey, /\.\.\.own, \.\.\.clips\.filter/)
  assert.match(journey, /data-testid="yt-debug"/)
  assert.match(journey, /Link copied/)
  assert.doesNotMatch(journey, /className="j-chrome" data-swipe/)
  assert.doesNotMatch(journey.slice(journey.indexOf('const openBoard'), journey.indexOf('const visiblePlayer')), /requestExtract|stepUp|swipeTo/)
  assert.match(journey, /data-testid="feed-end"/)
  assert.match(journey, /data-playhead/)
  assert.doesNotMatch(player, /!filmed \|\| !playing/)
  assert.equal(player.includes('skip-back'), false)
  assert.equal(player.includes('skip-forward'), false)
  assert.equal(player.includes('Back 10 s'), false)
  assert.equal(player.includes('Forward 10 s'), false)
  assert.equal(player.includes('gesture-next'), false)
  assert.match(helpFor('course').body.join(' '), /Tap the picture to pause or play/)
  assert.match(player, /data-testid="lecture-speed"/)
  assert.match(player, /nextPlaybackRate/)
  const courseOpen = player.slice(player.indexOf('const openDrawer'), player.indexOf('const closeDrawer'))
  assert.doesNotMatch(courseOpen, /pause|mute|playVideo|silence/)
  assert.match(player, /data-testid="yt-debug"/)
  assert.match(player, /landscapeThumb/)
  assert.equal(player.includes('type="range"'), false)
  const pauseAt = player.indexOf('const pause = () => {')
  const pauseFn = player.slice(pauseAt, player.indexOf('const timer = window.setInterval', pauseAt))
  assert.equal(pauseFn.includes('.mute('), false)
  assert.match(pauseFn, /pauseKeepingSound/)
  assert.match(courseScreen, /className="part-row"/)
  assert.match(courseScreen, /className="part-status"/)
  assert.equal(courseScreen.includes('var(--purple)'), false)
  const css = readFileSync(new URL('../../src/app/(frontend)/app.css', import.meta.url), 'utf8')
  assert.match(css, /\.part-row \{[\s\S]*border-radius: 18px;/)
  assert.match(css, /\.part-status \{[\s\S]*background: #d4a84b;[\s\S]*color: #1a1408;/)
})
