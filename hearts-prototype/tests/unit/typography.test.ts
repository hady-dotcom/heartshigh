import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { captionPage, draftTiers, saidInTalk, wordsOf } from '../../src/lib/tiers'
import { cardAt, isVerbatim, scheduleTalk, textNeverEarly, visibleIsPrefix, WORDS_PER_CARD, wordsVisibleAt } from '../../../remotion/src/timing.ts'

const root = path.resolve(import.meta.dirname, '../..')
const SEEDED = ['TLCGBj4AlB0', 'ECaTWkof57E', 'NIR88RRpat4']

function talk(id: string) {
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
    const { raw, draft, schedule } = talk(id)
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
