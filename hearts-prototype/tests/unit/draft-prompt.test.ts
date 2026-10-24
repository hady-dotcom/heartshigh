import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { talkSources } from '../../scripts/tier-report'
import { DRAFT_FOLLOW_UPS, draftPopupPrompt } from '../../src/lib/draft-prompt'
import { draftTiers } from '../../src/lib/tiers'

test('seeded drafts rotate follow-ups and never say The speaker says', () => {
  const one = draftPopupPrompt('Trust in Allah.', 0)
  const two = draftPopupPrompt('Hold your tongue.', 1)
  const three = draftPopupPrompt('Give thanks.', 2)
  assert.match(one, /^He said: “Trust in Allah\.” /)
  assert.match(two, /^“Hold your tongue\.” /)
  assert.doesNotMatch(`${one}\n${two}\n${three}`, /The speaker says/)
  const tails = [one, two, three].map((text) => DRAFT_FOLLOW_UPS.find((follow) => text.endsWith(follow)))
  assert.deepEqual(tails, [...DRAFT_FOLLOW_UPS])
  assert.equal(new Set(tails).size, 3)
})

test('the tier drafter uses those lines, and a sheet import file is left alone', () => {
  const talk = talkSources()[0]
  const draft = draftTiers(talk.raw, talk.seconds)
  assert.ok(draft && draft.popups.length >= 2)
  const prompts = draft.popups.map((row) => row.prompt)
  for (const prompt of prompts) assert.doesNotMatch(prompt, /The speaker says/)
  if (prompts.length >= 2) {
    const follows = prompts.map((prompt) => DRAFT_FOLLOW_UPS.find((follow) => prompt.endsWith(follow)))
    assert.ok(new Set(follows).size >= 2, 'two questions in a part do not share one follow-up')
  }
  const sheet = readFileSync(path.join(process.cwd(), 'src/lib/sheet-draft.ts'), 'utf8')
  assert.match(sheet, /What stayed with you in this part of the talk/)
  assert.doesNotMatch(sheet, /draftPopupPrompt/)
})
