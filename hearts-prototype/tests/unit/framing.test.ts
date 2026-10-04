import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTrack, chooseMode, segmentsFromShots } from '../../src/lib/framing/choose'
import { avoidMidSentenceSwitches, holdModes, snapClipWindow, snapIn, snapOut, snapSwitch } from '../../src/lib/framing/snap'
import { fallbackTrack, validateTrack } from '../../src/lib/framing/validate'
import { sentencesFromWords, wordsFromCues, wrapWordLines } from '../../src/lib/framing/words'
import type { ShotAnalysis } from '../../src/lib/framing/types'
import { framingVariant } from '../../src/lib/experiments'
import sample from '../fixtures/framing-track.json'

const shot = (over: Partial<ShotAnalysis>): ShotAnalysis => ({
  start: 10,
  end: 20,
  faceCountMedian: 1,
  singleFaceRatio: 0.8,
  faceHeight: 0.2,
  focus: { x: 0.3, y: 0.4 },
  textScore: 0,
  twoFar: false,
  speakerCount: 1,
  ...over,
})

test('track validation accepts a contiguous A–F list and refuses gaps, overlaps and short holds', () => {
  const ok = validateTrack(sample)
  assert.equal(ok.length, 0)
  const gap = structuredClone(sample)
  gap.segments[1].start = 18
  assert.ok(validateTrack(gap).some((row) => /gap/.test(row.message)))
  const overlap = structuredClone(sample)
  overlap.segments[1].start = 14
  assert.ok(validateTrack(overlap).some((row) => /overlap/.test(row.message)))
  const short = structuredClone(sample)
  short.segments[0].end = 12
  short.segments[1].start = 12
  assert.ok(validateTrack(short).some((row) => /Hold a mode/.test(row.message)))
  assert.equal(fallbackTrack('abc', 0, 12).segments[0].mode, 'F')
})

test('chooser: B for text, D for one face, F for two people, A only when the centre is safe, F when unsure', () => {
  assert.equal(chooseMode(shot({ textScore: 0.01 })).mode, 'B')
  assert.equal(chooseMode(shot({ speakerCount: 2, twoFar: true, singleFaceRatio: 0.2 })).mode, 'F')
  assert.equal(chooseMode(shot({})).mode, 'D')
  assert.equal(chooseMode(shot({ singleFaceRatio: 0.4, faceHeight: 0.05, faceCountMedian: 1, focus: { x: 0.5, y: 0.4 } })).mode, 'A')
  assert.equal(chooseMode(shot({ singleFaceRatio: 0.1, faceCountMedian: 0, speakerCount: 0, faceHeight: 0, focus: undefined })).mode, 'F')
})

test('clip in and out snap to sentence ends and move off a scene change', () => {
  const sentences = [
    { s: 1005.2, e: 1012.4 },
    { s: 1012.4, e: 1018.1 },
    { s: 1018.1, e: 1028.9 },
  ]
  assert.equal(snapIn(1006, sentences, []), 1005.2)
  assert.equal(snapOut(1027, sentences, []), 1028.9)
  const cut = snapClipWindow(1005, 1029, sentences, [1005.1])
  assert.ok(cut.start >= 1005.1 + 0.3)
  assert.equal(snapSwitch(1014, sentences, 4, 1005.2, 1028.9), 1012.4)
})

test('hold times merge short neighbours and prefer F when the merge is unsure', () => {
  const held = holdModes([
    { start: 0, end: 2, mode: 'D', confidence: 0.8 },
    { start: 2, end: 10, mode: 'B', confidence: 0.3 },
  ])
  assert.equal(held.length, 1)
  assert.equal(held[0].mode, 'F')
  assert.ok(held[0].end - held[0].start >= 4)
  const same = holdModes([
    { start: 0, end: 3, mode: 'D', confidence: 0.8 },
    { start: 3, end: 9, mode: 'D', confidence: 0.7 },
  ])
  assert.equal(same.length, 1)
  assert.equal(same[0].mode, 'D')
})

test('mode switches move to a sentence boundary when both sides still hold', () => {
  const sentences = [
    { s: 0, e: 5 },
    { s: 5, e: 12 },
  ]
  const out = avoidMidSentenceSwitches(
    [
      { start: 0, end: 6.4, mode: 'D', confidence: 0.8 },
      { start: 6.4, end: 12, mode: 'F', confidence: 0.4 },
    ],
    sentences,
  )
  assert.equal(out[0].end, 5)
  assert.equal(out[1].start, 5)
})

test('buildTrack snaps the window, holds modes, and writes a valid track', () => {
  const words = wordsFromCues([
    { start: 16, end: 20, text: 'Also, like the idea of where do you derive your honour from?' },
    { start: 20, end: 24, text: 'Where do you derive your dignity from?' },
    { start: 24, end: 30, text: 'And they seem to be winning as well.' },
  ])
  const sentences = sentencesFromWords(words, 30)
  const track = buildTrack({
    youtubeId: '9gwe-HMwZv0',
    requestedStart: 16.2,
    requestedEnd: 29.4,
    sentences,
    cuts: [22.05],
    shots: [
      shot({ start: 16, end: 22, singleFaceRatio: 0.9, faceHeight: 0.22, focus: { x: 0.22, y: 0.4 } }),
      shot({ start: 22, end: 30, speakerCount: 2, twoFar: true, singleFaceRatio: 0.1, faceCountMedian: 2 }),
    ],
  })
  assert.equal(validateTrack(track).length, 0)
  assert.ok(track.start <= 16.3)
  assert.ok(track.segments.every((row) => row.end - row.start >= 4 - 0.05))
  assert.ok(track.segments.some((row) => row.mode === 'D' || row.mode === 'F'))
  assert.equal(segmentsFromShots([shot({ textScore: 0.02 })]).at(0)?.mode, 'B')
})

test('spoken lines wrap as word arrays so display spaces cannot collapse', () => {
  const lines = wrapWordLines('Uh I was speaking at a masid that had about 500 people in the audience.'.split(' '), 20)
  assert.deepEqual(lines[0], ['Uh', 'I', 'was', 'speaking'])
  assert.ok(lines.every((line) => line.join(' ').length <= 24))
  assert.equal(lines.flat().join(' ').includes('Uh I was speaking'), true)
})

test('the framing-mode experiment stub names both variants', () => {
  assert.equal(framingVariant('ai-director'), 'ai-director')
  assert.equal(framingVariant('split-only'), 'split-only')
  assert.equal(framingVariant('nope'), 'ai-director')
})
