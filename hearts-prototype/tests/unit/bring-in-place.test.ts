import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DOORS } from '../../src/lib/doors'
import {
  PLACE_LEAD_RATIO,
  PLACE_MIN_PERCENT,
  buildPlaceCatalogue,
  loadPlaceCatalogue,
  parseGhunyaHeadings,
  phrasesFromText,
  placeBringInRows,
  scoreBringInTalk,
} from '../../src/lib/bring-in-place'
import { parseJibrilMap } from '../../src/lib/seats'

function vtt(rows: [string, string, string][]) {
  return ['WEBVTT', '', ...rows.map(([start, end, text]) => `${start} --> ${end}\n${text}\n`)].join('\n')
}

const catalogue = loadPlaceCatalogue()

test('phrase lists are derived from the doors, the clause map and the Ghunya shelf', () => {
  const shelf = '7. Fasting\n  • Fasting beyond Ramadan\n  • Why fast?\n  → Ramadan Muslims\n'
  const built = buildPlaceCatalogue({
    doors: [{ number: 7, section: 'Islam', title: 'Fasting Ramadan', clauses: [17], teaching: 'Fasting Ramadan.' }],
    clauses: [{ number: 17, teaching: 'Fasting from bad language.', seats: ['the tongue and backbiting'], series: 'Ramadan Muslims' }],
    shelf,
  })
  const door = built.jibril.find((row) => row.id === 'W7')
  assert.ok(door)
  assert.ok(door.phrases.includes('fasting ramadan'))
  assert.ok(door.phrases.includes('bad language'))
  assert.ok(door.phrases.includes('backbiting'))
  assert.equal(door.phrases.includes('zakat'), false)
  assert.deepEqual(parseGhunyaHeadings(shelf), ['Fasting', 'Fasting beyond Ramadan', 'Why fast?'])
  assert.equal(built.ghunya.some((row) => row.label === 'Ramadan Muslims'), false)
  assert.ok(built.ghunya.find((row) => row.id === 'Fasting beyond Ramadan')?.phrases.includes('fasting beyond ramadan'))
  assert.deepEqual(phrasesFromText('Fasting Ramadan'), ['fasting', 'ramadan', 'fasting ramadan'])

  const realShelf = readFileSync(new URL('../../content/ghunya-shelf.txt', import.meta.url), 'utf8')
  const realMap = parseJibrilMap(readFileSync(new URL('../../content/jibril-map.txt', import.meta.url), 'utf8'))
  assert.equal(catalogue.jibril.length, 20)
  assert.deepEqual(catalogue.jibril.map((row) => row.id), DOORS.map((door) => `W${door.number}`))
  assert.ok(catalogue.jibril.find((row) => row.id === 'W7')?.phrases.includes('fasting ramadan'))
  assert.ok(catalogue.ghunya.some((row) => row.label === 'The Five Daily Prayers'))
  assert.ok(catalogue.ghunya.some((row) => row.label === 'Fasting beyond Ramadan'))
  assert.equal(realMap.size, 41)
  assert.ok(parseGhunyaHeadings(realShelf).includes('The Five Daily Prayers'))
  assert.equal(PLACE_MIN_PERCENT, 12)
  assert.equal(PLACE_LEAD_RATIO, 1.5)
})

test('a long stretch of a map phrase beats a brief mention and fills the door and the heading', () => {
  const prayer = scoreBringInTalk(vtt([
    ['00:00:00.000', '00:09:00.000', 'We establish the prayer and the five daily prayers hold the day'],
    ['00:09:00.000', '00:09:30.000', 'Fasting beyond Ramadan'],
  ]), catalogue)
  assert.equal(prayer.jibril.value, 'W5')
  assert.equal(prayer.jibril.confidence, 'high')
  assert.ok(prayer.jibril.coverPct >= 90)
  assert.equal(prayer.jibril.terms[0]?.phrase, 'five daily prayer')
  assert.equal(prayer.jibril.terms[0]?.at, '0:00')
  assert.ok((prayer.jibril.terms[0]?.seconds || 0) > 500)
  assert.equal(prayer.ghunya.value, 'The Five Daily Prayers')
  assert.equal(prayer.ghunya.confidence, 'high')

  const fast = scoreBringInTalk(vtt([
    ['00:00:00.000', '00:08:00.000', 'Fasting Ramadan is the month we leave food and fasting beyond Ramadan keeps the fast'],
    ['00:08:00.000', '00:08:20.000', 'A brief word about the five daily prayers'],
  ]), catalogue)
  assert.equal(fast.jibril.value, 'W7')
  assert.equal(fast.jibril.confidence, 'high')
  assert.equal(fast.ghunya.value, 'Fasting beyond Ramadan')
  assert.ok(fast.ghunya.coverPct >= 90)
})

test('a brief mention stays blank and names the closest section and the share of the talk', () => {
  const brief = scoreBringInTalk(vtt([
    ['00:00:00.000', '00:10:00.000', 'We bought bread and apples at the market for supper'],
    ['00:10:00.000', '00:10:30.000', 'Then someone mentioned zakat'],
  ]), catalogue)
  assert.equal(brief.jibril.value, '')
  assert.equal(brief.jibril.confidence, 'low')
  assert.ok(brief.jibril.coverPct < PLACE_MIN_PERCENT)
  assert.match(brief.jibril.reason, /W6/)
  assert.match(brief.jibril.reason, /not enough to fill it in/)
  assert.match(brief.jibril.reason, new RegExp(`${brief.jibril.coverPct}%`))
  assert.equal(brief.ghunya.value, '')
  assert.equal(brief.ghunya.confidence, 'low')
})

test('two sections that cover the same stretch are left blank and both are named', () => {
  const doors = scoreBringInTalk(vtt([
    ['00:00:00.000', '00:05:00.000', 'Establish the prayer and keep establishing the prayer'],
    ['00:05:00.000', '00:10:00.000', 'Fasting Ramadan and again fasting Ramadan'],
  ]), catalogue)
  assert.equal(doors.jibril.value, '')
  assert.equal(doors.jibril.confidence, 'low')
  assert.match(doors.jibril.reason, /W5/)
  assert.match(doors.jibril.reason, /W7/)
  assert.match(doors.jibril.reason, /too close/)

  const headings = scoreBringInTalk(vtt([
    ['00:00:00.000', '00:05:00.000', 'The five daily prayers order the day'],
    ['00:05:00.000', '00:10:00.000', 'Fasting beyond Ramadan keeps the same fast'],
  ]), catalogue)
  assert.equal(headings.ghunya.value, '')
  assert.equal(headings.ghunya.confidence, 'low')
  assert.match(headings.ghunya.reason, /The Five Daily Prayers/)
  assert.match(headings.ghunya.reason, /Fasting beyond Ramadan/)
  assert.match(headings.ghunya.reason, /too close/)
})

test('no timed captions leave both fields blank and say so', () => {
  const missing = scoreBringInTalk('', catalogue)
  assert.equal(missing.jibril.value, '')
  assert.equal(missing.jibril.confidence, 'low')
  assert.equal(missing.jibril.reason, 'No captions yet.')
  assert.equal(missing.ghunya.reason, 'No captions yet.')
  const none = scoreBringInTalk('   ', catalogue, 'No captions on this film.')
  assert.equal(none.jibril.reason, 'No captions on this film.')
})

test('lookup placement uses fetched timed text, keeps a chosen door, and survives a failed fetch', async () => {
  const timed = vtt([['00:00:00.000', '00:06:00.000', 'Fasting beyond Ramadan and fasting Ramadan']])
  const calls: string[] = []
  const placed = await placeBringInRows(
    [
      { id: 'fast0001', captions: 'yes', jibril: '', ghunya: '' },
      { id: 'none0001', captions: 'no', jibril: '', ghunya: '' },
      { id: 'wall0001', captions: 'yes', jibril: '', ghunya: '' },
    ],
    {
      catalogue,
      presetJibril: '',
      presetGhunya: '',
      fetchTranscript: async (id) => {
        calls.push(id)
        if (id === 'wall0001') throw new Error('bot wall')
        return id === 'fast0001' ? timed : null
      },
    },
  )
  assert.deepEqual(calls.sort(), ['fast0001', 'wall0001'])
  assert.equal(placed[0].jibril, 'W7')
  assert.equal(placed[0].ghunya, 'Fasting beyond Ramadan')
  assert.equal(placed[0].jibrilPlace.confidence, 'high')
  assert.equal(placed[1].jibril, '')
  assert.equal(placed[1].jibrilPlace.reason, 'No captions on this film.')
  assert.equal(placed[2].jibril, '')
  assert.equal(placed[2].ghunyaPlace.reason, 'No captions yet.')

  const kept = await placeBringInRows(
    [{ id: 'fast0001', captions: 'yes', jibril: '', ghunya: '' }],
    { catalogue, presetJibril: 'W10', presetGhunya: 'A heading the admin typed', fetchTranscript: async () => timed },
  )
  assert.equal(kept[0].jibril, 'W10')
  assert.equal(kept[0].ghunya, 'A heading the admin typed')
  assert.equal(kept[0].jibrilPlace.value, 'W7')
})
