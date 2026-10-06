import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foldSpeaker, resolveSpeaker, speakerSlug, stripSpeakerHonorific } from './speakers'

const cases = [
  ['Sh. Mohammad Elshinawy', 'Mohammad Elshinawy', 'mohammad-elshinawy'],
  ['Dr. Tesneem Alkiek', 'Tesneem Alkiek', 'tesneem-alkiek'],
  ['Dr. Umar Faruq Abd-Allah', 'Umar Faruq Abd-Allah', 'umar-faruq-abd-allah'],
  ['Ustadh Naeem Baig (Hāfidh)', 'Naeem Baig', 'naeem-baig'],
  ['Alaeddin Albakri', 'Alauddin Elbakri', 'alauddin-elbakri'],
] as const

test('known aliases resolve to one speaker even when the catalogue is empty', () => {
  for (const [raw, name, slug] of cases) {
    const resolved = resolveSpeaker(raw, [])
    assert.ok(resolved, raw)
    assert.equal(resolved.name, name)
    assert.equal(resolved.slug, slug)
    assert.equal(resolved.id, null)
  }
  assert.equal(foldSpeaker('Dr. Umar Faruq Abd-Allah'), foldSpeaker('Umar Faruq Abd-Allah'))
  assert.notEqual(foldSpeaker('Alaeddin Albakri'), foldSpeaker('Alauddin Elbakri'))
  assert.equal(resolveSpeaker('Shahid Jones', []), null)
  assert.equal(speakerSlug('Shaykh Mikaeel Smith'), 'mikaeel-smith')
  assert.equal(stripSpeakerHonorific('Shaykh Yasir Fahmy'), 'Yasir Fahmy')
  assert.equal(stripSpeakerHonorific('Yasir Fahmy'), 'Yasir Fahmy')
  assert.equal(stripSpeakerHonorific('Shahid Jones'), 'Shahid Jones')
})

test('a catalogue alias wins, and a title that already shares the page is not a new person', () => {
  const catalogue = [{ id: 4, name: 'Mikaeel Smith', slug: 'mikaeel-smith', displayName: 'Shaykh Mikaeel Smith', aliases: [] }]
  const resolved = resolveSpeaker('Shaykh Mikaeel Smith', catalogue)
  assert.equal(resolved?.id, 4)
  assert.equal(resolved?.slug, 'mikaeel-smith')
  assert.equal(speakerSlug('Shaykh Mikaeel Smith'), resolved?.slug)
  const named = resolveSpeaker('Alaeddin Albakri', [{ id: 9, name: 'Alauddin Elbakri', slug: 'alauddin-elbakri', aliases: ['Alaeddin Albakri'] }])
  assert.equal(named?.id, 9)
  assert.equal(named?.name, 'Alauddin Elbakri')
})
