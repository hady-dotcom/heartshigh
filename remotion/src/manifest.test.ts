import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseKeyPhrases, keyPhrasesFor, phraseSpans } from './emphasis'
import { assignStyles, FILM_STYLES, parseManifest, sameFilm } from './manifest'
import { isVerbatim } from './timing'

const QUOTES = [
  ['ECaTWkof57E', 'hook', 'Has Allah brought you from one stage to the next stage to to the places you never thought you would be?'],
  ['ECaTWkof57E', 'turn', "But it's at that moment that you got to lock in and have true certainty that Allah's plan is real."],
  ['ECaTWkof57E', 'land', 'I told you that transitions are the time that you need to know this name Ar-Rabb.'],
  ['NIR88RRpat4', 'hook', "What we're saying is that Allah ﷻ is the only source for clarity in your life."],
  ['NIR88RRpat4', 'turn', "Without light, you walk in a room that's dark."],
  ['NIR88RRpat4', 'land', "Now Allah subhanahu wa ta'ala, He says, and many of us, we can relate to this verse."],
] as const

test('key phrases are verbatim pieces of the quote, and the known talks keep their landings', () => {
  for (const [id, beat, quote] of QUOTES) {
    const phrases = keyPhrasesFor(id, beat, quote)
    assert.ok(phrases.length >= 1 && phrases.length <= 3, `${id} ${beat}`)
    for (const phrase of phrases) assert.equal(isVerbatim(phrase, quote), true, phrase)
    const words = quote.split(/\s+/)
    assert.equal(phraseSpans(words.map((text) => ({ text })), phrases).length, phrases.length)
  }
  assert.deepEqual(keyPhrasesFor('ECaTWkof57E', 'hook', QUOTES[0][2]), ['never thought'])
  assert.deepEqual(keyPhrasesFor('ECaTWkof57E', 'land', QUOTES[2][2]), ['Ar-Rabb'])
  assert.deepEqual(keyPhrasesFor('NIR88RRpat4', 'turn', QUOTES[4][2]), ['dark'])
  const fresh = chooseKeyPhrases('The heart settles when the next step is clear.')
  assert.ok(fresh.every((phrase) => isVerbatim(phrase, 'The heart settles when the next step is clear.')))
  assert.ok(fresh.some((phrase) => /clear/.test(phrase)))
  assert.ok(fresh.every((phrase) => phrase.split(/\s+/).length < 8))
})

test('a manifest row becomes one film, and neighbours in a course do not share a style', () => {
  const csv = [
    'talk title,speaker,youtube id,beat,start,end,verbatim quote,clip file name,face-visible flag,course',
    'Ar-Rabb,Shaykh Mikaeel Smith,ECaTWkof57E,hook,776.53,782.08,"Has Allah brought you, truly?",ECaT-hook.mp4,yes,Names',
    'Ar-Rabb,Shaykh Mikaeel Smith,ECaTWkof57E,turn,889.73,895.48,But it is certainty.,ECaT-turn.mp4,yes,Names',
    'Al-Nur,Shaykh Mikaeel Smith,NIR88RRpat4,hook,253.6,259.5,The only source.,NIR-hook.mp4,no,Names',
    'Other,A speaker,abc12345678,land,1,4,A different course lands here.,other.mp4,,Elsewhere',
    'No file yet,A speaker,def12345678,hook,2,5,A line with no clip yet.,,,Elsewhere',
    'skip me',
  ].join('\n')
  const rows = parseManifest(csv)
  assert.equal(rows.length, 5)
  assert.equal(rows[4].clip, '')
  assert.equal(rows[0].quote, 'Has Allah brought you, truly?')
  assert.equal(rows[0].face, true)
  assert.equal(rows[2].face, false)
  assert.equal(rows[3].face, true)
  assert.equal(rows[3].course, 'Elsewhere')
  const styled = assignStyles(rows)
  const names = styled.filter((row) => row.course === 'Names').map((row) => row.style)
  assert.equal(new Set(names).size, names.length)
  for (let index = 1; index < names.length; index++) assert.notEqual(names[index], names[index - 1])
  assert.ok(FILM_STYLES.includes(styled[0].style))
  assert.equal(sameFilm({ ...styled[0], src: '/typography/ECaTWkof57E/hook.mp4' }, styled[0]), true)
  assert.equal(sameFilm({ ...styled[0], src: '/x', quote: 'other' }, styled[0]), false)
})
