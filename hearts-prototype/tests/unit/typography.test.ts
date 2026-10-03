import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { draftTiers, saidInTalk, wordsOf } from '../../src/lib/tiers'
import { isVerbatim, scheduleTalk, textNeverEarly, visibleIsPrefix, wordsVisibleAt } from '../../../remotion/src/timing.ts'

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
  }
})
