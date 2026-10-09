import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  STEP_SPECS,
  canEditSteps,
  canViewSteps,
  diffLines,
  liveVersion,
  markLive,
  mockBanner,
  mockOutput,
  nextVersion,
  placeholderProblems,
  pointProtect,
  portalRun,
  runQueue,
  schemaProblems,
  stepBySlug,
  tierProtect,
  type TalkContext,
  type VersionState,
} from './ai-steps'

const talk = (transcript: string): TalkContext => ({
  title: 'A short sitting',
  speaker: 'A speaker',
  duration: 180,
  transcript,
  hook: '',
  turn: '',
  land: '',
  landAt: 40,
  clauseCards: '30. Worship as though you see Him\nTEACHING. The act is done as seeing.\nSEATS. none printed',
  rubric: 'Score four axes. Most clips are 3s.',
  clip: 's1: The heart stays with the one who just walked in.',
})

const transcript = [
  '**[0:02]** Imagine you are sitting with people who came only to listen.',
  '**[0:16]** The heart stays with the one who just walked in from the cold.',
  '**[0:34]** But ease is not the same thing as leaving the work undone.',
  '**[0:52]** He sees you when the room has gone quiet and nobody is performing.',
  '**[1:12]** That is the line I want you to carry into the week ahead.',
  '**[1:30]** A stranger can follow it without having heard the hour before.',
].join('\n')

test('every seeded step names its placeholders, and the prompt uses them', () => {
  assert.equal(STEP_SPECS.length, 13)
  for (const step of STEP_SPECS) {
    assert.equal(placeholderProblems(step.prompt, step.placeholders).join('; '), '', step.slug)
    assert.ok(step.description.length > 40, step.slug)
    assert.ok(step.fills.length > 10, step.slug)
    assert.equal(placeholderProblems(`${step.prompt}\n{{NOT_A_SLOT}}`, step.placeholders).some((problem) => problem.includes('NOT_A_SLOT')), true, step.slug)
  }
  const hors = stepBySlug('hors-doeuvre')!
  assert.match(placeholderProblems(hors.prompt.replace('{{TRANSCRIPT}}', ''), hors.placeholders).join(' '), /TRANSCRIPT/)
})

test('a prompt edit adds a version, and rollback marks an older one live', () => {
  const first: VersionState = { number: 1, prompt: 'one', provider: 'anthropic', model: 'm', temperature: 0, maxTokens: 100, note: 'First', authorName: 'HEARTS', live: true }
  const saved = nextVersion([first], { prompt: 'two', provider: 'openai', model: 'm2', temperature: 0.2, maxTokens: 200, note: 'Tightened the land rule', authorName: 'Leon' })
  assert.equal(saved.length, 2)
  assert.equal(saved[1].number, 2)
  assert.equal(saved[1].live, false)
  assert.equal(liveVersion(saved)?.number, 1)
  const rolled = markLive(saved, 1)
  assert.equal(liveVersion(rolled)?.prompt, 'one')
  assert.equal(rolled.find((version) => version.number === 2)?.live, false)
  const promoted = markLive(saved, 2)
  assert.equal(liveVersion(promoted)?.note, 'Tightened the land rule')
  assert.throws(() => markLive(saved, 9), /not in the history/)
})

test('a diff shows the added and removed lines', () => {
  const diff = diffLines('keep\nold line\nstay', 'keep\nnew line\nstay')
  assert.deepEqual(
    diff.filter((line) => line.kind !== 'same').map((line) => `${line.kind}:${line.text}`),
    ['del:old line', 'add:new line'],
  )
})

test('approved and hand-edited tiers are protected, machine drafts are not', () => {
  const fields = ['horsQuote']
  assert.equal(tierProtect({ status: 'checked', horsQuote: 'a' }, { horsQuote: 'a' }, fields), 'approved')
  assert.equal(tierProtect({ status: 'rejected', horsQuote: 'a' }, null, fields), 'rejected')
  assert.equal(tierProtect({ status: 'draft', source: 'human', horsQuote: 'a' }, { horsQuote: 'a' }, fields), 'human-edited')
  assert.equal(tierProtect({ status: 'draft', source: 'ai:hors-doeuvre@v1', horsQuote: 'edited' }, { horsQuote: 'original' }, fields), 'human-edited')
  assert.equal(tierProtect({ status: 'draft', source: 'captions.vtt', horsQuote: 'a' }, null, fields), null)
  assert.equal(tierProtect(null, null, fields), null)
  assert.equal(pointProtect({ status: 'published' }), 'approved')
  assert.equal(pointProtect({ status: 'draft', author: 4, draftNote: 'AI draft from popup-drafter v1' }), 'human-edited')
  assert.equal(pointProtect({ status: 'draft', draftNote: 'AI draft from reflection-prompts v2. Needs a human check.' }), null)
  assert.equal(pointProtect({ status: 'draft', draftNote: 'Written on the master desk.' }), 'human-edited')
})

test('the mock is deterministic, matches each schema, and a different prompt can pick a different cut', () => {
  const context = talk(transcript)
  for (const step of STEP_SPECS) {
    const once = mockOutput(step, context, step.prompt)
    const twice = mockOutput(step, context, step.prompt)
    assert.deepEqual(twice, once, step.slug)
    assert.deepEqual(schemaProblems(step.outputSchema as never, once), [], `${step.slug}: ${schemaProblems(step.outputSchema as never, once).join('; ')}`)
  }
  const hors = stepBySlug('hors-doeuvre')!
  const base = mockOutput(hors, context, hors.prompt) as { quote: string }
  let moved = base.quote
  for (let index = 0; index < 12 && moved === base.quote; index++) moved = (mockOutput(hors, context, `${hors.prompt}\nvariant ${index}`) as { quote: string }).quote
  assert.notEqual(moved, base.quote)
  assert.throws(() => mockOutput(hors, talk('   '), hors.prompt), /no transcript/)
})

test('a job reports progress after each talk and keeps the error', async () => {
  const seen: { finished: number; failed: number }[] = []
  const result = await runQueue(
    [{ id: 1 }, { id: 2 }, { id: 3 }],
    async (item) => {
      if (item.id === 2) throw new Error('This talk has no transcript yet.')
      return { ok: true }
    },
    async (progress) => {
      seen.push({ finished: progress.finished, failed: progress.failed })
    },
  )
  assert.deepEqual(seen, [
    { finished: 1, failed: 0 },
    { finished: 2, failed: 1 },
    { finished: 3, failed: 1 },
  ])
  assert.equal(result.failed, 1)
  assert.match(result.results[1].error || '', /no transcript/)
  assert.equal(result.results[0].ok, true)
})

test('portal admins can read, and can edit only after the master grants it', () => {
  assert.equal(canViewSteps({ role: 'portal-admin' }), true)
  assert.equal(canViewSteps({ role: 'teacher' }), false)
  assert.equal(canViewSteps({ role: 'learner' }), false)
  assert.equal(canEditSteps({ role: 'master' }, false), true)
  assert.equal(canEditSteps({ role: 'portal-admin' }, false), false)
  assert.equal(canEditSteps({ role: 'portal-admin' }, true), true)
  assert.equal(canEditSteps({ role: 'teacher' }, true), false)
})

test('a server key never makes a step live; only a portal connection does', () => {
  assert.equal(portalRun(false), 'mock')
  assert.equal(portalRun(true), 'live')
  assert.match(mockBanner({ connected: false, master: true }), /master desk does not call a model/)
  assert.match(mockBanner({ connected: false, master: false }), /AI is off/)
  assert.match(mockBanner({ connected: true, master: false }), /own AI account/)
  assert.equal(JSON.stringify(mockBanner({ connected: true, master: false })).includes('sk-'), false)
})
