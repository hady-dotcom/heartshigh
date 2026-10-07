import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverHoldStep, freshCoverHold } from '../../src/lib/yt-cover'

/** YouTube's getCurrentTime: the last reported time plus at most 1 s of guessing while PLAYING. */
function phoneClock(start: number, reportEveryMs: number) {
  return (nowMs: number) => {
    const reportedAt = Math.floor(nowMs / reportEveryMs) * reportEveryMs
    return start + 0.2 + reportedAt / 1000 + Math.min((nowMs - reportedAt) / 1000, 1)
  }
}

function run(reportEveryMs: number, ms = 12000, stall?: { from: number; to: number }) {
  const clock = phoneClock(1298, reportEveryMs)
  let machine = freshCoverHold()
  const rows: Array<{ at: number; cover: boolean }> = []
  let frozenAt = 0
  for (let now = 0; now <= ms; now += 250) {
    let currentTime = clock(now)
    if (stall && now >= stall.from && now < stall.to) currentTime = frozenAt || (frozenAt = currentTime)
    machine = coverHoldStep(machine, { holdKey: '14:hors:14:hors', specKey: '14:hors', hostSpecKey: '14:hors', state: 1, currentTime, start: 1298, now })
    rows.push({ at: now, cover: machine.cover })
  }
  return rows
}

for (const gap of [270, 1000, 1250, 1500, 2000]) {
  test(`the picture shows when the phone reports YouTube's clock every ${gap} ms`, () => {
    const rows = run(gap)
    const liftedAt = rows.find((row) => !row.cover)?.at
    assert.equal(rows.find((row) => row.at === 4250)?.cover, true, 'the 4.5s chrome hold still runs')
    assert.ok(liftedAt != null && liftedAt <= 5000, `cover lifted at ${liftedAt}`)
    assert.equal(rows.slice(rows.findIndex((row) => !row.cover)).every((row) => !row.cover), true, 'stays lifted while playing')
  })
}

test('a real stall of more than 2.5 s still brings the cover back', () => {
  const rows = run(270, 14000, { from: 8000, to: 12000 })
  assert.equal(rows.find((row) => row.at === 7000)?.cover, false)
  assert.equal(rows.find((row) => row.at === 11000)?.cover, true)
})
