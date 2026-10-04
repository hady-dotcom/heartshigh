import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mixFeed } from '../../src/lib/feed-mix'
import { isInterstitial, learnMoreTarget, settleOnLevel, swipeTarget, type FeedLevel, type Swipe } from '../../src/lib/feed-nav'
import type { FeedItem } from '../../src/server/learner'

const BASE = '/p/east-london'
const SWIPES: Swipe[] = ['topic', 'speaker', 'lane', 'next', 'prev']

function talk(cutId: number, lane: string, speaker: string, withFilm: boolean): FeedItem {
  return {
    id: `cut-${cutId}`,
    cutId,
    lane,
    laneLabel: lane,
    speaker,
    speakerSlug: speaker.toLowerCase().replace(/\s+/g, '-'),
    portrait: null,
    poster: null,
    youtubeId: `yt${cutId}`,
    courseId: 100 + cutId,
    courseTitle: `Course ${cutId}`,
    lessonId: 200 + cutId,
    hors: { start: 10, end: 30, quote: 'A line.' },
    appetiser: { start: 0, end: 90, quote: 'A longer line.' },
    hook: 'The hook in the speaker’s words.',
    turn: 'The turn in the speaker’s words.',
    land: 'The land in the speaker’s words.',
    style: null,
    clause: null,
    films: withFilm ? [{ beat: 'hook', style: 'cinema', src: `/typography/yt${cutId}/cinema.mp4`, quote: 'The hook.' }] : [],
    parents: {
      hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' },
      appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${200 + cutId}`, parentLevel: 'talk' },
    },
  }
}

/** A feed as learners get it: talks with typography films, scenic cards and question cards between them. */
function feed() {
  return mixFeed([
    talk(1, 'trust', 'Speaker A', true),
    talk(2, 'trust', 'Speaker B', true),
    talk(3, 'quiet', 'Speaker A', false),
    talk(4, 'company', 'Speaker C', true),
    talk(5, 'quiet', 'Speaker B', false),
  ])
}

test('the mixed feed really carries films, scenic cards and question cards at the hors d’oeuvre level', () => {
  const list = feed()
  const kinds = new Set(list.map((row) => row.card || 'talk'))
  for (const kind of ['talk', 'film', 'scene', 'question']) assert.ok(kinds.has(kind as never), `missing ${kind}`)
  assert.ok(list.filter(isInterstitial).every((row) => list.some((own) => own.cutId === row.cutId && !isInterstitial(own))))
})

test('on hors d’oeuvres, every swipe from every item (talks, films and cards) lands on an hors d’oeuvre-level item', () => {
  const list = feed()
  list.forEach((row, index) => {
    for (const swipe of SWIPES) {
      const target = swipeTarget(list, index, 'hors', swipe)
      if (swipe === 'speaker' && target === null) continue
      assert.notEqual(target, null, `${row.id} ${swipe}`)
      assert.notEqual(target, index, `${row.id} ${swipe} stayed put`)
      if (swipe === 'topic' || swipe === 'speaker' || swipe === 'lane') {
        assert.equal(isInterstitial(list[target!]), false, `${row.id} ${swipe} landed on a card`)
        assert.notEqual(list[target!].cutId, row.cutId, `${row.id} ${swipe} landed on its own piece`)
      }
    }
  })
})

test('the hors d’oeuvre loop steps through films and cards in order, and wraps', () => {
  const list = feed()
  const seen: number[] = []
  let at = 0
  for (let step = 0; step < list.length; step++) {
    seen.push(at)
    at = swipeTarget(list, at, 'hors', 'next')!
  }
  assert.deepEqual(seen, list.map((_, index) => index))
  assert.equal(at, 0)
  assert.equal(swipeTarget(list, 0, 'hors', 'prev'), list.length - 1)
})

test('on appetisers, every swipe lands on another appetiser, never on a film, scene or question card', () => {
  const list = feed()
  const talks = list.map((row, index) => ({ row, index })).filter(({ row }) => !isInterstitial(row))
  for (const { row, index } of talks) {
    for (const swipe of SWIPES) {
      const target = swipeTarget(list, index, 'appetiser', swipe)
      if (swipe === 'speaker' && target === null) continue
      assert.notEqual(target, null, `${row.id} ${swipe}`)
      assert.equal(isInterstitial(list[target!]), false, `${row.id} ${swipe} left the appetiser loop`)
      assert.notEqual(list[target!].cutId, row.cutId)
    }
  }
  const loop: number[] = []
  let at = talks[0].index
  for (let step = 0; step < talks.length; step++) {
    loop.push(list[at].cutId)
    at = swipeTarget(list, at, 'appetiser', 'next')!
  }
  assert.deepEqual(loop, [1, 2, 3, 4, 5])
  assert.equal(list[swipeTarget(list, talks[0].index, 'appetiser', 'prev')!].cutId, 5)
})

test('anything that moves the appetiser feed by index settles on an appetiser in the direction of travel', () => {
  const list = feed()
  list.forEach((row, index) => {
    for (const step of [1, -1] as const) {
      const at = settleOnLevel(list, index, 'appetiser', step)!
      assert.equal(isInterstitial(list[at]), false)
      if (!isInterstitial(row)) assert.equal(at, index)
    }
    assert.equal(settleOnLevel(list, index, 'hors'), index)
  })
})

test('Learn more from an hors d’oeuvre, its film or its card opens that same piece’s own appetiser', () => {
  const list = feed()
  list.forEach((row, index) => {
    const step = learnMoreTarget(list, index, 'hors', BASE)
    assert.ok(step && step.level === 'appetiser', row.id)
    assert.equal(step.cutId, row.cutId)
    assert.equal(list[step.index].cutId, row.cutId)
    assert.equal(isInterstitial(list[step.index]), false)
    if (!isInterstitial(row)) assert.equal(step.index, index)
  })
})

test('Learn more from an appetiser opens its own full talk from the start, and nothing else', () => {
  const list = feed()
  list.forEach((row, index) => {
    if (isInterstitial(row)) return
    const step = learnMoreTarget(list, index, 'appetiser', BASE)
    assert.ok(step && step.level === 'talk', row.id)
    assert.equal(step.lessonId, row.lessonId)
    assert.equal(step.href, `${BASE}/course/${row.courseId}?part=${row.lessonId}&t=0`)
  })
})

test('Learn more refuses to go anywhere but the next level down', () => {
  const list = feed()
  const odd = list.map((row) => ({ ...row, parents: { hors: { ...row.parents.hors, parentLevel: 'talk' as const }, appetiser: { ...row.parents.appetiser, parentLevel: 'appetiser' as const } } }))
  for (const level of ['hors', 'appetiser'] as FeedLevel[]) assert.equal(learnMoreTarget(odd, 0, level, BASE), null)
  assert.equal(learnMoreTarget([], 0, 'hors', BASE), null)
})
