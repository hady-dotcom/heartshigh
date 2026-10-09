import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clipsFromRoute } from '../../src/lib/feed-mix'
import type { FeedItem } from '../../src/server/learner'

function clip(cutId: number, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id: `cut-${cutId}`,
    cutId,
    lane: 'trust',
    laneLabel: 'Trust',
    speaker: 'Suleiman Hani',
    speakerSlug: 'suleiman-hani',
    portrait: null,
    poster: null,
    youtubeId: 'abc',
    courseId: 1,
    courseTitle: 'Quranic Connection',
    lessonId: cutId,
    hors: { start: 0, end: 8, quote: 'A line.' },
    appetiser: { start: 0, end: 20, quote: 'A longer line.' },
    hook: 'Hook',
    turn: 'Turn',
    land: 'Land',
    style: null,
    clause: null,
    films: [],
    parents: { hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' }, appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${cutId}`, parentLevel: 'talk' } },
    ...extra,
  }
}

test('clipsFromRoute uses the routed slots when they resolve', () => {
  const clips = { 40: clip(40), 41: clip(41) }
  const rows = clipsFromRoute([{ cutId: 41, laneKey: 'trust' }], clips, { trust: 'Trust' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].cutId, 41)
  assert.equal(rows[0].laneKey, 'trust')
})

test('clipsFromRoute falls back to every clip when the spine is empty', () => {
  const clips = { 40: clip(40), 41: clip(41) }
  const rows = clipsFromRoute([{ cutId: 14 }], clips)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => row.cutId).sort(), [40, 41])
})
