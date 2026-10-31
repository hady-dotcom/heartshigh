import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  STEP_SPECS,
  bellKey,
  bellText,
  canEditSteps,
  canViewSteps,
  compactSide,
  countNewSince,
  deniedAudit,
  diffLines,
  editAudit,
  filterActivity,
  forkKeep,
  forkRollback,
  forkSave,
  groupPortalChanges,
  liveVersion,
  markLive,
  mockBanner,
  mockOutput,
  nextVersion,
  placeholderProblems,
  pointProtect,
  portalRun,
  promptForPortal,
  runAudit,
  runQueue,
  sameVersions,
  schemaProblems,
  sideBySide,
  stepBySlug,
  stepListBadge,
  STEP_PAGE_COPY,
  stepDoes,
  stepPlainLine,
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

test('the steps list names each step in one line and an honest state', () => {
  for (const step of STEP_SPECS) {
    const line = stepPlainLine(step.slug)
    assert.ok(line.length > 20 && line.length < 90, `${step.slug}: ${line}`)
    assert.equal(line.includes('\n'), false, step.slug)
    assert.equal(line.endsWith('.'), true, step.slug)
  }
  assert.equal(stepListBadge({ inPipeline: true, connected: true, master: false }), 'Ready')
  assert.equal(stepListBadge({ inPipeline: true, connected: false, master: true }), 'Ready')
  assert.equal(stepListBadge({ inPipeline: true, connected: false, master: false }), 'Switch on by connecting your AI account')
  assert.equal(stepListBadge({ inPipeline: false, connected: false, master: false }), 'Shared text')
  assert.equal(stepPlainLine('missing'), '')
})

test('each step page says what it does in three or four plain bullets', () => {
  const banned = /\b(ingest|pipelines?|schemas?|tiers?|tokens?|temperature|providers?|might|perhaps|could|seems|generally|typically|usually|leverage|seamless|robust)\b/i
  for (const step of STEP_SPECS) {
    const does = stepDoes(step.slug)
    assert.ok(does.length >= 3 && does.length <= 4, `${step.slug} has ${does.length} bullets`)
    const shown = [step.description, step.fills, stepPlainLine(step.slug), ...does, ...step.placeholders.map((item) => item.meaning)].join(' ')
    assert.equal(banned.test(shown), false, `${step.slug}: ${shown.match(banned)?.[0]}`)
  }
  const quran = stepDoes('quran-harvest').join(' ')
  assert.match(quran, /exact words/)
  assert.match(quran, /minute/)
  assert.match(quran, /surah/)
  assert.match(quran, /draft/)
  const labels = Object.values(STEP_PAGE_COPY).join(' ')
  assert.equal(banned.test(labels), false, labels.match(banned)?.[0])
  assert.match(labels, /What this does/)
  assert.match(labels, /For techies/)
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

const hearts = (prompt: string, live = true): VersionState => ({
  number: 1,
  prompt,
  provider: 'anthropic',
  model: 'm',
  temperature: 0,
  maxTokens: 100,
  note: 'First version, from the HEARTS prompt set.',
  authorName: 'HEARTS',
  live,
})

const draft = (prompt: string, note: string): Omit<VersionState, 'number' | 'live'> => ({
  prompt,
  provider: 'anthropic',
  model: 'm',
  temperature: 0,
  maxTokens: 100,
  note,
  authorName: 'Amina Yusuf',
})

test('a portal fork does not change the HEARTS version, and a run reads the fork', () => {
  const master = [hearts('Copy the speaker’s words.')]
  const first = forkSave(master, [], draft('Copy the speaker’s words.\nPrefer a line a stranger would repeat.', 'Asked for a line a stranger would repeat'))
  assert.equal(sameVersions(master, first.master), true)
  assert.equal(liveVersion(first.master)?.prompt, 'Copy the speaker’s words.')
  assert.equal(liveVersion(first.portal)?.authorName, 'Amina Yusuf')
  assert.equal(liveVersion(first.portal)?.note, 'Asked for a line a stranger would repeat')
  assert.equal(liveVersion(first.portal)?.number, 1)
  assert.equal(promptForPortal(first.master, first.portal)?.prompt, liveVersion(first.portal)?.prompt)
  assert.notEqual(promptForPortal(first.master, first.portal)?.prompt, liveVersion(first.master)?.prompt)

  const second = forkSave(first.master, first.portal, draft('Shorter still.', 'Cut it down'))
  assert.equal(sameVersions(master, second.master), true)
  assert.equal(liveVersion(second.portal)?.number, 2)
  assert.equal(second.portal.find((version) => version.number === 1)?.live, false)

  const kept = forkKeep(second.master, second.portal, 1)
  assert.equal(sameVersions(master, kept.master), true)
  assert.equal(liveVersion(kept.portal)?.number, 1)
  assert.equal(liveVersion(kept.master)?.prompt, 'Copy the speaker’s words.')
})

test('rolling back the only portal fork returns that portal to HEARTS', () => {
  const master = [hearts('HEARTS wording')]
  const saved = forkSave(master, [], draft('Portal wording', 'A local change'))
  const rolled = forkRollback(saved.master, saved.portal, 1)
  assert.equal(rolled.fellBackToMaster, true)
  assert.equal(liveVersion(rolled.portal), null)
  assert.equal(sameVersions(master, rolled.master), true)
  assert.equal(promptForPortal(rolled.master, rolled.portal)?.prompt, 'HEARTS wording')
  assert.throws(() => forkRollback(master, saved.portal, 9), /not in the history/)
})

test('rolling back the latest portal fork restores the previous portal wording', () => {
  const master = [hearts('HEARTS wording')]
  const first = forkSave(master, [], draft('First local wording', 'First')).portal
  const second = forkSave(master, first, draft('Second local wording', 'Second')).portal
  const rolled = forkRollback(master, second, 2)
  assert.equal(rolled.fellBackToMaster, false)
  assert.equal(rolled.changedLive, true)
  assert.equal(liveVersion(rolled.portal)?.prompt, 'First local wording')
  assert.equal(liveVersion(rolled.master)?.prompt, 'HEARTS wording')
  const untouched = forkRollback(master, second, 1)
  assert.equal(untouched.changedLive, false)
  assert.equal(liveVersion(untouched.portal)?.prompt, 'Second local wording')
})

test('edits, runs and denied edits are ai. audit entries, and a portal edit records who and the note', () => {
  const edit = editAudit({ actorId: 4, actorRole: 'portal-admin', portalId: 2, slug: 'hors-doeuvre', version: 1, note: 'Asked for a shorter opening', authorName: 'Amina Yusuf' })
  assert.equal(edit.event, 'ai.step.version')
  assert.equal(edit.fields.actorRole, 'portal-admin')
  assert.equal(edit.fields.portal, 2)
  assert.equal(edit.fields.reason, 'Asked for a shorter opening')
  const detail = edit.fields.detail as { authorName: string; authorRole: string; forked: boolean }
  assert.equal(detail.authorName, 'Amina Yusuf')
  assert.equal(detail.authorRole, 'portal-admin')
  assert.equal(detail.forked, true)

  const denied = deniedAudit({ actorId: 4, actorRole: 'portal-admin', portalId: 2, reason: 'The master has not granted editing.' })
  assert.equal(denied.event, 'ai.step.denied')
  assert.match(denied.fields.reason, /not granted/)

  const run = runAudit({ actorId: 4, actorRole: 'portal-admin', portalId: 2, slug: 'hors-doeuvre', lessonId: 9, ok: false, error: 'This talk has no transcript yet.' })
  assert.equal(run.event, 'ai.step.run')
  assert.equal((run.fields.detail as { ok: boolean }).ok, false)
  assert.match(run.fields.reason, /no transcript/)
  assert.equal([edit.event, denied.event, run.event].every((event) => event.startsWith('ai.')), true)
})

test('portal changes group by portal, and one hundred edits share one bell for that day', () => {
  const rows = [
    { portalId: 2, portalName: 'Leeds', stepSlug: 'rubric', at: '2026-10-14T09:00:00.000Z' },
    { portalId: 1, portalName: 'East London Mosque', stepSlug: 'rubric', at: '2026-10-14T08:00:00.000Z' },
    { portalId: 2, portalName: 'Leeds', stepSlug: 'hors-doeuvre', at: '2026-10-14T12:00:00.000Z' },
  ]
  const groups = groupPortalChanges(rows)
  assert.equal(groups[0].portalName, 'Leeds')
  assert.equal(groups[0].count, 2)
  assert.deepEqual(groups[0].items.map((item) => item.stepSlug), ['hors-doeuvre', 'rubric'])
  const leedsOnly = filterActivity(rows, { portalId: 2, stepSlug: 'hors-doeuvre', day: '2026-10-14' })
  assert.equal(leedsOnly.length, 1)
  assert.equal(filterActivity(rows, { day: '2026-10-15' }).length, 0)
  assert.equal(countNewSince(rows.map((row) => row.at), '2026-10-14T10:00:00.000Z'), 1)
  assert.equal(countNewSince(rows.map((row) => row.at), null), 3)

  const keys = new Set(Array.from({ length: 100 }, () => bellKey(2, '2026-10-14')))
  assert.equal(keys.size, 1)
  assert.equal(bellText('Leeds', 12).title, 'Leeds portal changed 12 steps today')
  assert.match(bellText('Leeds', 12).body, /grouped/)
  assert.equal(bellText('East London Mosque', 1).title, 'East London Mosque portal changed 1 step today')
})

test('a side by side diff highlights the added and removed lines', () => {
  const pair = sideBySide('keep\nold line\nstay', 'keep\nnew line\nstay')
  assert.equal(pair.before.find((line) => line.kind === 'del')?.text, 'old line')
  assert.equal(pair.after.find((line) => line.kind === 'add')?.text, 'new line')
  const compact = compactSide(`${'same\n'.repeat(30)}old`, `${'same\n'.repeat(30)}new`)
  assert.equal(compact.before.some((line) => line.kind === 'del'), true)
  assert.equal(compact.after.some((line) => line.kind === 'add'), true)
  assert.equal(compact.before.filter((line) => line.kind === 'same').length < 10, true)
  assert.ok(compact.omitted > 10)
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
