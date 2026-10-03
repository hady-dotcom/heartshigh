import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import type { Payload } from 'payload'

process.env.HEARTS_SCRIPTURE_OFFLINE = '1'

import { buildHadithIndex, matchHadith, narratorNamed } from '../../src/lib/hadith-match'
import { collectionsNamed, harvestTranscript } from '../../src/lib/harvest'
import type { LlmClient, LlmRequest } from '../../src/lib/llm'
import { ayahWindow, matchQuran, surahLabel } from '../../src/lib/quran-match'
import { summaryLabel, summaryRequest, TAFSIR_SOURCES } from '../../src/lib/tafsir'
import { replayHref, REPLAY_LEAD_SECONDS } from '../../src/screens/app/harvest'
import { quranIndex, scriptureFallback, scriptureOffline, tafsirFor, tafsirSummary, talkHarvest } from '../../src/server/scripture'

const root = process.cwd()
const index = quranIndex()
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const starters = readdirSync(path.join(root, 'content/transcripts/starters')).filter((file) => file.endsWith('.vtt'))
const fixture = read('tests/fixtures/harvest-talk.vtt')

/** A payload with only the scripture cache, kept in memory. */
function fakePayload() {
  const docs: { id: number; key: string; kind: string; data: unknown }[] = []
  const payload = {
    async find({ where }: { where: { key: { equals: string } } }) {
      return { docs: docs.filter((doc) => doc.key === where.key.equals) }
    },
    async create({ data }: { data: { key: string; kind: string; data: unknown } }) {
      const doc = { id: docs.length + 1, ...data }
      docs.push(doc)
      return doc
    },
    async update({ id, data }: { id: number; data: { data: unknown } }) {
      const doc = docs.find((row) => row.id === id)!
      doc.data = data.data
      return doc
    },
  }
  return { payload: payload as unknown as Payload, docs }
}

function mockLlm(reply: string) {
  const calls: LlmRequest[] = []
  const client: LlmClient = { name: 'mock', complete: async (request) => (calls.push(request), reply) }
  return { client, calls }
}

test('Harvest: tests read the bundled scripture only, never the network', () => {
  assert.equal(scriptureOffline(), true)
  assert.equal(index.corpus.ar.length, 6236)
  assert.equal(index.corpus.en.length, 6236)
})

test('Harvest matching: Arabic the speaker recites is matched to its ayah', () => {
  assert.deepEqual(pick(matchQuran(index, 'Where Allah says, اَوَمَن كَانَ مَيْتًا is the person who was dead.')), ['6:122', 'arabic'])
  assert.deepEqual(pick(matchQuran(index, 'يُرِيدُونَ أَن يُطَفِعُوا نُورَ اللَّهِ بِأَفْوَاهِهِمْ Allah says there are haters out there.')), ['9:32', 'arabic'])
  assert.deepEqual(pick(matchQuran(index, 'يَا أَيُّهَا الَّذِينَ آمَنُوا تُوبُوا إِلَى اللَّهِ O you who believe, repent to Allah.')), ['66:8', 'arabic'])
})

test('Harvest matching: transliterated recitation is matched to its ayah', () => {
  assert.deepEqual(pick(matchQuran(index, 'Then Allah subhanahu wa ta’ala says, yuqadu min shajaratin mubarakatin zaytoona.')), ['24:35', 'transliteration'])
})

test('Harvest matching: an English rendering close to a real translation is matched', () => {
  const said = 'And the servants of the Most Merciful are those who walk upon the earth easily, and when the ignorant address them, they say words of peace.'
  assert.deepEqual(pick(matchQuran(index, said)), ['25:63', 'english'])
})

test('Harvest matching: no confident match gives no reference, never a guess', () => {
  assert.equal(matchQuran(index, 'Allah says be patient, for patience is beautiful, and it will carry you through the hard days.'), null)
  assert.equal(matchQuran(index, 'Amen, amen. May Allah bless you all and see you next week.'), null)
  assert.equal(matchQuran(index, 'O Allah, make us of those who listen and follow the best of it.'), null)
  // Al-Fatiha 1:2 is word for word in 39:75 and 40:65 too, so it cannot be pinned to one place.
  assert.equal(matchQuran(index, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'), null)
})

test('Harvest matching: the talk on al-Nur is quoted word for word and each verse is placed', () => {
  const hits = harvestTranscript(read('content/transcripts/mikaeel-al-nur.md'), index)
  const placed = hits.filter((hit) => hit.surah).map((hit) => `${hit.surah}:${hit.ayah}`)
  for (const ayah of ['6:122', '7:180', '57:13', '24:35', '66:8', '9:32']) assert.ok(placed.includes(ayah), `${ayah} is found`)
  const transcript = read('content/transcripts/mikaeel-al-nur.md').replace(/\s+/g, ' ')
  for (const hit of hits) {
    for (const piece of hit.text.split(/(?<=[.?!])\s+/).filter((part) => part.length > 12)) {
      assert.ok(transcript.includes(piece.trim()), `"${piece}" is in the speaker's words`)
    }
  }
})

test('Harvest matching: the test talk gives its verses, its named hadith, and an unplaced quote', () => {
  const hits = harvestTranscript(fixture, index)
  const quran = hits.filter((hit) => hit.kind === 'quran')
  assert.deepEqual(quran.map((hit) => (hit.surah ? `${hit.surah}:${hit.ayah}` : 'none')), ['25:63', '66:8', 'none'])
  assert.match(quran[2].text, /patience is beautiful/)
  const hadith = hits.filter((hit) => hit.kind === 'hadith')
  assert.equal(hadith.length, 2)
  assert.deepEqual(hadith[0].collections, ['bukhari'])
  assert.equal(hadith[1].collections, undefined, 'the smile hadith names no collection')
  assert.ok(!hits.some((hit) => /see you next week/.test(hit.text)), 'the sign-off is not a quote')
})

test('Harvest matching: collections are read from what the speaker says, garbled captions included', () => {
  assert.deepEqual(collectionsNamed('narrated in Sahih al-Bukhari'), ['bukhari'])
  assert.deepEqual(collectionsNamed('as Imam Bkari reports'), ['bukhari'])
  assert.deepEqual(collectionsNamed('the Prophet said a smile is charity'), [])
})

test('Hadith matching: a named collection and narrator find the one hadith; the wrong narrator finds none', () => {
  const bundle = scriptureFallback().hadith.bukhari
  assert.ok(bundle?.length, 'the bundle carries Bukhari')
  const bukhari = buildHadithIndex('bukhari', bundle)
  const said = 'The Prophet said, in the hadith narrated in Sahih al-Bukhari on the authority of Umar, the reward of deeds depends upon the intentions and every person will get the reward according to what he has intended.'
  assert.equal(narratorNamed(said), 'Umar')
  assert.equal(matchHadith(bukhari, said)?.hadith.number, 1)
  assert.equal(matchHadith(bukhari, said.replace('Umar', 'Anas')), null)
  assert.equal(matchHadith(bukhari, 'The Prophet said, in Sahih al-Bukhari, a smile for your brother is a charity.'), null)
})

test('Hadith matching: when a collection repeats a hadith word for word, the first place it appears is cited', () => {
  const text = 'Narrated Umar: The Prophet said, "The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended."'
  const repeated = buildHadithIndex('bukhari', [
    { number: 54, text },
    { number: 1, text },
    { number: 9, text: 'Narrated Abu Huraira: Faith has over sixty branches and modesty is a part of faith.' },
  ])
  assert.equal(matchHadith(repeated, 'on the authority of Umar, the reward of deeds depends upon the intentions and every person will get what he intended')?.hadith.number, 1)
  const different = buildHadithIndex('bukhari', [
    { number: 1, text: 'Narrated Umar: the reward of deeds depends upon the intentions.' },
    { number: 2, text: 'Narrated Umar: the reward of deeds depends upon the intentions of the heart.' },
  ])
  assert.equal(matchHadith(different, 'the reward of deeds depends upon the intentions of a person'), null)
})

test('Harvest: a hadith is placed only when its collection is named and it matched', async () => {
  const { payload } = fakePayload()
  const items = await talkHarvest(payload, 999, fixture)
  const hadith = items.filter((item) => item.kind === 'hadith')
  assert.equal(hadith[0].reference, 'Sahih al-Bukhari 1')
  assert.equal(hadith[0].collection, 'bukhari')
  assert.match(hadith[0].hadithText || '', /reward of deeds depends upon the intentions/)
  assert.ok((hadith[0].hadithArabic || '').length > 50, 'with the real Arabic')
  assert.equal(hadith[1].collection, undefined)
  assert.equal(hadith[1].hadithText, undefined)
  const unplaced = items.find((item) => item.kind === 'quran' && !item.surah)!
  assert.equal(unplaced.reference, '', 'an unmatched quote carries no reference')
})

test('Context: the ayah comes with three either side and never crosses into the next surah', () => {
  const window = ayahWindow(index, 25, 63)
  assert.deepEqual(window.map((row) => row.ayah), [60, 61, 62, 63, 64, 65, 66])
  assert.deepEqual(window.filter((row) => row.focus).map((row) => row.ayah), [63])
  assert.ok(window.every((row) => row.arabic && row.english))
  assert.deepEqual(ayahWindow(index, 66, 11).map((row) => row.ayah), [8, 9, 10, 11, 12])
  assert.equal(surahLabel(index, 25, 63), 'Al-Furqaan 25:63')
})

test('Tafsir: the bundle has every named source for every ayah the starter talks quote', async () => {
  const { payload } = fakePayload()
  const ayahs = new Set<string>()
  for (const file of starters) for (const hit of harvestTranscript(read(`content/transcripts/starters/${file}`), index)) if (hit.surah) ayahs.add(`${hit.surah}:${hit.ayah}`)
  for (const file of ['mikaeel-al-nur.md', 'mikaeel-ar-rabb.md']) for (const hit of harvestTranscript(read(`content/transcripts/${file}`), index)) if (hit.surah) ayahs.add(`${hit.surah}:${hit.ayah}`)
  assert.ok(ayahs.size >= 15)
  for (const key of ayahs) {
    const [surah, ayah] = key.split(':').map(Number)
    const texts = await tafsirFor(payload, surah, ayah)
    assert.ok(texts.length >= 3, `${key} has tafsir from ${texts.length} sources`)
    for (const row of texts) assert.ok(TAFSIR_SOURCES.some((source) => source.slug === row.slug && source.title === row.title), `${row.slug} is a named source`)
  }
})

test('Summary labels: the label names the tafsir the summary was written from', () => {
  assert.equal(summaryLabel(['Tafsir Ibn Kathir']), 'AI summary of Tafsir Ibn Kathir')
  assert.equal(summaryLabel(['Tafsir Ibn Kathir', 'Tafsir al-Jalalayn', "Tafsir al-Sa'di"]), "AI summary of Tafsir Ibn Kathir, Tafsir al-Jalalayn and Tafsir al-Sa'di")
})

test('Summary: the model is given only the real tafsir, one text per work, and told to add nothing', async () => {
  const { payload } = fakePayload()
  const texts = await tafsirFor(payload, 25, 63)
  const request = summaryRequest(25, 63, texts)
  assert.deepEqual(request.used, ['Tafsir Ibn Kathir', 'Tafsir al-Jalalayn', "Tafsir al-Sa'di"])
  assert.match(request.llm.system, /Use only the tafsir passages you are given/)
  for (const title of request.used) assert.ok(request.llm.user.includes(`### ${title}`))
  const kathir = texts.find((row) => row.slug === 'en-tafisr-ibn-kathir')!
  assert.ok(request.llm.user.includes(kathir.text.slice(0, 200)), 'the real text is passed in')
})

test('Summary: with AI it is labelled with its sources and cached; without AI it says so and shows al-Jalalayn itself', async () => {
  const { payload, docs } = fakePayload()
  const { client, calls } = mockLlm('The servants of the Merciful walk with humility and answer ignorance with peace.')
  const first = await tafsirSummary(payload, 25, 63, client)
  assert.equal(first?.ai, true)
  assert.equal(first?.label, "AI summary of Tafsir Ibn Kathir, Tafsir al-Jalalayn and Tafsir al-Sa'di")
  const again = await tafsirSummary(payload, 25, 63, client)
  assert.equal(again?.text, first?.text)
  assert.equal(calls.length, 1, 'the second request is served from the cache')
  assert.ok(docs.some((doc) => doc.key.startsWith('summary:25:63:')))

  const plain = await tafsirSummary(fakePayload().payload, 25, 63, null)
  assert.equal(plain?.ai, false)
  assert.doesNotMatch(plain!.label, /^AI summary/)
  assert.match(plain!.label, /No AI summary is available here, so this is Tafsir al-Jalalayn in its own words/)
  assert.equal(plain?.text, scriptureFallback().tafsir['25:63']['en-al-jalalayn'])

  const failing: LlmClient = { name: 'down', complete: async () => { throw new Error('offline') } }
  assert.equal((await tafsirSummary(fakePayload().payload, 25, 63, failing))?.ai, false)
  assert.equal(await tafsirSummary(fakePayload().payload, 2, 255, client), null, 'no tafsir in hand, so no summary at all')
})

test('Replay: a card replays its talk from a few seconds before the quote', () => {
  assert.equal(REPLAY_LEAD_SECONDS, 5)
  assert.equal(replayHref('/p/east-london', 3, 17, 493.6), '/p/east-london/course/3?part=17&t=488')
  assert.equal(replayHref('/p/east-london', 3, 17, 2), '/p/east-london/course/3?part=17&t=0')
  assert.equal(replayHref('/p/east-london', null, 17, 40), null)
})

test('Seed: the starter talks with transcripts give harvest items', async () => {
  const { payload } = fakePayload()
  let withItems = 0
  for (const file of starters) if ((await talkHarvest(payload, 1, read(`content/transcripts/starters/${file}`))).length) withItems++
  assert.ok(withItems >= starters.length - 4, `${withItems} of ${starters.length} starter talks have items`)
})

function pick(match: ReturnType<typeof matchQuran>) {
  return match ? [`${match.surah}:${match.ayah}`, match.how] : null
}
