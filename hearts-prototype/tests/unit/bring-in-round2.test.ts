import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { test } from 'node:test'
import {
  bringInSourceKind,
  clockFromListed,
  decideBringInWrite,
  ghunyaHeading,
  jibrilSection,
  markBringInSkips,
  parseFlatPlaylistLine,
  speakerForCandidate,
} from '../../src/lib/bring-in-plan'
import { hashHelperToken, helperRateOk, helperTokenAllows, helperTokenMatches, newHelperToken, resetHelperRates } from '../../src/lib/helper-token'
import { packSaveNotice, publishNotice } from '../../src/lib/publish-state'
import { punctuateTimedCues } from '../../src/lib/punctuate'
import { hiddenFromLearners, noteAfterTranscriptUpload, transcriptFor } from '../../src/lib/youtube'
import { giveCourseToPackHolders } from '../../src/server/publish-holders'
import { withWorkLock } from '../../src/lib/work-lock'
import { attachDecision, helperGapMs, punctuateTranscript } from '../../scripts/bring-in-helper/plan'
import { readFileSync } from 'node:fs'

const execFileAsync = promisify(execFile)
const fixture = path.join(process.cwd(), 'tests/fixtures/bring-in/yt-dlp.mjs')

test('skip rules, speakers, doors and playlist lines', () => {
  assert.equal(bringInSourceKind('https://www.youtube.com/watch?v=B4KtRL_2aXY'), 'video')
  assert.equal(bringInSourceKind('https://www.youtube.com/playlist?list=PLheartsround2'), 'playlist')
  assert.equal(bringInSourceKind('https://www.youtube.com/@hearts'), 'channel')
  assert.equal(bringInSourceKind('https://example.com/watch?v=B4KtRL_2aXY'), 'bad')
  assert.equal(jibrilSection('w10'), 'W10')
  assert.equal(jibrilSection('W20'), 'W20')
  assert.equal(jibrilSection('W21'), '')
  assert.equal(jibrilSection('door'), '')
  assert.equal(ghunyaHeading('  The   heart <b>at rest</b>  '), 'The heart at rest')
  assert.equal(clockFromListed(89), 90)
  assert.equal(clockFromListed(427), 428)
  const parsed = parseFlatPlaylistLine('short000001\tA short clip\t89\tHEARTS channel\tUCheartsround\tyes')
  assert.equal(parsed?.captions, 'yes')
  assert.equal(parsed?.durationRaw, 89)
  const rows = markBringInSkips(
    [
      { id: 'long0000001', url: 'https://youtu.be/long0000001', title: 'Long', durationSeconds: 428, channel: 'HEARTS channel', channelId: 'UCheartsround', captions: 'yes', lineSpeaker: 'Hani' },
      { id: 'short000001', url: 'https://youtu.be/short000001', title: 'Short', durationSeconds: 90, channel: 'HEARTS channel', channelId: 'UCheartsround', captions: 'yes', lineSpeaker: '' },
      { id: 'long0000001', url: 'https://youtu.be/long0000001', title: 'Long again', durationSeconds: 428, channel: 'HEARTS channel', channelId: 'UCheartsround', captions: 'yes', lineSpeaker: '' },
      { id: 'known000001', url: 'https://youtu.be/known000001', title: 'Known', durationSeconds: 600, channel: 'HEARTS channel', channelId: 'UCheartsround', captions: 'no', lineSpeaker: '' },
    ],
    new Set(['known000001']),
  )
  assert.equal(rows[0].selected, true)
  assert.equal(rows[1].skipReason, 'short')
  assert.equal(rows[1].selected, false)
  assert.equal(rows[2].skipReason, 'duplicate')
  assert.equal(rows[3].skipReason, 'library')
  assert.equal(speakerForCandidate({ lineSpeaker: 'Hani', courseSpeaker: 'Alauddin Elbakri', channel: 'HEARTS channel', channelMap: [{ channelKey: 'UCheartsround', speaker: 'Mapped' }] }), 'Hani')
  assert.equal(speakerForCandidate({ courseSpeaker: 'Alauddin Elbakri', channel: 'HEARTS channel', channelMap: [{ channelKey: 'UCheartsround', speaker: 'Mapped' }] }), 'Alauddin Elbakri')
  assert.equal(speakerForCandidate({ channel: 'HEARTS channel', channelId: 'UCheartsround', channelMap: [{ channelKey: 'UCheartsround', speaker: 'Mapped' }] }), 'Mapped')
  assert.equal(speakerForCandidate({ channel: 'HEARTS channel' }), '')
})

test('a blocked or caption-less film waits, and a fetched film is saved', () => {
  const waiting = decideBringInWrite({ ok: false, id: 'abc', error: 'YouTube asked this server to sign in.', captionOutcome: 'blocked', meta: null, needsTranscript: true, tried: [], durationSeconds: null }, true, 'en')
  assert.equal(waiting.bucket, 'waiting')
  assert.match(waiting.note, /^Bring-in: waiting/)
  const none = decideBringInWrite({ ok: false, id: 'abc', error: 'This film has no English captions on YouTube.', captionOutcome: 'none', meta: null, needsTranscript: true, tried: [], durationSeconds: null }, true, 'en')
  assert.equal(none.bucket, 'waiting')
  assert.match(none.note, /no English captions/)
  const saved = decideBringInWrite({ ok: true, id: 'abc', transcript: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello.\n', provider: 'yt-dlp', tried: [], durationSeconds: 2, captionOutcome: 'captions', meta: { id: 'abc', title: 'Hello', author: '', thumbnail: '' } }, true, 'en')
  assert.equal(saved.bucket, 'saved')
  assert.equal(hiddenFromLearners(saved.note), false)
})

test('the bot wall stops caption providers before they run', async () => {
  const previous = process.env.HEARTS_CAPTION_BOT_WALL
  process.env.HEARTS_CAPTION_BOT_WALL = '1'
  let called = false
  const result = await transcriptFor('B4KtRL_2aXY', [{ name: 'should-not-run', fetch: async () => { called = true; return 'WEBVTT' } }])
  if (previous == null) delete process.env.HEARTS_CAPTION_BOT_WALL
  else process.env.HEARTS_CAPTION_BOT_WALL = previous
  assert.equal(called, false)
  assert.equal(result.outcome, 'blocked')
  assert.equal(result.transcript, null)
})

test('pauses become sentences, and a helper token only lists and attaches', () => {
  const cues = punctuateTimedCues([
    { start: 0, end: 2, text: 'the light enters the heart' },
    { start: 3.2, end: 5.5, text: 'sit with that for a moment' },
  ])
  assert.equal(cues[0].text, 'The light enters the heart.')
  assert.equal(cues[1].text, 'Sit with that for a moment.')
  const vtt = punctuateTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\npeople gather and listen\n\n00:00:04.200 --> 00:00:06.500\nthe salah keeps a heart soft\n')
  assert.match(vtt, /People gather and listen\./)
  assert.match(vtt, /The salah keeps a heart soft\./)
  assert.equal(helperTokenAllows('GET', '/api/hearts/awaiting-transcript'), true)
  assert.equal(helperTokenAllows('POST', '/api/hearts/awaiting-transcript'), true)
  assert.equal(helperTokenAllows('DELETE', '/api/hearts/awaiting-transcript'), false)
  assert.equal(helperTokenAllows('GET', '/api/hearts/bring-in-status'), false)
  assert.equal(helperTokenAllows('POST', '/api/lessons'), false)
  const minted = newHelperToken()
  assert.match(minted.secret, /^hlp_[0-9a-f]{48}$/)
  assert.equal(minted.secret.includes(minted.hash), false)
  assert.equal(helperTokenMatches(minted.secret, minted.hash), true)
  assert.equal(hashHelperToken(minted.secret), minted.hash)
  resetHelperRates()
  for (let index = 0; index < 30; index++) assert.equal(helperRateOk(7, 30, 60_000, 1_000), true)
  assert.equal(helperRateOk(7, 30, 60_000, 1_000), false)
  assert.equal(helperRateOk(7, 30, 60_000, 70_000), true)
  resetHelperRates()
  assert.equal(attachDecision(200), 'attached')
  assert.equal(attachDecision(409), 'already')
  assert.equal(attachDecision(403), 'denied')
  assert.equal(attachDecision(429), 'retry')
  assert.equal(helperGapMs(undefined), 2000)
  assert.equal(helperGapMs('0'), 0)
})

test('desk messages say who will see a publish or a pack change', () => {
  const published = publishNotice({ published: 1, stillHidden: 0, give: false, coursesInPack: 1, holdersUpdated: 0, holdersLive: 0 })
  assert.match(published, /Published 1 talk/)
  assert.match(published, /left as they are/)
  assert.doesNotMatch(published, /see the change now/)
  const given = publishNotice({ published: 2, stillHidden: 1, give: true, coursesInPack: 1, holdersUpdated: 3, holdersLive: 1 })
  assert.match(given, /still waiting/)
  assert.match(given, /Added this course to 3 learners/)
  const pack = packSaveNotice({ added: 1, give: false, holdersUpdated: 0, holdersLive: 0 })
  assert.match(pack, /^Pack updated\./)
  assert.match(pack, /keep the course list they had/)
  const pushed = packSaveNotice({ added: 1, give: true, holdersUpdated: 2, holdersLive: 4 })
  assert.match(pushed, /Added the new course to 2 learners/)
  assert.match(pushed, /4 already read the pack live/)
  const kept = noteAfterTranscriptUpload('Bring-in: waiting. [lang:en] blocked', 'notes.vtt')
  assert.match(kept.transcriptNote, /Uploaded from notes\.vtt/)
  assert.equal(kept.hidden, false)
  const draft = noteAfterTranscriptUpload('Bring-in: waiting. [lang:en] blocked', 'notes.vtt', 'draft')
  assert.equal(draft.hidden, true)
  assert.match(draft.notice, /still a draft/)
})

test('giving a course reaches a saved list, including one stored as text, and leaves a live reader alone', async () => {
  const users = [
    { id: 1, role: 'learner', accessCode: 9, courseList: '[1]', extraPacks: [] },
    { id: 2, role: 'learner', accessCode: 9, courseList: null, extraPacks: [] },
    { id: 3, role: 'learner', accessCode: 9, courseList: [1, 5], extraPacks: [] },
    { id: 4, role: 'teacher', accessCode: 9, courseList: '[]', extraPacks: [] },
  ]
  const payload = {
    async find({ collection, where }: { collection: string; where?: { and?: { role?: { equals?: string } }[]; courses?: { in?: number[] } } }) {
      if (collection === 'packs') return { docs: [{ id: 4, courses: [5] }], hasNextPage: false }
      if (collection === 'access-codes') return { docs: [{ id: 9, packs: [4] }], hasNextPage: false }
      if (collection === 'users') {
        const role = where?.and?.find((row) => row.role?.equals)?.role?.equals
        return { docs: users.filter((user) => !role || user.role === role), hasNextPage: false }
      }
      return { docs: [], hasNextPage: false }
    },
    async update({ collection, id, data }: { collection: string; id: number; data: { courseList: number[] } }) {
      assert.equal(collection, 'users')
      const user = users.find((row) => row.id === id)
      assert.ok(user)
      user.courseList = data.courseList
      return { docs: [user] }
    },
  }
  const result = await giveCourseToPackHolders(payload as never, [5])
  assert.deepEqual(result.users, [1])
  assert.equal(result.live, 1)
  assert.deepEqual(users[0].courseList, [1, 5])
  assert.equal(users[1].courseList, null)
  assert.deepEqual(users[2].courseList, [1, 5])
  assert.equal(users[3].courseList, '[]')
})

test('two identical bring-ins wait their turn and the second sees the first write', async () => {
  const seen: string[] = []
  const library = new Set<string>()
  const job = () => withWorkLock('bringin:test:race0000001', async () => {
    if (library.has('race0000001')) {
      seen.push('skip')
      return 'skip'
    }
    await new Promise((resolve) => setTimeout(resolve, 30))
    library.add('race0000001')
    seen.push('write')
    return 'write'
  })
  const [first, second] = await Promise.all([job(), job()])
  assert.deepEqual([first, second].sort(), ['skip', 'write'])
  assert.deepEqual(seen, ['write', 'skip'])
})

test('a sheet talk starts as a draft and an existing upload without a publish state stays visible', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/server/master-sheet.ts'), 'utf8')
  const create = source.slice(source.indexOf("op.op === 'lesson.create'"), source.indexOf("op.op === 'lesson.update'"))
  assert.match(create, /publishState: 'draft'/)
  assert.match(source, /const list = idList\(holder\.courseList\)/)
})

test('the local yt-dlp stand-in lists a playlist and writes captions or a wav', async () => {
  const listed = await execFileAsync(process.execPath, [fixture, '--flat-playlist', '--print', 'x', 'https://www.youtube.com/playlist?list=PLheartsround2'])
  const lines = String(listed.stdout).trim().split('\n')
  assert.equal(lines.length, 4)
  assert.match(lines[0], /^short000001\t/)
  assert.match(lines[0], /\t89\t/)
  assert.match(lines[3], /^B4KtRL_2aXY\t/)
  const dir = await mkdtemp(path.join(tmpdir(), 'bring-in-fixture-'))
  try {
    await execFileAsync(process.execPath, [fixture, '--write-subs', '-o', path.join(dir, '%(id)s.%(ext)s'), 'https://www.youtube.com/watch?v=fresh000001'], { env: { ...process.env, YT_DLP_ROLE: 'helper' } })
    const vtt = await readFile(path.join(dir, 'fresh000001.vtt'), 'utf8')
    assert.match(vtt, /people gather and listen/)
    await assert.rejects(execFileAsync(process.execPath, [fixture, '--write-subs', '-o', path.join(dir, '%(id)s.%(ext)s'), 'https://www.youtube.com/watch?v=nocaps00001'], { env: { ...process.env, YT_DLP_ROLE: 'helper' } }))
    await execFileAsync(process.execPath, [fixture, '-x', '--audio-format', 'wav', '-o', path.join(dir, '%(id)s.%(ext)s'), 'https://www.youtube.com/watch?v=nocaps00001'], { env: { ...process.env, YT_DLP_ROLE: 'helper' } })
    const wav = await readFile(path.join(dir, 'nocaps00001.wav'))
    assert.ok(wav.length > 44)
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF')
    await writeFile(path.join(dir, 'speech.wav'), wav)
    const stt = await execFileAsync('python3', [path.join(process.cwd(), 'scripts/bring-in-helper/stt.py'), path.join(dir, 'speech.wav')], { env: { ...process.env, STT_ENGINE: 'fixture' } })
    const cues = JSON.parse(String(stt.stdout)) as { cues: { text: string }[] }
    assert.match(cues.cues.map((cue) => cue.text).join(' '), /the light enters the heart/)
    await assert.rejects(execFileAsync(process.execPath, [fixture, '--write-subs', '-o', path.join(dir, '%(id)s.%(ext)s'), 'https://www.youtube.com/watch?v=fresh000001'], { env: { ...process.env, YT_DLP_ROLE: 'server' } }))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
