import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { captionPage, draftTiers, saidInTalk, sentencesOf, wordsOf } from '../../src/lib/tiers'
import { restoreSpokenTail } from '../../../remotion/src/emphasis'
import { BREATH, cardAt, isVerbatim, scheduleTalk, snapBeat, sourceWindow, textNeverEarly, visibleIsPrefix, WINDOW_PAD, WORDS_PER_CARD, wordsVisibleAt } from '../../../remotion/src/timing'

const root = path.resolve(import.meta.dirname, '../..')
const SEEDED = ['TLCGBj4AlB0', 'ECaTWkof57E', 'NIR88RRpat4']

function loadTalk(id: string) {
  const vtt = path.join(root, 'content/transcripts/starters', `${id}.vtt`)
  const marked = id === 'NIR88RRpat4' ? path.join(root, 'content/transcripts/mikaeel-al-nur.md') : ''
  const raw = existsSync(vtt) ? readFileSync(vtt, 'utf8') : readFileSync(marked, 'utf8')
  const draft = draftTiers(raw)
  assert.ok(draft, `${id} has a draft`)
  const schedule = scheduleTalk({
    hook: draft.hook,
    turn: draft.turn,
    land: draft.land,
    hookAt: draft.hookAt,
    turnAt: draft.turnAt,
    landAt: draft.landAt,
    cues: wordsOf(raw).map((word) => ({ text: word.text, talkAt: word.at })),
  })
  return { raw, draft, schedule }
}

test('typography: the three seeded talks put only the speaker’s words on screen, and never early', () => {
  for (const id of SEEDED) {
    const { raw, draft, schedule } = loadTalk(id)
    for (const line of [draft.hook, draft.turn, draft.land]) assert.ok(saidInTalk(line, raw), `${id} beat`)
    for (const beat of schedule.beats) {
      const spoken = schedule.words.filter((word) => word.beat === beat.beat).map((word) => word.text).join(' ')
      assert.ok(saidInTalk(spoken, raw), `${id} ${beat.beat}: ${spoken}`)
      assert.ok(isVerbatim(spoken, beat.text), `${id} ${beat.beat} matches the beat`)
    }
    assert.ok(textNeverEarly(schedule), `${id} timing`)
    const turn = schedule.beats.find((beat) => beat.beat === 'turn')!
    assert.ok(wordsVisibleAt(schedule.words, turn.videoAt - 0.05).every((word) => word.beat === 'hook'), `${id} turn waits`)
    assert.ok(visibleIsPrefix(schedule.words, turn.videoAt + 0.05), `${id} prefix`)
    assert.ok(schedule.words[0].showAt >= 0.3, `${id} lead-in`)
    for (const beat of schedule.beats) {
      const group = schedule.words.filter((word) => word.beat === beat.beat)
      const end = beat.videoAt + beat.duration
      for (const word of group) {
        const card = cardAt(group, word.showAt)
        assert.ok(card.length <= WORDS_PER_CARD, `${id} ${beat.beat} card`)
        assert.ok(card.every((shown) => shown.showAt <= end), `${id} ${beat.beat}`)
        assert.equal(card.includes(word), true)
      }
    }
    if (id === 'TLCGBj4AlB0') {
      const land = schedule.words.filter((word) => word.beat === 'land')
      assert.ok(land.length > WORDS_PER_CARD, 'the Prophet land is long enough to turn the page')
      const opened = cardAt(land, land[WORDS_PER_CARD].showAt)
      assert.equal(opened[0], land[WORDS_PER_CARD])
      assert.ok(!opened.includes(land[0]))
    }
  }
})

const round = (value: number) => Math.round(value * 100) / 100

test('every appetiser beat opens and closes on the pause around a whole sentence', () => {
  const windows = JSON.parse(readFileSync(path.join(root, '../remotion/talks/windows.json'), 'utf8'))
  assert.equal(windows.breathSeconds, BREATH)
  assert.equal(windows.padSeconds, WINDOW_PAD)
  // Footage windows checked against the waveform: each cut sits in the pause, about 0.3s clear of the words.
  const footage = {
    ECaTWkof57E: { hook: [766.53, 792.08], turn: [879.73, 905.48], land: [912.81, 938.46] },
    NIR88RRpat4: { hook: [243.6, 269.5], turn: [325.7, 349.2], land: [415.95, 441.35] },
    TLCGBj4AlB0: { hook: [5614.89, 5643.34], turn: [5709.19, 5732.94], land: [5743.74, 5775.94] },
  }
  assert.deepEqual(windows.talks.map((talk: { id: string }) => talk.id), Object.keys(footage))
  for (const talk of windows.talks) {
    const { raw, draft } = loadTalk(talk.id)
    const sentences = sentencesOf(raw)
    for (const beat of talk.beats) {
      const beatId = beat.beat as 'hook' | 'turn' | 'land'
      const caption = draft[beatId]
      assert.equal(beat.text, restoreSpokenTail(talk.id, beat.beat, caption), `${talk.id} ${beat.beat} stays verbatim`)
      assert.equal(saidInTalk(caption, raw), true, `${talk.id} ${beat.beat}`)
      const sentence = sentences.find((row) => row.text === caption)
      assert.ok(sentence, `${talk.id} ${beat.beat} is a whole caption sentence`)
      assert.equal(sentence.complete, true, `${talk.id} ${beat.beat} ends on a sentence`)
      assert.equal(round(sentence.start), beat.sentenceStart)
      assert.equal(round(sentence.end), beat.sentenceEnd)
      const edge = snapBeat(beat.speechStart, beat.speechEnd, beat.before, beat.after)
      assert.equal(round(edge.in), beat.in, `${talk.id} ${beat.beat} in`)
      assert.equal(round(edge.out), beat.out, `${talk.id} ${beat.beat} out`)
      assert.ok(beat.in < beat.speechStart && beat.speechStart <= beat.speechEnd && beat.speechEnd < beat.out, `${talk.id} ${beat.beat} is not cut on a word`)
      assert.ok(beat.speechStart - beat.in <= BREATH + 1e-9, `${talk.id} ${beat.beat} lead`)
      assert.ok(beat.out - beat.speechEnd <= BREATH + 1e-9, `${talk.id} ${beat.beat} tail`)
      assert.ok(beat.in >= beat.before - 1e-9, `${talk.id} ${beat.beat} starts after the previous sentence`)
      assert.ok(beat.out <= beat.after + 1e-9, `${talk.id} ${beat.beat} ends before the next sentence`)
      const window = sourceWindow({ in: beat.in, out: beat.out, speechStart: beat.speechStart, speechEnd: beat.speechEnd })
      assert.deepEqual(beat.window, window)
      assert.deepEqual([beat.window.start, beat.window.end], footage[talk.id as keyof typeof footage][beat.beat as 'hook' | 'turn' | 'land'])
      assert.ok(beat.window.end - beat.window.start <= 36, `${talk.id} ${beat.beat} window`)
    }
  }
})

test('a long appetiser beat shows one card of words, then the next', () => {
  const text = Array.from({ length: 30 }, (_, index) => `word${index}`).join(' ')
  const first = captionPage(text, 10, 40, 10)
  assert.equal(first.pages, 2)
  assert.equal(first.text.split(/\s+/).length, 22)
  assert.equal(first.text.startsWith('word0'), true)
  const later = captionPage(text, 10, 40, 26)
  assert.equal(later.index, 1)
  assert.equal(later.text.startsWith('word22'), true)
  assert.equal(captionPage('Has Allah brought you here?', 1, 8, 1).text, 'Has Allah brought you here?')
})
