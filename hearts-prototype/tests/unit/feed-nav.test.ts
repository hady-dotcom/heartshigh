import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mixFeed, sessionPlaylist } from '../../src/lib/feed-mix'
import { appendUnseenItems, cardKey, catalogueRemainder, isInterstitial, learnMoreTarget, settleOnLevel, swipeTarget, type FeedLevel, type Swipe } from '../../src/lib/feed-nav'
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

/** A feed as learners get it: talks with typography films and scenic cards between them. */
function feed() {
  return mixFeed([
    talk(1, 'trust', 'Speaker A', true),
    talk(2, 'trust', 'Speaker B', true),
    talk(3, 'quiet', 'Speaker A', false),
    talk(4, 'company', 'Speaker C', true),
    talk(5, 'quiet', 'Speaker B', false),
  ])
}

test('the mixed feed really carries films and scenic cards at the clip level, and never a question card', () => {
  const list = feed()
  const kinds = new Set(list.map((row) => row.card || 'talk'))
  for (const kind of ['talk', 'film', 'scene']) assert.ok(kinds.has(kind as never), `missing ${kind}`)
  assert.equal(kinds.has('question'), false)
  assert.ok(list.every((row) => row.card !== 'question' && row.prompt !== 'What stays with you from this?'))
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

test('the hors d’oeuvre loop steps through films and cards in order, and stops when they are all seen', () => {
  const list = feed()
  const visited: number[] = []
  const seen = new Set<string>()
  let at = 0
  for (let step = 0; step < list.length + 2; step++) {
    visited.push(at)
    seen.add(cardKey(list[at], 'hors'))
    const next = swipeTarget(list, at, 'hors', 'next', seen)
    if (next == null) break
    at = next
  }
  assert.deepEqual(visited, list.map((_, index) => index))
  assert.equal(swipeTarget(list, at, 'hors', 'next', seen), null)
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

test('every clip steps up to its own speaker and lesson, never a neighbour’s', () => {
  const list = feed()
  list.forEach((row, index) => {
    const step = learnMoreTarget(list, index, 'hors', BASE)
    assert.ok(step && step.level === 'appetiser')
    const own = list[step.index]
    assert.equal(own.speaker, row.speaker)
    assert.equal(own.lessonId, row.lessonId)
    assert.equal(own.cutId, row.cutId)
  })
})

test('next skips a seen card until the pool is used up, then it stops', () => {
  const list = feed()
  const firstTalk = list.findIndex((row) => !isInterstitial(row))
  let lastOfFirst = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].cutId === list[firstTalk].cutId) {
      lastOfFirst = i
      break
    }
  }
  const seen = new Set([cardKey(list[firstTalk], 'hors')])
  const afterTalk = swipeTarget(list, firstTalk, 'hors', 'next', seen)!
  assert.equal(list[afterTalk].cutId, list[firstTalk].cutId)
  assert.notEqual(list[afterTalk].card || 'talk', 'talk')
  const nextTalk = swipeTarget(list, lastOfFirst, 'hors', 'next', seen)!
  assert.notEqual(list[nextTalk].cutId, list[firstTalk].cutId)
  const all = new Set(list.map((row) => cardKey(row, 'hors')))
  assert.equal(swipeTarget(list, lastOfFirst, 'hors', 'next', all), null)
})

test('a talk seen as a clip can still open as a 3-minute version', () => {
  const list = feed()
  const talks = list.map((row, index) => ({ row, index })).filter(({ row }) => !isInterstitial(row))
  const horsSeen = new Set(list.map((row) => cardKey(row, 'hors')))
  assert.equal(swipeTarget(list, talks[0].index, 'hors', 'next', horsSeen), null)
  const next = swipeTarget(list, talks[0].index, 'appetiser', 'next', horsSeen)
  assert.equal(list[next!].cutId, talks[1].row.cutId)
})

test('a two-clip batch is not the end of the library: speaker, topic and lane still reach real catalogue talks', () => {
  const loaded = mixFeed([talk(1, 'trust', 'McCarl Smith', false), talk(2, 'trust', 'Ada Yusuf', false)])
  const catalogue = [talk(1, 'trust', 'McCarl Smith', false), talk(2, 'trust', 'Ada Yusuf', false), talk(3, 'quiet', 'McCarl Smith', false), talk(4, 'company', 'Speaker C', false), talk(5, 'trust', 'McCarl Smith', false)]
  const more = catalogueRemainder(loaded, catalogue)
  assert.deepEqual(more.map((row) => row.cutId), [3, 4, 5])
  const list = [...loaded, ...more]
  const seen = new Set(loaded.map((row) => cardKey(row, 'hors')))
  const first = list.findIndex((row) => row.cutId === 1 && !isInterstitial(row))
  const speaker = swipeTarget(list, first, 'hors', 'speaker', seen)
  assert.equal(list[speaker!].speaker, 'McCarl Smith')
  assert.notEqual(list[speaker!].cutId, 1)
  const lane = swipeTarget(list, first, 'hors', 'lane', seen)
  assert.notEqual(list[lane!].lane, list[first].lane)
  const topic = swipeTarget(list, first, 'hors', 'topic', seen)
  assert.notEqual(topic, null)
  assert.notEqual(list[topic!].cutId, list[first].cutId)
  assert.equal(catalogueRemainder(list, catalogue).length, 0)
})

test('a two-clip route grows into the whole catalogue: dozens of real talks, and swipes do not die', () => {
  const catalogue = Array.from({ length: 48 }, (_, index) => {
    const cutId = index + 1
    const lane = cutId % 3 === 0 ? 'trust' : cutId % 3 === 1 ? 'quiet' : 'company'
    const speaker = cutId % 5 === 0 || cutId === 1 ? 'McCarl Smith' : `Speaker ${cutId % 7}`
    return talk(cutId, lane, speaker, false)
  })
  const routed = catalogue.slice(0, 2)
  const list = sessionPlaylist(routed, catalogue)
  const talks = list.filter((row) => !isInterstitial(row))
  assert.equal(talks.length, 48, 'the session keeps every catalogue talk')
  assert.deepEqual(talks.slice(0, 2).map((row) => row.cutId), [1, 2], 'the routed handful still leads')
  assert.equal(new Set(talks.map((row) => row.cutId)).size, 48)
  const seen = new Set<string>()
  let at = list.findIndex((row) => row.cutId === 1 && !isInterstitial(row))
  for (let step = 0; step < 40; step++) {
    seen.add(cardKey(list[at], 'hors'))
    const target = swipeTarget(list, at, 'hors', 'next', seen)
    assert.notEqual(target, null, `next died after ${step} cards`)
    at = target!
  }
  const seenTwo = new Set([cardKey(catalogue[0], 'hors'), cardKey(catalogue[1], 'hors')])
  const fromFirst = list.findIndex((row) => row.cutId === 1 && !isInterstitial(row))
  for (const swipe of ['speaker', 'topic', 'lane'] as const) {
    const target = swipeTarget(list, fromFirst, 'hors', swipe, seenTwo)
    assert.notEqual(target, null, `${swipe} died after two clips`)
    assert.notEqual(list[target!].cutId, 1)
  }
  const speaker = swipeTarget(list, fromFirst, 'hors', 'speaker', seenTwo)
  assert.equal(list[speaker!].speaker, 'McCarl Smith')
  assert.equal(catalogueRemainder(list, catalogue).length, 0)
})

test('a refill does not append a second talk or scene for a cut already in the mix', () => {
  const first = feed()
  const again = mixFeed([talk(1, 'trust', 'Speaker A', true), talk(2, 'trust', 'Speaker B', true)], 0)
  const merged = appendUnseenItems(first, again)
  assert.equal(merged.filter((row) => row.cutId === 1 && (row.card || 'talk') === 'talk').length, 1)
  assert.equal(merged.filter((row) => row.cutId === 1 && row.card === 'film').length, 1)
  assert.equal(merged.length, first.length)
})
