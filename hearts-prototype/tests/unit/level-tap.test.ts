import assert from 'node:assert/strict'
import { test } from 'node:test'
import { levelAfterTaps, type LevelTap } from '../../src/lib/level-tap'
import { pauseKeepingSound } from '../../src/lib/yt'

test('the first of 23 mashed extract taps switches once and the duplicates do not cancel it', () => {
  const taps: LevelTap[] = Array.from({ length: 23 }, (_, index) => ({ intent: 'appetiser', at: index * 16 }))
  const result = levelAfterTaps('hors', taps)
  assert.equal(result.level, 'appetiser')
  assert.equal(result.accepted.length, 1)
  assert.equal(result.accepted[0].at, 0)
})

test('Clip, extract and Full talk each take on the first press, including a pointerup plus click', () => {
  const taps: LevelTap[] = [
    { intent: 'appetiser', at: 0 },
    { intent: 'appetiser', at: 12 },
    { intent: 'hors', at: 400 },
    { intent: 'hors', at: 410 },
    { intent: 'talk', at: 800 },
    { intent: 'talk', at: 808 },
  ]
  const result = levelAfterTaps('hors', taps)
  assert.deepEqual(result.accepted.map((tap) => tap.intent), ['appetiser', 'hors', 'talk'])
  assert.equal(result.level, 'talk')
})

test('alternating Clip and extract twenty times lands on the last press', () => {
  const taps: LevelTap[] = []
  for (let index = 0; index < 20; index++) {
    const at = index * 400
    const intent = index % 2 === 0 ? 'appetiser' : 'hors'
    taps.push({ intent, at }, { intent, at: at + 10 })
  }
  const result = levelAfterTaps('hors', taps)
  assert.equal(result.accepted.length, 20)
  assert.equal(result.level, 'hors')
})

test('pause leaves the player unmuted when it had sound, and never calls mute', () => {
  const calls: string[] = []
  let muted = false
  const player = {
    pauseVideo() {
      calls.push('pause')
      muted = true
    },
    mute() {
      calls.push('mute')
      muted = true
    },
    unMute() {
      calls.push('unmute')
      muted = false
    },
    isMuted() {
      return muted
    },
  }
  const snap = pauseKeepingSound(player, true)
  assert.deepEqual(calls, ['pause', 'unmute'])
  assert.equal(snap.hadSound, true)
  assert.equal(snap.mutedBefore, false)
  assert.equal(snap.mutedAfter, false)
  assert.equal(player.isMuted(), false)
})
