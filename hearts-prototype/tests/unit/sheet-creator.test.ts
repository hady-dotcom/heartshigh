import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyCatalogue, planCounts, planSheet, readWorkbook } from '../../src/lib/master-sheet'
import { draftResources, draftTalk } from '../../src/lib/sheet-draft'
import { parseIsoDuration, parsePastedSources, searchTalks, type TalkCandidate } from '../../src/lib/sheet-search'

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
  assert.deepEqual(plan.errors, [])
  const created = plan.ops.filter((op) => op.op === 'lesson.create')
  assert.equal(created.length, 2)
  assert.equal(created[0].op === 'lesson.create' ? created[0].vimeoId : '', '76979871')
  assert.equal(created[0].op === 'lesson.create' ? created[0].provider : '', 'vimeo')
  assert.equal(created[1].op === 'lesson.create' ? created[1].mediaId : 0, 4)
  assert.equal(created[1].op === 'lesson.create' ? created[1].provider : '', 'file')
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
