import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyCatalogue, planCounts, planSheet, readWorkbook } from '../../src/lib/master-sheet'
import { draftResources, draftTalk } from '../../src/lib/sheet-draft'
import { creatorMinSeconds, parseIsoDuration, parsePastedSources, searchTalks, type TalkCandidate } from '../../src/lib/sheet-search'
import { collectCreatorSources, draftOne, draftSources, NO_CAPTIONS, TOO_LONG } from '../../src/server/sheet-creator'

const CAPTIONS = `WEBVTT

00:00:02.000 --> 00:00:06.000
The light of the name is something you can sit with.

00:00:08.000 --> 00:00:13.000
But the heart only settles when that light is received.

00:00:16.000 --> 00:00:21.000
Carry the light into the evening and let it stay with you.
`

test('search keeps films inside the length window and can use a mocked YouTube response', async () => {
  const fixture: TalkCandidate[] = [
    { provider: 'youtube', id: 'aaaaaaaaaaa', title: 'Short', channel: 'A', durationSeconds: 30, thumbnail: null, captions: 'no', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' },
    { provider: 'youtube', id: 'bbbbbbbbbbb', title: 'Right', channel: 'A', durationSeconds: 600, thumbnail: 'https://example.com/t.jpg', captions: 'yes', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' },
    { provider: 'youtube', id: 'ccccccccccc', title: 'Long', channel: 'A', durationSeconds: 5000, thumbnail: null, captions: 'unknown', url: 'https://www.youtube.com/watch?v=ccccccccccc' },
    { provider: 'youtube', id: 'ddddddddddd', title: 'Unknown', channel: 'A', durationSeconds: null, thumbnail: null, captions: 'unknown', url: 'https://www.youtube.com/watch?v=ddddddddddd' },
  ]
  const found = await searchTalks({ topic: 'light', minSeconds: 60, maxSeconds: 1200, limit: 8 }, { fixture })
  assert.equal(found.ok, true)
  if (!found.ok) return
  assert.deepEqual(found.candidates.map((item) => item.id), ['bbbbbbbbbbb'])
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723)

  const calls: string[] = []
  const mocked = await searchTalks({ topic: 'nur', limit: 2 }, {
    fixture: null,
    apiKey: 'test-key',
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/search')) {
        return new Response(JSON.stringify({ items: [{ id: { videoId: 'eeeeeeeeeee' } }] }), { status: 200 })
      }
      return new Response(JSON.stringify({
        items: [{ id: 'eeeeeeeeeee', snippet: { title: 'Nur', channelTitle: 'The circle', thumbnails: { medium: { url: 'https://example.com/n.jpg' } } }, contentDetails: { duration: 'PT10M', caption: 'true' } }],
      }), { status: 200 })
    }) as typeof fetch,
  })
  assert.equal(mocked.ok, true)
  if (!mocked.ok) return
  assert.equal(mocked.via, 'youtube')
  assert.equal(mocked.candidates[0].durationSeconds, 600)
  assert.equal(mocked.candidates[0].captions, 'yes')
  assert.equal(mocked.candidates[0].channel, 'The circle')
  assert.equal(calls.length, 2)
})

test('pasted lines accept YouTube and Vimeo, and a file source is planned as provider file', async () => {
  const pasted = parsePastedSources('https://vimeo.com/76979871\nhttps://www.youtube.com/watch?v=NIR88RRpat4\n')
  assert.equal(pasted.ok, true)
  if (!pasted.ok) return
  assert.deepEqual(pasted.sources.map((source) => source.provider), ['vimeo', 'youtube'])
  assert.equal(pasted.sources[0].id, '76979871')

  const vimeo = draftTalk({ provider: 'vimeo', id: '76979871', title: 'A circle on Vimeo', durationSeconds: 400 }, { topic: 'light', course: 'The Names', part: 'Talks' })
  const file = draftTalk({ provider: 'file', id: '4', mediaId: 4, title: 'Circle recording', durationSeconds: 90 }, { topic: 'light', course: 'The Names', part: 'Talks' })
  assert.equal(vimeo.needsTranscript, true)
  assert.equal(vimeo.talk.provider, 'vimeo')
  assert.equal(vimeo.talk.vimeo_id, '76979871')
  assert.match(String(vimeo.talk.notes), /Needs transcript/)
  assert.equal(vimeo.talk.hook_text, null)
  assert.equal(file.talk.provider, 'file')
  assert.equal(file.talk.media_id, 4)

  const catalogue = emptyCatalogue({ courses: [{ id: 1, title: 'The Names', origin: 'master', portal: null, speaker: '', inScope: true }] })
  const plan = planSheet(await readWorkbook(await (await import('../../src/lib/master-sheet')).buildWorkbook({ talks: [vimeo.talk, file.talk], questions: [], resources: [] })), catalogue)
  assert.equal(plan.errors.length, 1)
  assert.match(plan.errors[0].message, /This talk is 1:30\. Talks need to be at least 5 minutes\./)
  const created = plan.ops.filter((op) => op.op === 'lesson.create')
  assert.equal(created.length, 1)
  assert.equal(created[0].op === 'lesson.create' ? created[0].vimeoId : '', '76979871')
  assert.equal(created[0].op === 'lesson.create' ? created[0].provider : '', 'vimeo')
  assert.equal(plan.ops.some((op) => op.op === 'lesson.create' && op.provider === 'file'), false)
})

test('resource drafts include a summary, timestamped quotes, a reading to verify and a discussion guide', () => {
  const rows = draftResources({ topic: 'the name of light', title: 'The light of the name', transcript: CAPTIONS, lines: [{ at: 2, text: 'The light of the name is something you can sit with.' }] })
  assert.ok(rows.some((row) => row.kind === 'summary' && /captions/i.test(row.body)))
  assert.ok(rows.some((row) => row.kind === 'quote' && /0:02/.test(row.body) && /light of the name/.test(row.body)))
  assert.ok(rows.some((row) => row.kind === 'reading' && /Verify before sharing/.test(row.body)))
  assert.ok(rows.some((row) => row.kind === 'guide' && /hear again/.test(row.body)))

  const drafted = draftTalk(
    { provider: 'youtube', id: 'ccccccccccc', title: 'The light of the name', channel: 'Mikaeel Smith', durationSeconds: 640, transcript: CAPTIONS },
    { topic: 'the name of light', course: 'The Names', part: 'Talks' },
    { resources: () => [{ label: 'Summary', kind: 'summary', body: 'A mock summary for the test.' }] },
  )
  assert.equal(drafted.needsTranscript, false)
  assert.equal(drafted.resources[0].body, 'A mock summary for the test.')
  const task = drafted.questions.find((row) => row.type === 'task')
  assert.equal(task?.due_days, 7)
  assert.equal(task?.evidence, 'note')
  assert.equal(task?.show_imam, 'yes')
  assert.equal(task?.status, 'draft')
  assert.ok(drafted.questions.some((row) => row.place === 'workbook'))
  assert.equal(drafted.talk.status, 'draft')
})

test('a drafted sheet stays a draft until it is applied, including the activation task', async () => {
  const { buildWorkbook } = await import('../../src/lib/master-sheet')
  const drafted = draftTalk(
    { provider: 'youtube', id: 'ccccccccccc', title: 'The light of the name', channel: 'Mikaeel Smith', speaker: 'Mikaeel Smith', durationSeconds: 640, transcript: CAPTIONS },
    { topic: 'light', course: 'The Names', part: 'Talks', seats: [{ clause: 22, position: 1 }] },
  )
  const catalogue = emptyCatalogue({
    courses: [{ id: 1, title: 'The Names', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true }],
    seats: [{ id: 9, clause: 22, position: 1 }],
  })
  const plan = planSheet(await readWorkbook(await buildWorkbook({ talks: [drafted.talk], questions: drafted.questions, resources: drafted.resources })), catalogue)
  assert.deepEqual(plan.errors.map((issue) => `${issue.column}: ${issue.message}`), [])
  const counts = planCounts(plan)
  assert.ok(counts.create > 0)
  assert.equal(counts.update, 0)
  const point = plan.ops.find((op) => op.op === 'point.create' && op.data.kind === 'task')
  assert.ok(point && point.op === 'point.create')
  if (!point || point.op !== 'point.create') return
  assert.equal(point.data.status, 'draft')
  assert.equal(point.data.dueDays, 7)
  assert.equal(point.data.evidence, 'note')
  assert.equal(point.data.showImam, true)
  assert.equal(point.data.family, 'task')
  assert.ok(plan.ops.some((op) => op.op === 'resource.create' && op.data.kind === 'reading'))
  assert.ok(plan.ops.every((op) => op.op !== 'point.create' || op.data.status === 'draft'))
})

test('a blank shortest is five minutes, and yt-dlp search drops shorter films once captions are known', async () => {
  assert.equal(creatorMinSeconds(null), 300)
  assert.equal(creatorMinSeconds(undefined), 300)
  assert.equal(creatorMinSeconds(60), 60)

  const found = await searchTalks({ topic: 'patience', minSeconds: creatorMinSeconds(null) }, {
    fixture: null,
    apiKey: '',
    ytdlp: async () => [
      { provider: 'youtube', id: 'hascaps0001', title: 'Patience in the evening', channel: 'The circle', durationSeconds: 640, thumbnail: null, captions: 'unknown', url: 'https://www.youtube.com/watch?v=hascaps0001' },
      { provider: 'youtube', id: 'nocaps00001', title: 'A talk with no captions', channel: 'The circle', durationSeconds: 720, thumbnail: null, captions: 'unknown', url: 'https://www.youtube.com/watch?v=nocaps00001' },
      { provider: 'youtube', id: 'tooshort001', title: 'A ninety second clip', channel: 'The circle', durationSeconds: 89, thumbnail: null, captions: 'yes', url: 'https://www.youtube.com/watch?v=tooshort001' },
    ],
    captions: async (id) => (id === 'hascaps0001' ? 'yes' : 'no'),
  })
  assert.equal(found.ok, true)
  if (!found.ok) return
  assert.equal(found.via, 'yt-dlp')
  assert.deepEqual(found.candidates.map((item) => [item.id, item.captions]), [['hascaps0001', 'yes'], ['nocaps00001', 'no']])
})

test('ticked talks and pasted links are read together, and a bad payload says so', () => {
  const merged = collectCreatorSources({
    sources: JSON.stringify([{ provider: 'youtube', id: 'ccccccccccc', title: 'The light of the name' }]),
    pasted: 'https://vimeo.com/76979871',
  })
  assert.equal(merged.ok, true)
  if (!merged.ok) return
  assert.deepEqual(merged.sources.map((source) => source.provider), ['youtube', 'vimeo'])

  const shaped = collectCreatorSources({ sources: { nope: true }, pasted: '' })
  assert.equal(shaped.ok, false)
  if (shaped.ok) return
  assert.match(shaped.error, /shape the desk could read/)

  const empty = collectCreatorSources({ sources: [], pasted: '   ' })
  assert.equal(empty.ok, false)
  if (empty.ok) return
  assert.match(empty.error, /Choose at least one talk/)
})

test('a talk with no captions stays in the draft, and the rest are still built', async () => {
  const previous = process.env.HEARTS_TRANSCRIPT_FIXTURE
  process.env.HEARTS_TRANSCRIPT_FIXTURE = JSON.stringify({ ccccccccccc: CAPTIONS })
  const payload = { find: async () => ({ docs: [] }) }
  try {
    const drafted = await draftSources(payload as never, {
      topic: 'light',
      course: 'The Names',
      part: 'Talks',
      sources: [
        { provider: 'youtube', id: 'ccccccccccc', title: 'The light of the name', durationSeconds: 640 },
        { provider: 'youtube', id: 'nocaps00001', title: 'A talk with no captions', durationSeconds: 720 },
      ],
    })
    assert.equal(drafted.talks.length, 2)
    assert.equal(drafted.results[1].included, true)
    assert.equal(drafted.results[1].detail, NO_CAPTIONS)
    assert.equal(drafted.results[1].talk?.hors_in, null)
    assert.equal(drafted.results[0].warn, false)
  } finally {
    if (previous == null) delete process.env.HEARTS_TRANSCRIPT_FIXTURE
    else process.env.HEARTS_TRANSCRIPT_FIXTURE = previous
  }
})

test('a caption read that runs too long still keeps the talk', { timeout: 10_000 }, async () => {
  const previousFixture = process.env.HEARTS_TRANSCRIPT_FIXTURE
  const previousBin = process.env.YT_DLP_PATH
  delete process.env.HEARTS_TRANSCRIPT_FIXTURE
  process.env.YT_DLP_PATH = new URL('../fixtures/sheet-creator/slow-yt-dlp.mjs', import.meta.url).pathname
  const payload = { find: async () => ({ docs: [] }) }
  try {
    const one = await draftOne(payload as never, { topic: 'light', course: 'The Names', part: 'Talks' }, {
      provider: 'youtube', id: 'hascaps0001', title: 'Patience in the evening', durationSeconds: 640,
    }, { captionTimeoutMs: 400, seats: [] })
    assert.equal(one.included, true)
    assert.equal(one.detail, TOO_LONG)
    assert.equal(one.talk?.hors_in, null)
  } finally {
    if (previousFixture == null) delete process.env.HEARTS_TRANSCRIPT_FIXTURE
    else process.env.HEARTS_TRANSCRIPT_FIXTURE = previousFixture
    if (previousBin == null) delete process.env.YT_DLP_PATH
    else process.env.YT_DLP_PATH = previousBin
  }
})
