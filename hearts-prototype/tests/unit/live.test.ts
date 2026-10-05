import assert from 'node:assert/strict'
import test from 'node:test'
import { doorSpokenLabel, DOORS } from '../../src/lib/doors'
import {
  canGoLive,
  canSeeLive,
  createMuxLiveStream,
  liveCountsTowardProgress,
  liveDemoGuard,
  LIVE_DEMO_TITLES,
  liveWhenLabel,
  muxConfigured,
  muxNotConfiguredMessage,
  parseLiveSource,
  parseLiveWhen,
  questionProblem,
  questionRateProblem,
  replayTitle,
  viewerCount,
} from '../../src/lib/live'
import { countsTowardProgress } from '../../src/lib/progress'

test('YouTube live and unlisted links parse, and Vimeo live links parse', () => {
  const live = parseLiveSource('https://www.youtube.com/live/jNQXAC9IVRw')
  assert.equal(live.ok, true)
  if (live.ok) {
    assert.equal(live.source, 'youtube')
    assert.equal(live.id, 'jNQXAC9IVRw')
    assert.match(live.embedUrl, /youtube-nocookie.com\/embed\/jNQXAC9IVRw/)
  }
  const watch = parseLiveSource('https://youtu.be/jNQXAC9IVRw')
  assert.equal(watch.ok, true)
  const vimeo = parseLiveSource('https://vimeo.com/76979871', 'vimeo')
  assert.equal(vimeo.ok, true)
  if (vimeo.ok) assert.equal(vimeo.id, '76979871')
  const bad = parseLiveSource('https://example.com/stream')
  assert.equal(bad.ok, false)
})

test('Mux adapter is clearly not configured without keys, and never invents a stream', async () => {
  assert.equal(muxConfigured({}), false)
  const result = await createMuxLiveStream({ MUX_TOKEN_ID: '', MUX_TOKEN_SECRET: '' })
  assert.equal(result.ok, false)
  assert.equal(result.configured, false)
  assert.equal(result.error, muxNotConfiguredMessage())
})

test('questions are short, and rate limited', () => {
  assert.match(questionProblem('hi') || '', /few words/)
  assert.equal(questionProblem('What is ihsan, in one line?'), null)
  assert.match(questionProblem('x'.repeat(241)) || '', /240/)
  assert.match(questionRateProblem(Date.now() - 1000, Date.now()) || '', /Wait/)
  assert.equal(questionRateProblem(Date.now() - 16_000, Date.now(), 2), null)
  assert.match(questionRateProblem(null, Date.now(), 40) || '', /enough questions/)
})

test('only that portal’s members see a session; the master sees all', () => {
  assert.equal(canSeeLive('learner', 4, 4), true)
  assert.equal(canSeeLive('learner', 4, 9), false)
  assert.equal(canSeeLive('teacher', 4, 4), true)
  assert.equal(canSeeLive('master', 1, 9), true)
  assert.equal(canGoLive('teacher', 4, 4), true)
  assert.equal(canGoLive('portal-admin', 4, 4), true)
  assert.equal(canGoLive('learner', 4, 4), false)
  assert.equal(canGoLive('teacher', 4, 9), false)
  assert.equal(canGoLive('master', null, 9), true)
})

test('watching live or the replay does not count unless the talk is attached to a course', () => {
  assert.equal(liveCountsTowardProgress(false), false)
  assert.equal(liveCountsTowardProgress(true), true)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: false, event: 'watch', viaLive: true }), false)
  assert.equal(countsTowardProgress({ level: 'talk', inCourse: true, event: 'watch', viaLive: true }), true)
})

test('demo:live refuses production and any portal that is not hearts-demo', () => {
  assert.match(liveDemoGuard('hearts-demo', { NODE_ENV: 'production' }) || '', /production/)
  assert.match(liveDemoGuard('east-london', { NODE_ENV: 'test' }) || '', /hearts-demo/)
  assert.equal(liveDemoGuard('hearts-demo', { NODE_ENV: 'test' }), null)
})

test('replay titles and viewer windows', () => {
  assert.equal(replayTitle(new Date('2026-10-04T18:00:00.000Z')), 'From the live session on 4 October 2026')
  const now = Date.now()
  assert.equal(viewerCount([now - 10_000, now - 80_000], now), 1)
})

test('schedule times can be now, ISO, or a British date', () => {
  const now = new Date('2026-10-04T12:00:00.000Z')
  assert.equal(parseLiveWhen('now', now)?.toISOString(), now.toISOString())
  assert.ok(parseLiveWhen('04/10/2026 19:30'))
  assert.ok(parseLiveWhen('2026-10-04T19:30'))
  assert.equal(parseLiveWhen('not a time'), null)
})

test('live dates are UK style with a 12-hour clock', () => {
  assert.equal(liveWhenLabel(new Date('2026-10-06T15:42:00.000Z')), 'Tue 6 Oct, 4:42 pm')
})

test('live door labels speak the door number, never the W-code', () => {
  assert.equal(doorSpokenLabel(DOORS[15]), 'Door 16 · Ihsan: Worship as though you see Him')
  assert.equal(LIVE_DEMO_TITLES[0], 'Circle after Isha')
  assert.equal(LIVE_DEMO_TITLES[1], 'Jumuʿah reminders')
  assert.equal(LIVE_DEMO_TITLES[2], 'Friday night tafsir: Surah al-Kahf')
})
