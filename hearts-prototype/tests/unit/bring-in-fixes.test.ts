import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { draftsSkippingApproved } from '../../src/lib/extractor'
import { extractWithFallback } from '../../src/lib/llm'
import { suggestWording } from '../../src/lib/experiment-copy'
import { cleanedTimedTranscript, hiddenFromLearners, interpretYtDlpOutput, isAwaitingTranscript, publishedClockSeconds, speakerForLine, splitBringInLines, ytDlpArgs } from '../../src/lib/youtube'
import { withWorkLock } from '../../src/lib/work-lock'
import { draftCircle } from '../../src/server/circle'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const recorded = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/yt-dlp')

test('a recorded yt-dlp run is not called “no captions” unless yt-dlp says so', () => {
  const help = readFileSync(join(recorded, 'help-print-simulate.txt'), 'utf8')
  assert.match(help, /Implies --simulate unless/)
  assert.match(help, /--no-simulate/)
  const args = ytDlpArgs('B4KtRL_2aXY', '/tmp').join(' ')
  assert.match(args, /--print/)
  assert.match(args, /--no-simulate/)

  const stdout = readFileSync(join(recorded, 'print-only/stdout.txt'), 'utf8')
  const stderr = readFileSync(join(recorded, 'print-only/stderr.txt'), 'utf8')
  const exitCode = readFileSync(join(recorded, 'print-only/exit.txt'), 'utf8').trim()
  const names = readFileSync(join(recorded, 'print-only/files.txt'), 'utf8').split('\n').map((row) => row.trim()).filter(Boolean)
  assert.equal(exitCode, '0')
  assert.equal(names.length, 0)
  assert.match(stderr, /Sign in to confirm/)
  const blocked = interpretYtDlpOutput({ stdout, stderr, code: Number(exitCode) || undefined, files: names.map((name) => ({ name })) })
  assert.equal(blocked.outcome, 'blocked')
  assert.doesNotMatch(blocked.message, /no English captions/)

  const silent = interpretYtDlpOutput({
    stdout: '427\n',
    stderr: 'WARNING: No video formats found!\n',
    code: undefined,
    files: [],
  })
  assert.equal(silent.outcome, 'failed')
  assert.match(silent.message, /not the same as the film having no captions/)
  assert.equal(silent.duration, 427)

  const none = interpretYtDlpOutput({
    stdout: '912\n',
    stderr: 'ERROR: There are no subtitles for the requested languages\n',
    code: 1,
    files: [],
  })
  assert.equal(none.outcome, 'none')
  assert.match(none.message, /no English captions/)
})

test('an integer YouTube length is stored as the published clock', () => {
  assert.equal(publishedClockSeconds(427), 428)
  assert.equal(publishedClockSeconds(3897), 3898)
  assert.equal(publishedClockSeconds(1497), 1498)
  assert.equal(publishedClockSeconds(427.2), 428)
  assert.equal(publishedClockSeconds(null), null)
})

test('bring-in lines can name a speaker, and a film already open is not the default target', () => {
  assert.deepEqual(splitBringInLines('https://youtu.be/aaaaaaaaaaa | Alauddin Elbakri\nhttps://youtu.be/bbbbbbbbbbb | Hani'), [
    { link: 'https://youtu.be/aaaaaaaaaaa', speaker: 'Alauddin Elbakri' },
    { link: 'https://youtu.be/bbbbbbbbbbb', speaker: 'Hani' },
  ])
  assert.equal(speakerForLine('Hani', 'Abdul Malik Merchant', ''), 'Hani')
  assert.equal(speakerForLine('', 'Abdul Malik Merchant', 'Lesson speaker'), 'Abdul Malik Merchant')
  assert.equal(speakerForLine('', '', 'Lesson speaker'), 'Lesson speaker')
  assert.equal(hiddenFromLearners('Bring-in: failed. [lang:ar] broken'), true)
  assert.equal(hiddenFromLearners('Bring-in: waiting. [lang:en] blocked'), true)
  assert.equal(hiddenFromLearners('Bring-in: processed. [lang:en] Captions fetched.'), false)
  assert.equal(isAwaitingTranscript('Bring-in: waiting. [lang:en] blocked'), true)
})

test('a new draft that matches an approved clip is skipped', () => {
  const drafts = draftsSkippingApproved(
    [{ start: 354.2, end: 436.4, id: 'new' }, { start: 10, end: 40, id: 'other' }],
    [{ start: 354, end: 436 }],
  )
  assert.deepEqual(drafts.map((row) => row.id), ['other'])
})

test('identical work waits its turn', async () => {
  let running = 0
  let max = 0
  await Promise.all([1, 2, 3].map(() => withWorkLock('same-sheet', async () => {
    running += 1
    max = Math.max(max, running)
    await new Promise((resolve) => setTimeout(resolve, 30))
    running -= 1
  })))
  assert.equal(max, 1)
})

test('a portal client is used only when asked, and a failed portal extract says so', async () => {
  let calls = 0
  const client = { name: 'portal', complete: async () => { calls += 1; return '{"variants":[{"label":"One"},{"label":"Two"},{"label":"Three"}]}' } }
  const quiet = await suggestWording('lanes-tab-label', 'Lanes', 3, { usePortalAi: false, client })
  assert.equal(calls, 0)
  assert.match(quiet.engine, /built-in/)
  const paid = await suggestWording('lanes-tab-label', 'Lanes', 3, { usePortalAi: true, client })
  assert.equal(calls, 1)
  assert.match(paid.engine, /portal’s AI account/)

  const circleClient = { name: 'portal', complete: async () => { calls += 1; throw new Error('refused') } }
  const circle = await draftCircle({ prompt: 'What stayed with you?', kind: 'reflection' }, 1, ['warm'], ['short'], 1, { usePortalAi: false, client: circleClient })
  assert.equal(calls, 1)
  assert.match(circle.engine, /built-in drafts/)
  assert.doesNotMatch(circle.engine, /call failed/)
  const failedCircle = await draftCircle({ prompt: 'What stayed with you?', kind: 'reflection' }, 1, ['warm'], ['short'], 2, { usePortalAi: true, client: circleClient })
  assert.equal(calls, 2)
  assert.match(failedCircle.engine, /portal AI call failed/)

  const broken = await extractWithFallback('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello there friend.\n', [], {
    client: { name: 'portal', complete: async () => { throw new Error('no credit') } },
  })
  assert.match(broken.notes.join(' '), /portal AI call failed/)
  assert.match(broken.notes.join(' '), /Deterministic extractor used/)
  assert.equal(broken.engine, 'deterministic')
})

test('the production image installs yt-dlp and not ffmpeg', () => {
  const docker = readFileSync(join(root, 'Dockerfile'), 'utf8')
  const rail = readFileSync(join(root, 'railpack.json'), 'utf8')
  assert.match(docker, /node scripts\/get-yt-dlp\.mjs/)
  assert.doesNotMatch(docker, /apt-get install[^\n]*ffmpeg/)
  assert.match(rail, /get-yt-dlp\.mjs/)
  assert.doesNotMatch(rail, /aptPackages[\s\S]*ffmpeg/)
  const desk = readFileSync(join(root, 'src/server/ai-desk.ts'), 'utf8')
  assert.doesNotMatch(desk, /runSpec\(spec, prompt, talk, true\)/)
})

test('the cleaned transcript drops a rolling repeat and keeps the raw text', () => {
  const raw = ['WEBVTT', '', '00:00:00.000 --> 00:00:02.000', 'welcome to another episode of the remastered podcast', '', '00:00:01.500 --> 00:00:04.000', 'another episode of the remastered podcast hosted by myself', ''].join('\n')
  const stored = cleanedTimedTranscript(raw)
  assert.equal(stored.raw, raw)
  assert.match(stored.cleaned, /hosted by myself/)
  assert.doesNotMatch(stored.cleaned, /welcome to another episode of the remastered podcast hosted/)
})
