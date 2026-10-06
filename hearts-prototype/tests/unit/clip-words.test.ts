import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clipSentences, clipWordsTrack, PAGE_LINES, shownCoverage, type WorkFile } from '../../src/lib/framing/clip-words'
import { trackForClip } from '../../src/lib/framing/store'
import { validateTrack } from '../../src/lib/framing/validate'
import { HOLD_GAP, spokenLine, wrapWordLines } from '../../src/lib/framing/words'
import live from '../fixtures/live-clips.json'

type Clip = { cutId: number; youtubeId: string; start: number; end: number; before: string }
const clips = live.clips as Clip[]

/** The 25 live clips whose F panel was blank: their tier caption lines were timed for another part of the talk. */
const WAS_BLANK = [1, 14, 27, 42, 43, 44, 45, 46, 47, 48, 50, 51, 53, 54, 55, 56, 57, 58, 59, 60, 62, 64, 65, 66, 67]
/**
 * Clips whose window holds long stretches with no caption words at all (Arabic recitation, laughter or silence). F
 * shows nothing there once a line's 1.5 s hold runs out, so less of the clip has words; every captioned word is shown.
 */
const CAPTION_SILENCE = new Map([
  [64, 'HZgblQ00z1U: pauses of 2.6 s and 6.2 s'],
  [74, 'GeiEP_IfXiA: 4.8 s and 3.8 s with no caption words'],
  [120, 'n72kGaJ2BPA: laughter and pauses of 5.3 s, 7 s and 4.4 s'],
  [158, 'f36YaxY8HlE: 5.5 s and 3.1 s with no caption words'],
  [166, '1suEmWBqlKE: 19 s of recitation with no caption words'],
])

test('the live clip list is the 138 feed clips, with the 25 that were blank', () => {
  assert.equal(clips.length, 138)
  assert.equal(new Set(clips.map((row) => row.cutId)).size, 138)
  assert.deepEqual(clips.filter((row) => row.before === 'none').map((row) => row.cutId), WAS_BLANK)
  assert.equal(clips.filter((row) => row.before === 'partial').length, 12)
})

test('every live clip resolves to a valid F track of timed words, showing words for at least 80% of its window', () => {
  for (const clip of clips) {
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)
    assert.ok(track?.sentences?.length, `cut ${clip.cutId} has no words`)
    assert.deepEqual(validateTrack(track), [], `cut ${clip.cutId}`)
    assert.equal(track.start, clip.start)
    assert.equal(track.end, clip.end)
    assert.ok(track.segments.every((row) => row.mode === 'F'))
    const cover = shownCoverage(track.sentences, clip.start, clip.end)
    if (CAPTION_SILENCE.has(clip.cutId)) assert.ok(cover >= 0.6, `cut ${clip.cutId} ${cover}`)
    else assert.ok(cover >= 0.8, `cut ${clip.cutId} covers only ${Math.round(cover * 100)}%`)
  }
  const full = clips.filter((clip) => shownCoverage(trackForClip(clip.youtubeId, clip.start, clip.end, null)?.sentences, clip.start, clip.end) >= 0.8)
  assert.equal(full.length, 133)
})

test('the 25 clips that were blank now resolve to words', () => {
  for (const id of WAS_BLANK) {
    const clip = clips.find((row) => row.cutId === id)!
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)
    assert.ok((track?.sentences?.length || 0) > 0, `cut ${id}`)
    assert.ok(shownCoverage(track?.sentences, clip.start, clip.end) >= 0.7, `cut ${id}`)
  }
})

test('words run forward in time, inside the window, and each page fits the panel whole', () => {
  for (const clip of clips) {
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)!
    let last = -Infinity
    let lastPage = -Infinity
    for (const page of track.sentences!) {
      assert.ok(page.s > lastPage, `cut ${clip.cutId}: pages out of order at ${page.s}`)
      assert.ok(page.e > page.s && page.e <= clip.end + 1e-6, `cut ${clip.cutId}: page ${page.s}-${page.e}`)
      assert.equal(page.s, page.words[0].t)
      assert.equal(page.text, page.words.map((row) => row.w).join(' '))
      assert.ok(wrapWordLines(page.words.map((row) => row.w), 20).length <= PAGE_LINES, `cut ${clip.cutId}: "${page.text}" is too long for the panel`)
      for (const word of page.words) {
        assert.ok(word.t > last, `cut ${clip.cutId}: ${word.w} at ${word.t} is not after ${last}`)
        assert.ok(word.t >= clip.start && word.t < clip.end, `cut ${clip.cutId}: ${word.w} at ${word.t} is outside ${clip.start}-${clip.end}`)
        assert.doesNotMatch(word.w, /^\[|>>|["“”]/, `cut ${clip.cutId}: ${word.w}`)
        last = word.t
      }
      lastPage = page.s
    }
  }
})

const work = (rows: [string, number, number][], disp?: string[]): WorkFile => ({ words: rows, disp: disp || rows.map((row) => row[0]) })

test('a clip keeps whole words only, trims a sentence tail caught at the in-point, and never rewords', () => {
  const file = work(
    [
      ['and', 8.6, 9.0], ['then', 9.0, 9.4], ['you', 9.95, 10.2], ['know', 10.2, 10.5],
      ['the', 11, 11.2], ['prophet', 11.2, 11.7], ['said', 11.7, 12.1], ['be', 12.1, 12.3], ['kind', 12.3, 12.8],
      ['[laughter]', 13, 14], ['and', 14.2, 14.4], ['he', 14.4, 14.6], ['smiled', 14.6, 15.2],
      ['every', 19.8, 20.1], ['time', 20.1, 20.6],
    ],
    ['and', 'then', 'you', 'know.', 'The', 'Prophet', 'said,', '"be', 'kind."', '[laughter]', 'And', 'he', 'smiled.', 'Every', 'time'],
  )
  const sentences = clipSentences(file, { youtubeId: 'x', start: 10, end: 20 })!
  assert.deepEqual(sentences.map((row) => row.text), ['The Prophet said, be kind.', 'And he smiled.'])
  assert.equal(sentences[0].s, 11)
  assert.ok(sentences.every((row) => row.words.every((word) => word.t >= 10 && word.t < 20)))
})

test('words that share one caption clock are spread forward, and a word cut by the out-point is left out', () => {
  const file = work(
    [['So', 30, 30.1], ['what', 30, 30.1], ['do', 30, 30.1], ['we', 30, 30.1], ['do', 30.9, 31.2], ['now', 31.2, 31.9], ['then', 31.95, 32.6]],
    ['So', 'what', 'do', 'we', 'do', 'now?', 'Then'],
  )
  const track = clipWordsTrack(file, { youtubeId: 'y', start: 30, end: 32 })!
  const words = track.sentences!.flatMap((row) => row.words)
  assert.deepEqual(words.map((row) => row.w), ['So', 'what', 'do', 'we', 'do', 'now?'])
  for (let index = 1; index < words.length; index++) assert.ok(words[index].t - words[index - 1].t >= 0.14)
  assert.equal(clipWordsTrack(work([['hi', 5, 5.3]]), { youtubeId: 'z', start: 10, end: 20 }), null)
})

test('F shows a line through a breath but nothing through a long silence, and nothing early', () => {
  const page = (text: string, s: number, e: number) => ({ text, s, e, words: text.split(' ').map((w, at) => ({ w, t: s + at * 0.3 })) })
  const sentences = [page('First line here.', 10, 12), page('Second line here.', 18, 20)]
  assert.equal(spokenLine(sentences, 11, { from: 9, to: 21 })?.text, 'First line here.')
  assert.equal(spokenLine(sentences, 12 + HOLD_GAP - 0.1, { from: 9, to: 21 })?.text, 'First line here.')
  assert.equal(spokenLine(sentences, 15, { from: 9, to: 21 }), null)
  assert.equal(spokenLine(sentences, 9.2, { from: 9, to: 21 })?.text, 'First line here.')
  assert.equal(spokenLine([page('Late start.', 15, 17)], 10, { from: 10, to: 20 }), null)
})

test('a clip word track wins over a nearby seed track for the same talk', () => {
  // 9gwe-HMwZv0 ships a seed track at 1005.2-1028.9; the live clip is 1041-1073 and must get its own words.
  const track = trackForClip('9gwe-HMwZv0', 1041, 1073, null)
  assert.equal(track?.start, 1041)
  assert.ok(track?.sentences?.length)
})

test('a clip whose window has moved does not borrow another window\'s words; it keeps its own caption lines', () => {
  // UGuKJLZnbi8's live clip is 289-311. A re-cut 301-321 shares only half of it.
  assert.equal(trackForClip('UGuKJLZnbi8', 301, 321, null), null)
  assert.ok(trackForClip('UGuKJLZnbi8', 289, 311, null)?.sentences?.length)
  assert.ok(trackForClip('UGuKJLZnbi8', 289.5, 311, null)?.sentences?.length)
})

test('a long pause mid-sentence ends the page, and the panel goes blank once the 1.5 s hold runs out', () => {
  const said = 'The Prophet said as part of this du\'a, O Allah, in other words, make the Qur\'an central.'.split(' ')
  const work: WorkFile = {
    words: said.map((w, at) => {
      const t = at < 7 ? 7.4 + at * 0.3 : 17.35 + (at - 7) * 0.3
      return [w.toLowerCase(), t, at === 6 ? t + 1.2 : t + 0.3]
    }),
    disp: said,
  }
  const clip = { youtubeId: 'x', start: 7, end: 22 }
  const pages = clipSentences(work, clip)!
  assert.equal(pages[0].text, 'The Prophet said as part of this')
  assert.ok(pages[0].e <= 7.4 + 6 * 0.3 + 1.2 + 0.21, `${pages[0].e}`)
  assert.equal(pages[1].s, 17.35)
  const at = (time: number) => spokenLine(pages, time, { from: clip.start, to: clip.end })?.text ?? null
  assert.equal(at(9), 'The Prophet said as part of this')
  assert.equal(at(pages[0].e + HOLD_GAP - 0.1), 'The Prophet said as part of this')
  assert.equal(at(pages[0].e + HOLD_GAP + 0.1), null)
  assert.equal(at(16), null)
  assert.ok(at(17.5)?.startsWith("du'a, O Allah"))
})

test('live clip 40 goes blank during the recited du\'a instead of holding its first line', () => {
  const track = trackForClip('FAxIZIqwfd8', 7, 48, null)!
  const at = (time: number) => spokenLine(track.sentences!, time, { from: 7, to: 48 })?.text ?? null
  assert.ok(at(9)?.startsWith('The Prophet, sallallahu alayhi wa sallam, said, as part of this'))
  assert.equal(at(14), null)
  assert.ok(at(17.6)?.startsWith("du'a, O Allah"))
})

test('a long sentence does not leave one or two words alone on its last page', () => {
  for (const clip of clips) {
    const track = trackForClip(clip.youtubeId, clip.start, clip.end, null)!
    track.sentences!.forEach((page, index) => {
      const before = track.sentences![index - 1]
      // The last page of a sentence that ran straight on from the page before (not split at a pause).
      if (before && !/[.?!]["”’')\]]*$/.test(before.text) && /[.?!]["”’')\]]*$/.test(page.text) && before.e >= page.s - 0.01) {
        assert.ok(page.words!.length >= 3 || page.e - page.s > 1.5, `cut ${clip.cutId}: "${before.text}" / "${page.text}"`)
      }
    })
  }
  const track = trackForClip('ECaTWkof57E', 1298, 1330, null)!
  assert.ok(!track.sentences!.some((row) => row.text === 'everything.'))
})
