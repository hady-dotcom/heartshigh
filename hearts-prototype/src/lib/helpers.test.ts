import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { harvestTranscript } from './harvest'
import { DEFAULT_START_CLAUSE, optionLabels, parseOption, recommendLesson, startingClause } from './placing'
import { parseJibrilMap, suggestSeat } from './seats'
import { delayToMs, formatCountdown, unlockState } from './unlock'
import { ingestYoutubeUrl, segmentsToVtt, transcriptFor, type TranscriptProvider } from './youtube'
import { isVerbatim } from './transcript'

test('placing options carry their clause and hide it from the learner', () => {
  assert.deepEqual(parseOption('With prayer | 15'), { label: 'With prayer', clause: 15 })
  assert.deepEqual(parseOption('Out of range | 99'), { label: 'Out of range', clause: null })
  assert.deepEqual(optionLabels(['A | 3', 'B']), ['A', 'B'])
})

test('starting clause follows the votes, the last question weighs double, ties go to the earlier answer', () => {
  const q1 = ['Quiet | 30', 'Busy | 13']
  const q2 = ['Prayer | 15', 'Names | 22']
  assert.equal(startingClause([{ options: q1, choice: 'Busy' }, { options: q2, choice: 'Names', weight: 2 }]), 22)
  assert.equal(startingClause([{ options: q1, choice: 'Quiet' }, { options: q2, choice: 'Prayer' }]), 30)
  assert.equal(startingClause([]), DEFAULT_START_CLAUSE)
  assert.equal(startingClause([{ options: q1, choice: 'Something else' }]), DEFAULT_START_CLAUSE)
})

test('the recommended part is the one whose cuts hang on the starting clause', () => {
  const cuts = [
    { lessonId: 1, bestClause: 22, approved: false },
    { lessonId: 2, bestClause: 22, approved: true },
    { lessonId: 3, bestClause: 13, approved: true },
  ]
  assert.equal(recommendLesson(22, cuts, [1, 2, 3]), 2)
  assert.equal(recommendLesson(41, cuts, [1, 2, 3]), 1)
  assert.equal(recommendLesson(22, cuts, []), null)
})

test('the Jibril map gives 41 clauses with three seats each, word for word', () => {
  const source = readFileSync(new URL('../../content/jibril-map.txt', import.meta.url), 'utf8')
  const map = parseJibrilMap(source)
  assert.equal(map.size, 41)
  for (const [number, entry] of map) {
    assert.equal(entry.seats.length, 3, `clause ${number} should have three seats`)
    for (const seat of entry.seats) assert.ok(!seat.includes('—'))
  }
  const withoutTeaching = [...map.values()].filter((entry) => !entry.teaching).map((entry) => entry.number)
  assert.deepEqual(withoutTeaching, [22, 23, 24, 25, 27], 'only the clauses the map gives no TEACHING line for are left to the seed')
})

test('a seat is only suggested when words overlap, never invented', () => {
  const seats = [
    { id: 1, clause: 22, position: 1, text: 'The Lord who nurtures and raises' },
    { id: 2, clause: 22, position: 2, text: 'Light upon light in the heavens' },
    { id: 3, clause: 13, position: 1, text: 'Light of prayer' },
  ]
  assert.equal(suggestSeat('Allah is the light of the heavens and the earth', 22, seats)?.id, 2)
  assert.equal(suggestSeat('Nothing in common here', 22, seats), null)
  assert.equal(suggestSeat('Light', null, seats), null)
})

test('harvest copies verses and hadith word for word with the real timestamp', () => {
  const raw = readFileSync(new URL('../../content/transcripts/fahmy-session6.md', import.meta.url), 'utf8')
  const hits = harvestTranscript(raw)
  assert.ok(hits.length > 0)
  for (const hit of hits) {
    assert.ok(['quran', 'hadith'].includes(hit.kind))
    assert.ok(isVerbatim(hit.text, raw), `not verbatim: ${hit.text.slice(0, 80)}`)
    assert.match(hit.timestamp, /^\d+:\d{2}(:\d{2})?$/)
  }
  assert.deepEqual(harvestTranscript('**[0:01]** We went to the shop and bought bread for the family.'), [])
})

test('delayed and contingent questions unlock at the right moment', () => {
  const seen = new Date('2026-10-01T10:00:00Z')
  const day = delayToMs(1, 'day')
  assert.equal(day, 86_400_000)
  assert.equal(delayToMs(-3, 'day'), 0)
  assert.equal(unlockState({ timing: 'immediate', delayMs: 0, hasContingent: false, contingentAnsweredAt: null, seenAt: null, at: seen }).state, 'open')
  const before = unlockState({ timing: 'future', delayMs: day, hasContingent: false, contingentAnsweredAt: null, seenAt: seen, at: new Date(seen.getTime() + day - 1000) })
  assert.equal(before.state, 'countdown')
  assert.equal(formatCountdown(before.unlocksAt!, new Date(seen.getTime() + day - 1000)), '0 hours 0 min 1 sec')
  assert.equal(unlockState({ timing: 'future', delayMs: day, hasContingent: false, contingentAnsweredAt: null, seenAt: seen, at: new Date(seen.getTime() + day) }).state, 'open')
  assert.equal(unlockState({ timing: 'future', delayMs: day, hasContingent: true, contingentAnsweredAt: null, seenAt: seen, at: new Date(seen.getTime() + 9 * day) }).state, 'waiting')
  const answered = new Date('2026-10-05T10:00:00Z')
  assert.equal(unlockState({ timing: 'future', delayMs: day, hasContingent: true, contingentAnsweredAt: answered, seenAt: seen, at: new Date(answered.getTime() + day / 2) }).state, 'countdown')
})

const fake = (name: string, text: string | null): TranscriptProvider => ({ name, fetch: async () => text })
const VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.\n'

test('the YouTube transcript chain tries each provider in order and stops at the first that answers', async () => {
  const found = await transcriptFor('abc', [fake('one', null), fake('two', VTT), fake('three', 'never reached')])
  assert.equal(found.provider, 'two')
  assert.deepEqual(found.tried, ['one', 'two'])
  const none = await transcriptFor('abc', [fake('one', null), fake('two', '   ')])
  assert.equal(none.transcript, null)
  assert.deepEqual(none.tried, ['one', 'two'])
})

test('ingesting a YouTube link explains each failure plainly', async () => {
  const meta = async (id: string) => ({ id, title: 'A talk', author: 'Someone', thumbnail: '' })
  const ok = await ingestYoutubeUrl('https://youtu.be/ECaTWkof57E', { providers: [fake('p', VTT)], meta })
  assert.equal(ok.ok, true)
  const blocked = await ingestYoutubeUrl('https://www.youtube.com/watch?v=ECaTWkof57E', { providers: [fake('p', null)], meta })
  assert.equal(blocked.ok, false)
  assert.ok(!blocked.ok && blocked.needsTranscript && /Upload a \.vtt/.test(blocked.error))
  const missing = await ingestYoutubeUrl('https://www.youtube.com/watch?v=ECaTWkof57E', { providers: [fake('p', VTT)], meta: async () => null })
  assert.ok(!missing.ok && /does not exist or is private/.test(missing.error))
  const notYoutube = await ingestYoutubeUrl('https://example.com/video', { providers: [], meta })
  assert.ok(!notYoutube.ok && /does not look like a YouTube link/.test(notYoutube.error))
  assert.match(segmentsToVtt([{ start: 61.5, end: 63, text: 'Hi' }]), /00:01:01\.500 --> 00:01:03\.000\nHi/)
})
