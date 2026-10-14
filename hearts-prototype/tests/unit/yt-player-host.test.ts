import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { learnerEmbedSrc, PLAYER_HOST, playWithSoundFallback, playerVars } from '../../src/lib/yt'

test('the learner player is created on www.youtube.com with origin and widget_referrer', () => {
  const src = readFileSync(new URL('../../src/lib/yt.ts', import.meta.url), 'utf8')
  assert.equal(PLAYER_HOST, 'https://www.youtube.com')
  assert.match(src, /host: PLAYER_HOST/)
  assert.doesNotMatch(src, /host: NOCOOKIE/)
  assert.doesNotMatch(src, /youtube-nocookie\.com/)
  assert.match(learnerEmbedSrc('abcDEF12345'), /^https:\/\/www\.youtube\.com\/embed\/abcDEF12345\?/)
  const vars = playerVars('hors', 0) as Record<string, unknown>
  assert.equal(vars.enablejsapi, 1)
  assert.equal('origin' in vars, true)
  assert.equal('widget_referrer' in vars, true)
})

test('a desk preview keeps the same embed address on the server and in the browser', () => {
  const extra = { start: 2, autoplay: 1, controls: 1, playsinline: 1, rel: 0, skipOrigin: 1 as const }
  const src = learnerEmbedSrc('ccccccccccc', extra)
  assert.equal(src.includes('skipOrigin'), false)
  assert.equal(src.includes('origin='), false)
  assert.match(src, /[?&]start=2(?:&|$)/)
  const previous = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: { location: { origin: string } } }).window = { location: { origin: 'http://127.0.0.1:3100' } }
  try {
    assert.equal(learnerEmbedSrc('ccccccccccc', extra), src)
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = previous
  }
})

test('playWithSoundFallback mutes, plays, then unmutes when sound is wanted', () => {
  const calls: string[] = []
  let muted = true
  const player = {
    mute() { muted = true; calls.push('mute') },
    unMute() { muted = false; calls.push('unMute') },
    playVideo() { calls.push('play') },
    isMuted() { return muted },
  }
  const silent = playWithSoundFallback(player, false)
  assert.deepEqual(calls, ['mute', 'play'])
  assert.equal(silent.muted, true)
  calls.length = 0
  const heard = playWithSoundFallback(player, true)
  assert.deepEqual(calls, ['mute', 'play', 'unMute'])
  assert.equal(heard.muted, false)
})
