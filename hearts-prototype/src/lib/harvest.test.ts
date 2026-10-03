import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { citedCommentary, commentaryFor, isNewMoment, kindOfLine, lineAt, resourceCommentary } from './harvest'
import { isVerbatim } from './transcript'

const arRabb = readFileSync(new URL('../../content/transcripts/mikaeel-ar-rabb.md', import.meta.url), 'utf8')

test('a moment is the transcript line at that time, word for word', () => {
  const line = lineAt(arRabb, 38)
  assert.ok(line)
  assert.equal(line.timestamp, '0:38')
  assert.ok(isVerbatim(line.text, arRabb))
  assert.match(line.text, /Ibn Qayyim Al-Jawzi/)
  assert.ok(line.before.length >= 1)
  assert.ok(line.after.length >= 1)
  for (const side of [...line.before, ...line.after]) assert.ok(isVerbatim(side.text, arRabb))
  assert.equal(lineAt('', 10), null)
  assert.equal(lineAt(arRabb, 9_999_99), null)
})

test('scholars are only words the transcript already gives them', () => {
  const cited = citedCommentary(arRabb, 38)
  assert.ok(cited)
  assert.equal(cited.scholar, 'Ibn Qayyim Al-Jawzi')
  assert.equal(cited.text, 'The highest level of worship is to see and recognize yourself as a slave and servant of Allah.')
  assert.ok(isVerbatim(cited.text, arRabb))
  assert.equal(citedCommentary(arRabb, 20), null)
  assert.equal(citedCommentary('**[0:01]** We went to the shop and bought bread for the family.', 1), null)
})

test('a stored commentary is shown unchanged, and a placeholder is not a source', () => {
  assert.equal(resourceCommentary([{ kind: 'reading', name: 'Further reading', body: 'Verify before sharing. On prayer, look for a commentary the speaker trusts.' }]), null)
  assert.equal(resourceCommentary([{ kind: 'summary', name: 'Ibn Rajab', body: 'This body is long enough to be a summary but summaries are not cited commentary for the harvest.' }]), null)
  const stored = 'The stored words of a commentary already kept on this lesson, copied here without a single added phrase.'
  const hit = resourceCommentary([{ kind: 'quote', name: 'Ibn Rajab, Jami al-Ulum', body: stored, url: 'https://seekersguidance.org/example' }])
  assert.equal(hit?.text, stored)
  assert.match(hit?.citation || '', /Ibn Rajab/)
  assert.match(hit?.citation || '', /https:\/\/seekersguidance\.org\/example/)
  assert.equal(commentaryFor('**[0:01]** We went to the shop and bought bread for the family.', 1, []), null)
})

test('new marks lines gathered after the last visit, and the first look only marks the recent ones', () => {
  const at = new Date('2026-10-03T12:00:00Z')
  assert.equal(isNewMoment('2026-10-03T10:00:00Z', null, at), true)
  assert.equal(isNewMoment('2026-09-01T10:00:00Z', null, at), false)
  assert.equal(isNewMoment('2026-10-03T11:00:00Z', '2026-10-03T09:00:00Z', at), true)
  assert.equal(isNewMoment('2026-10-02T11:00:00Z', '2026-10-03T09:00:00Z', at), false)
  assert.equal(isNewMoment(null, null, at), false)
})

test('a spoken line is classed without inventing a verse', () => {
  assert.equal(kindOfLine('Allah says in the Qur’an, be patient with what they say.'), 'quran')
  assert.equal(kindOfLine('The Prophet, peace be upon him, said hold to the group.'), 'hadith')
  assert.equal(kindOfLine('The other meaning of Rabb in Arabic language is ownership.'), 'line')
})
