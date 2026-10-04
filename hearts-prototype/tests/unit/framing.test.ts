import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTrack, chooseMode, segmentsFromShots } from '../../src/lib/framing/choose'
import { avoidMidSentenceSwitches, holdModes, snapClipWindow, snapIn, snapOut, snapSwitch } from '../../src/lib/framing/snap'
import { fallbackTrack, validateTrack } from '../../src/lib/framing/validate'
import { currentSentence, sameSpokenText, sentencesFromWords, sentencesInWindow, spokenLine, wordsFromCues, wrapWordLines } from '../../src/lib/framing/words'
import { boxOnStage, coverPosition, coverSourceToBox, cssVars, filmOnStage, layoutFor } from '../../src/lib/framing/layout'
import { PLACEHOLDER_FACE, PLACEHOLDER_FACE_FOCUS } from '../../src/lib/framing/placeholder'
import type { ShotAnalysis } from '../../src/lib/framing/types'
import { framingVariant } from '../../src/lib/experiments'
import sample from '../fixtures/framing-track.json'
import switching from '../fixtures/framing-switch.json'

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

test('letterbox and split film stay inside the 390×844 stage', () => {
  for (const mode of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
    const layout = layoutFor(mode, 390, 844, undefined, { x: 0.22, y: 0.4 })
    assert.equal(filmOnStage(layout, 390, 844), true, mode)
    assert.ok(layout.film.left >= 0, mode)
    assert.ok(layout.film.left + layout.film.width <= 390.01, mode)
  }
  const letter = layoutFor('B', 390, 844)
  assert.equal(letter.film.left, 0)
  assert.equal(letter.film.width, 390)
  const split = layoutFor('F', 390, 844)
  assert.equal(split.film.left, 0)
  assert.equal(split.film.width, 390)
  assert.equal(split.film.top, letter.film.top)
})

test('D cover crop keeps the placeholder FACE box on the 390×844 stage', () => {
  const layout = layoutFor('D', 390, 844, PLACEHOLDER_FACE, PLACEHOLDER_FACE_FOCUS)
  const vars = cssVars(layout)
  const rawFocus = `${Math.round(PLACEHOLDER_FACE_FOCUS.x * 1000) / 10}%`
  assert.notEqual(vars['--fr-focus-x'], rawFocus)
  const face = coverSourceToBox(PLACEHOLDER_FACE, 390, 844, { x: layout.objectX, y: layout.objectY })
  assert.equal(boxOnStage(face, 390, 844), true)
  assert.ok(face.x > 4, 'face should not sit on the left edge')
  const misplaced = coverSourceToBox(PLACEHOLDER_FACE, 390, 844, coverPosition({ x: 0.18, y: 0.42 }, 390, 844))
  assert.equal(boxOnStage(misplaced, 390, 844), true)
  const oldPin = coverSourceToBox(PLACEHOLDER_FACE, 390, 844, { x: 0.18, y: 0.42 })
  assert.equal(boxOnStage(oldPin, 390, 844), false)
})

test('word clocks stay inside each caption cue instead of a clip-wide estimate', () => {
  const words = wordsFromCues([
    { start: 10, end: 12, text: 'one two' },
    { start: 20, end: 22, text: 'three four' },
  ])
  assert.equal(words[0].t, 10)
  assert.ok(words[1].e <= 12.01)
  assert.equal(words[2].t, 20)
  assert.ok(words[3].e <= 22.01)
})

test('F text is the timed transcript now, never a talk title, and nothing in a gap', () => {
  const title = 'How to Live Like the Prophet'
  const sentences = switching.sentences
  assert.equal(spokenLine(sentences, 17)?.text, 'And they seem to be winning as well.')
  assert.equal(spokenLine(sentences, 18.45), null)
  assert.equal(spokenLine(sentences, 19.8)?.text, 'They seem to be overcoming you.')
  assert.equal(spokenLine(sentences, 22)?.text, 'Your dignity still stands.')
  for (const time of [17, 19.8, 22]) {
    const line = spokenLine(sentences, time)
    assert.ok(line)
    assert.equal(sameSpokenText(line.text, title), false)
  }
  assert.equal(spokenLine(sentences, 15.9, { from: 16, to: 24 }), null)
})

test('spoken words ignore the sentence that ended at the clip in-point', () => {
  const sentences = sentencesFromWords(
    wordsFromCues([
      { start: 302, end: 307.25, text: 'And it still is okay to say that you might not know what other people go through.' },
      { start: 307.25, end: 312.2, text: 'Uh I was speaking at a masid that had about 500 people in the audience.' },
    ]),
    332,
  )
  const live = sentencesInWindow(sentences, 307.25, 332)
  assert.ok(live.every((row) => row.e > 307.3))
  assert.equal(currentSentence(live, 307.0), null)
  assert.ok(currentSentence(live, 308)?.text.includes('speaking'))
})

test('spoken lines wrap as word arrays so display spaces cannot collapse', () => {
  const lines = wrapWordLines('Uh I was speaking at a masid that had about 500 people in the audience.'.split(' '), 20)
  assert.deepEqual(lines[0], ['Uh', 'I', 'was', 'speaking', 'at'])
  assert.ok(lines.every((line) => line.join(' ').length <= 20))
  assert.equal(lines.flat().join(' '), 'Uh I was speaking at a masid that had about 500 people in the audience.')
})

test('the framing-mode experiment stub names both variants', () => {
  assert.equal(framingVariant('ai-director'), 'ai-director')
  assert.equal(framingVariant('split-only'), 'split-only')
  assert.equal(framingVariant('nope'), 'ai-director')
})
