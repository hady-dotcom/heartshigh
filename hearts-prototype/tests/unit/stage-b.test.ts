import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sortParts } from '../../src/lib/part-order'
import { placeDots } from '../../src/lib/timeline-dots'
import { continueOrder, minutesADay, tonightLabel, tonightSlot } from '../../src/lib/study-plan'
import { answersForPoint, circleFillProblems, starterAnswers } from '../../src/lib/circle-fill'
import { FILMS } from '../../src/seed/films'
import { burnedCandidate, heavyLowerThird, KNOWN_BURNED_IDS } from '../../src/lib/burned'
import { feedTidy } from '../../src/lib/tidy-caption'
import { youtubeOembedUrl } from '../../src/lib/youtube'
import { installHidden, INSTALL_HIDE_MS } from '../../src/lib/install-prompt'
import { playerVars } from '../../src/lib/yt'

test('course parts follow the order field, not the unit they sit in', () => {
  const orders = [2, 3, 1, 5, 6, 8, 4, 7]
  const lessons = orders.map((order, index) => ({ id: index + 1, order, unit: index % 2 }))
  assert.deepEqual(
    sortParts(lessons, (row) => row.unit).map((row) => row.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  )
})

test('timeline dots that sit about 10px apart keep separate tap targets', () => {
  const width = 300
  const placed = placeDots(
    [
      { id: 1, second: 10 },
      { id: 2, second: 10.4 },
    ],
    100,
    width,
  )
  const gap = Math.abs(placed[1].left - placed[0].left) / 100 * width
  assert.ok(gap >= 44, `gap was ${gap}`)
  assert.ok(placed.some((dot) => dot.lift !== 0))
})

test('Home Continue follows the last watch, then a visit that was never watched', () => {
  const done = new Set<number>([9])
  assert.deepEqual(continueOrder([4, 1, 4], [2, 1, 8], done), [4, 1, 2])
})

test('a study plan names tonight from the next open part', () => {
  const slot = tonightSlot(
    [
      { date: '2026-10-01', lessonId: 1 },
      { date: '2026-10-04', lessonId: 3 },
      { date: '2026-10-06', lessonId: 5 },
    ],
    '2026-10-04',
    new Set([1]),
  )
  assert.equal(slot?.lessonId, 3)
  assert.equal(tonightLabel(3, 20), 'Tonight: Part 3, 20 min')
  assert.equal(minutesADay(20), 20)
  assert.equal(minutesADay(15), null)
})

test('starter questions have four to six answers in a real voice', () => {
  for (const film of FILMS) {
    for (const point of film.points) {
      const drafts = answersForPoint({ prompt: point.prompt, kind: point.kind, options: point.options })
      assert.equal(starterAnswers({ prompt: point.prompt, kind: point.kind })?.length, drafts.length)
      assert.deepEqual(circleFillProblems(drafts), [], point.prompt)
    }
  }
})

test('the feed shows the stored tidy line, including when the raw caption no longer matches', () => {
  const tidy = 'He is paraphrasing. The Prophet, peace be upon him, said it kindly.'
  assert.equal(feedTidy("I'm paraphrasing he says the prophet said it kindly", { raw: 'other raw', text: tidy }, { text: tidy }), tidy)
  assert.equal(feedTidy('a raw line', null, null).length > 0, true)
})

test('Shorts are sized from the shorts link, and burned captions include lesson 31', () => {
  assert.match(decodeURIComponent(youtubeOembedUrl('MK5q_zMiX1g', 'short')), /\/shorts\/MK5q_zMiX1g/)
  assert.match(decodeURIComponent(youtubeOembedUrl('ECaTWkof57E')), /watch\?v=ECaTWkof57E/)
  assert.ok((KNOWN_BURNED_IDS as readonly string[]).includes('MK5q_zMiX1g'))
  assert.equal(burnedCandidate('MK5q_zMiX1g', false), true)
  const flat = new Uint8Array(80 * 40)
  assert.equal(heavyLowerThird(flat, 80, 40), false)
  const busy = new Uint8Array(80 * 40)
  for (let y = 30; y < 40; y += 1) {
    for (let x = 0; x < 80; x += 1) busy[y * 80 + x] = x % 2 === 0 ? 20 : 220
  }
  assert.equal(heavyLowerThird(busy, 80, 40), true)
})

test('a dismissed install sheet stays hidden for 30 days, then can return', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z')
  assert.equal(installHidden(String(now + INSTALL_HIDE_MS), now + 1000), true)
  assert.equal(installHidden(String(now - 1000), now), false)
  assert.equal(installHidden('1', now), true)
  assert.equal(installHidden(null, now), false)
})

test('the course player is chromeless, the same as the feed', () => {
  const vars = playerVars('full', 12) as Record<string, unknown>
  assert.equal(vars.controls, 0)
  assert.equal(vars.fs, 0)
  assert.equal(vars.cc_load_policy, 0)
  assert.equal('cc_lang_pref' in vars, false)
})
