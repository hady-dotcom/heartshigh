import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLineTidy, displayLine, shortLine, tidyCaption, tidyKeepsWords, tidyUnchanged } from './tidy-caption'

const EXAMPLE = "return it doesn't return until the day of judgement to testify for or against you allah"

test('a raw auto-caption becomes a sentence, with Allah and the Day of Judgement', () => {
  const tidy = tidyCaption(EXAMPLE)
  assert.equal(tidy, "Return it. It doesn't return until the Day of Judgement to testify for or against you, Allah.")
  assert.equal(tidyCaption(tidy), tidy)
  assert.equal(tidyKeepsWords(EXAMPLE, tidy), true)
})

test('Qur\'an, the Prophet, names of Allah, the speaker and I take capitals', () => {
  const raw = "i ask ar-rabb to make the quran the light of my heart as the prophet said o mikaeel smith"
  const tidy = tidyCaption(raw, { speakers: ['Shaykh Mikaeel Smith'] })
  assert.match(tidy, /^I ask/)
  assert.match(tidy, /Ar-Rabb/)
  assert.match(tidy, /Qur'an/)
  assert.match(tidy, /the Prophet/)
  assert.match(tidy, /Mikaeel Smith/)
  assert.equal(tidyCaption(tidy, { speakers: ['Shaykh Mikaeel Smith'] }), tidy)
})

test('Al-Nur and a question keep their shape, and American spelling becomes British', () => {
  const line = tidyCaption('did you know al-nur is a name and judgment is not the british spelling')
  assert.equal(line.endsWith('?'), true)
  assert.match(line, /Al-Nur/)
  assert.match(line, /judgement/)
  assert.doesNotMatch(line, /\bjudgment\b/)
  assert.equal(tidyCaption(line), line)
})

test('a long line shortens to about 18 words without dropping the capital', () => {
  const raw = 'allah sees the heart when the room is quiet and nobody is performing for anyone else in the gathering tonight or tomorrow'
  const short = shortLine(raw, 8)
  assert.ok(short.split(/\s+/).length <= 8, short)
  assert.match(short, /^Allah/)
  assert.match(short, /\.$/)
})

test('a stored tidy is kept when it still matches the raw words, and a changed caption is redone', () => {
  const sources = {
    speaker: 'A speaker',
    quote: EXAMPLE,
    hook: 'did you know that allah sees you',
    turn: 'but the heart turns',
    land: EXAMPLE,
    horsLines: [{ at: 12.4, text: 'i return to ar-rabb' }],
  }
  const first = buildLineTidy(sources)
  assert.equal(tidyUnchanged(first, sources, false), true)
  assert.equal(tidyUnchanged(first, sources, true), false)
  assert.equal(tidyUnchanged({ ...first, source: 'ai' }, sources, true), true)
  assert.equal(tidyUnchanged(first, { ...sources, hook: 'a different line about the heart' }, false), false)
  assert.equal(displayLine(sources.hook, first.hook), first.hook.text)
  assert.match(displayLine('brand new words about allah', first.hook), /^Brand new words about Allah/)
})
