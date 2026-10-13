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
  draftLessonWhere,
  ghunyaHeading,
  isUnavailableFilm,
  jibrilSection,
  markBringInSkips,
  parseFlatPlaylistLine,
  speakerForCandidate,
} from '../../src/lib/bring-in-plan'
import { cookieValue, helperTokenFlash } from '../../src/lib/helper-token-flash'
import { hashHelperToken, helperRateOk, helperTokenAllows, helperTokenMatches, newHelperToken, resetHelperRates } from '../../src/lib/helper-token'
import { helperAttachResult, packSaveNotice, publishNotice } from '../../src/lib/publish-state'
import { punctuateTimedCues } from '../../src/lib/punctuate'
import { bringInFlash, hiddenFromLearners, ingestYoutubeUrl, interpretYtDlpOutput, noteAfterTranscriptUpload, transcriptFor, type TranscriptProvider } from '../../src/lib/youtube'
import { captionFlagFromListing, expandBringInText, joinBringInErrors } from '../../src/lib/youtube-list'
import { harvestSampleLesson } from '../../src/server/harvest'
import { giveCourseToPackHolders } from '../../src/server/publish-holders'
import { withWorkLock } from '../../src/lib/work-lock'
import { attachDecision, helperAttachMessage, helperGapMs, helperRunFailed, punctuateTranscript } from '../../scripts/bring-in-helper/plan'
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
  const gone = decideBringInWrite({ ok: false, id: '0_kvfVpTaUs', error: 'ERROR: Video unavailable', captionOutcome: 'failed', meta: { id: '0_kvfVpTaUs', title: 'This video is not available', author: '', thumbnail: '' }, needsTranscript: true, tried: [], durationSeconds: null }, true, 'en')
  assert.equal(gone.bucket, 'failed')
  assert.match(gone.note, /^Bring-in: failed/)
  const privateFilm = decideBringInWrite({ ok: false, id: 'priv0000001', error: 'Private video. Sign in if you have been granted access to this video', captionOutcome: 'blocked', meta: null, needsTranscript: true, tried: [], durationSeconds: null }, true, 'en')
  assert.equal(privateFilm.bucket, 'failed')
  assert.equal(isUnavailableFilm({ error: 'Requested format is not available' }), false)
})

test('automatic captions count, unavailable films start unticked, and a broken line is named', async () => {
  const auto = `[info] Available subtitles for abcdefghijk:\nabcdefghijk has no subtitles\n[info] Available automatic captions for abcdefghijk:\nLanguage Name Formats\nen English vtt, ttml, srv3, srv2, srv1, json3\nen-orig English (Original) vtt\nen-US English (United States) vtt\n`
  assert.equal(captionFlagFromListing(auto, 'en'), 'yes')
  assert.equal(captionFlagFromListing('abcdefghijk has no automatic captions\nabcdefghijk has no subtitles\n', 'en'), 'no')
  assert.equal(captionFlagFromListing("ERROR: Sign in to confirm you're not a bot", 'en'), 'unknown')
  const rows = markBringInSkips(
    [{ id: '0_kvfVpTaUs', url: 'https://youtu.be/0_kvfVpTaUs', title: 'This video is not available', durationSeconds: 600, channel: 'A', channelId: 'UCx', captions: 'unknown', lineSpeaker: '' }],
    new Set(),
  )
  assert.equal(rows[0].skipReason, 'unavailable')
  assert.equal(rows[0].selected, false)
  const expanded = await expandBringInText('https://www.youtube.com/watch?v=AAAAAAAAAAAA', {
    probeCaptions: false,
    list: async () => ({ entries: [], error: 'That link did not return any films. Check it is a YouTube film, playlist or channel.' }),
  })
  assert.match(expanded.errors[0] || '', /AAAAAAAAAAAA/)
})

test('real yt-dlp unavailable lines fail a film whose title is an ordinary talk', async () => {
  const title = 'Mercy in the heart'
  assert.equal(isUnavailableFilm({ title }), false)
  const samples = [
    'ERROR: [youtube] 0_kvfVpTaUs: Video unavailable. This video is not available\nERROR: unable to download video data: HTTP Error 403: Forbidden\n',
    "ERROR: [youtube] BaW_jenozKc: Private video. Sign in if you've been granted access to this video\n",
    "ERROR: [youtube] jNQXAC9IVRw: This video is available to this channel's members on level: Supporter (members-only)\n",
    'ERROR: [youtube] jNQXAC9IVRw: Join this channel to get access to members-only content like this video, and other exclusive videos.\n',
  ]
  for (const stderr of samples) {
    const interpreted = interpretYtDlpOutput({ stdout: '', stderr, code: 1, files: [] })
    assert.equal(interpreted.outcome, 'unavailable', stderr)
    assert.match(interpreted.message, /It will not be tried again/)
    assert.equal(captionFlagFromListing(stderr, 'en'), 'unavailable')
    const provider: TranscriptProvider = {
      name: 'yt-dlp',
      async fetch() {
        this.lastOutcome = interpreted.outcome
        this.lastProblem = interpreted.message
        return null
      },
    }
    const ingested = await ingestYoutubeUrl('https://www.youtube.com/watch?v=0_kvfVpTaUs', {
      providers: [provider],
      meta: async () => ({ id: '0_kvfVpTaUs', title, author: 'A speaker', thumbnail: '' }),
      duration: async () => 600,
    })
    assert.equal(ingested.ok, false)
    if (ingested.ok) continue
    assert.equal(ingested.captionOutcome, 'unavailable')
    assert.equal(isUnavailableFilm({ title, error: 'YouTube asked this server to sign in, so the captions are waiting for a transcript.' }), false)
    const decision = decideBringInWrite(ingested, true, 'en')
    assert.equal(decision.bucket, 'failed')
    assert.match(decision.note, /^Bring-in: failed/)
    assert.doesNotMatch(decision.note, /^Bring-in: waiting/)
  }
  const onStdout = interpretYtDlpOutput({
    stdout: 'ERROR: [youtube] 0_kvfVpTaUs: This video is unavailable\n',
    stderr: 'ERROR: HTTP Error 403: Forbidden\n',
    code: 1,
    files: [],
  })
  assert.equal(onStdout.outcome, 'unavailable')
  const format = interpretYtDlpOutput({ stdout: '', stderr: 'WARNING: Requested format is not available\n', code: 1, files: [] })
  assert.equal(format.outcome, 'failed')
  const row = {
    id: '0_kvfVpTaUs',
    url: 'https://youtu.be/0_kvfVpTaUs',
    title,
    durationSeconds: 600,
    channel: 'A channel',
    channelId: 'UCabc',
    lineSpeaker: '',
  }
  const unticked = markBringInSkips([{ ...row, captions: 'unavailable' }], new Set())
  assert.equal(unticked[0].selected, false)
  assert.equal(unticked[0].skipReason, 'unavailable')
  const stillTicked = markBringInSkips([{ ...row, captions: 'unknown' }], new Set())
  assert.equal(stillTicked[0].selected, true)
  const listed = parseFlatPlaylistLine('0_kvfVpTaUs\tMercy in the heart\t600\tA channel\tUCabc\tunavailable')
  assert.equal(listed?.captions, 'unavailable')
  const previous = process.env.HEARTS_CAPTION_BOT_WALL
  delete process.env.HEARTS_CAPTION_BOT_WALL
  const kept = await transcriptFor('0_kvfVpTaUs', [
    { name: 'yt-dlp', lastOutcome: 'unavailable', lastProblem: samples[0], fetch: async () => null },
    { name: 'youtube-transcript', lastOutcome: 'blocked', lastProblem: 'YouTube asked this server to sign in.', fetch: async () => null },
  ])
  if (previous == null) delete process.env.HEARTS_CAPTION_BOT_WALL
  else process.env.HEARTS_CAPTION_BOT_WALL = previous
  assert.equal(kept.outcome, 'unavailable')
})

test('a paste names every bad link', async () => {
  const expanded = await expandBringInText('https://example.com/one\nhttps://vimeo.com/two', { probeCaptions: false })
  assert.equal(expanded.errors.length, 2)
  const notice = joinBringInErrors(expanded.errors)
  assert.match(notice, /example\.com\/one/)
  assert.match(notice, /vimeo\.com\/two/)
})

test('a helper attach stays a draft, and unavailable films do not fail the run', () => {
  const attached = helperAttachResult()
  assert.equal(attached.publishState, 'draft')
  assert.equal(attached.learnersCanSee, false)
  assert.match(helperAttachMessage(), /draft/)
  assert.match(helperAttachMessage(), /cannot see it/)
  assert.equal(helperRunFailed({ skipped: 2, attached: 0, already: 0 }), true)
  assert.equal(helperRunFailed({ skipped: 0, attached: 0, already: 0 }), false)
  const retry = bringInFlash({ saved: 0, waiting: 1, failed: 0, skipped: 0, clipsSetAside: 0, retry: true })
  assert.match(retry, /^Tried again\./)
  assert.doesNotMatch(retry, /Brought in 0/)
  assert.doesNotMatch(retry, /saved as drafts/)
  const replaced = bringInFlash({ saved: 1, waiting: 0, failed: 0, skipped: 0, clipsSetAside: 2, keptPublished: 1 })
  assert.match(replaced, /stays published/)
  assert.doesNotMatch(replaced, /saved as drafts/)
})

test('gapless auto-captions keep their times, and a pause before “he” is not a full stop', () => {
  const gapless = punctuateTimedCues([
    { start: 0, end: 2, text: 'the great scholar' },
    { start: 2, end: 4, text: 'he said the name' },
  ])
  assert.equal(gapless[0].start, 0)
  assert.equal(gapless[0].end, 2)
  assert.equal(gapless[1].start, 2)
  assert.equal(gapless[1].end, 4)
  assert.equal(gapless[0].text, 'The great scholar')
  assert.equal(gapless[1].text, 'he said the name.')
  const pause = punctuateTimedCues([
    { start: 1, end: 2, text: 'the great scholar' },
    { start: 3, end: 5, text: 'he said the name' },
  ])
  assert.equal(pause[0].text, 'The great scholar,')
  assert.equal(pause[0].start, 1)
  assert.equal(pause[0].end, 2)
  const self = punctuateTimedCues([{ start: 0, end: 1.5, text: 'i sit with the heart' }])
  assert.equal(self[0].text, 'I sit with the heart.')
  assert.equal(self[0].end, 1.5)
})

test('the token is shown once, harvest samples skip drafts, and Bring in can list sheet drafts', () => {
  assert.equal(cookieValue('hearts_helper_once=hlp_abc; hearts_device=d1', 'hearts_helper_once'), 'hlp_abc')
  assert.equal(cookieValue('hearts_device=d1', 'hearts_helper_seen'), '')
  const first = helperTokenFlash({ once: 'hlp_abc', seen: '' })
  assert.equal(first.show, true)
  assert.equal(first.secret, 'hlp_abc')
  assert.equal(first.setSeen, true)
  const again = helperTokenFlash({ once: 'hlp_abc', seen: '1' })
  assert.equal(again.show, false)
  assert.equal(again.clear, true)
  const transcript = `${'the heart keeps a quiet watch '.repeat(4)}and then it rests`
  assert.equal(harvestSampleLesson({ transcript, publishState: 'draft', transcriptNote: '' }), false)
  assert.equal(harvestSampleLesson({ transcript, publishState: 'published', transcriptNote: 'Bring-in: waiting. [lang:en] none' }), false)
  assert.equal(harvestSampleLesson({ transcript, publishState: 'published', transcriptNote: 'Bring-in: failed. [lang:en] gone' }), false)
  assert.equal(harvestSampleLesson({ transcript, publishState: 'published', transcriptNote: 'Uploaded from notes.vtt' }), true)
  assert.deepEqual(draftLessonWhere({ role: 'master', portalId: null }), { publishState: { equals: 'draft' } })
  const portal = draftLessonWhere({ role: 'portal-admin', portalId: 4 })
  assert.match(JSON.stringify(portal), /"equals":"draft"/)
  assert.match(JSON.stringify(portal), /"equals":4/)
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
