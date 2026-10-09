import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { estimatePaidCost, paidCostLabel } from '../../src/lib/ai-cost'
import { jobNote, paidFromNote, paidRun, tierWriteBlocked } from '../../src/lib/ai-steps'
import { dualExtract, rowsKeptOnExtract } from '../../src/lib/extractor'
import { extractWithFallback } from '../../src/lib/llm'
import { mediaObjectKeys, readStoredMediaBytes } from '../../src/lib/stored-media'
import { dedupeRolling, looksUnpunctuated, parseTranscript } from '../../src/lib/transcript'
import { chosenSpeaker, durationFromTranscript, json3ToVtt, parseDurationPrint, ytDlpArgs, ytDlpProblem } from '../../src/lib/youtube'

const samples = {
  captions: '/home/ubuntu/.cursor/projects/workspace/uploads/from_box-G00001_925e.txt',
  speech: '/home/ubuntu/.cursor/projects/workspace/uploads/speech_to_text-G00857_d662.txt',
  auto: '/home/ubuntu/.cursor/projects/workspace/uploads/youtube-G00009_fb19.txt',
}

test('yt-dlp asks for captions without a forced player client and keeps a printed length', () => {
  const args = ytDlpArgs('B4KtRL_2aXY', '/tmp/caps').join(' ')
  assert.match(args, /--ignore-no-formats-error/)
  assert.match(args, /--write-auto-subs/)
  assert.match(args, /en-orig,en\.\*,en/)
  assert.match(args, /%\(duration\)s/)
  assert.equal(args.includes('player_client='), false)
  assert.equal(parseDurationPrint('NA\n'), null)
  assert.equal(parseDurationPrint('427\nGoals for Ramadan'), 427)
  assert.equal(parseDurationPrint(''), null)
  assert.match(ytDlpProblem('ERROR: Sign in to confirm you’re not a bot'), /blocked yt-dlp/)
  assert.match(ytDlpProblem('WARNING: no formats\n', false), /could not fetch the captions/)
})

test('the CMS speaker is kept and the channel name is never written', () => {
  assert.equal(chosenSpeaker('Alauddin Elbakri', 'Muslim Community Association'), 'Alauddin Elbakri')
  assert.equal(chosenSpeaker('', 'Abdul Malik Merchant'), 'Abdul Malik Merchant')
  assert.equal(chosenSpeaker('  ', ''), '')
})

test('json3 captions stay timed, and a transcript end can stand in for a missing length', () => {
  const vtt = json3ToVtt(JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 2200, segs: [{ utf8: 'Goals ', tOffsetMs: 0 }, { utf8: 'for ', tOffsetMs: 400 }, { utf8: 'Ramadan', tOffsetMs: 800 }] },
      { tStartMs: 2200, dDurationMs: 1800, segs: [{ utf8: 'this month' }] },
    ],
  }))
  assert.ok(vtt)
  assert.match(vtt!, /-->/)
  assert.match(vtt!, /<c t="0\.400">/)
  const parsed = parseTranscript(vtt!)
  assert.equal(parsed.timed, true)
  assert.ok(parsed.cues[0].end > parsed.cues[0].start)
  assert.equal(durationFromTranscript(vtt!), 4)
})

test('talk-gatherer files keep their times, and rolling captions drop the repeated tail', () => {
  for (const file of Object.values(samples)) {
    const parsed = parseTranscript(readFileSync(file, 'utf8'))
    assert.equal(parsed.timed, true)
    assert.ok(parsed.cues.length > 10, file)
    assert.ok(parsed.cues[1].start > parsed.cues[0].start)
  }
  const auto = parseTranscript(readFileSync(samples.auto, 'utf8'))
  assert.equal(looksUnpunctuated(auto.cues), true)
  const punctuated = parseTranscript(readFileSync(samples.captions, 'utf8'))
  assert.equal(looksUnpunctuated(punctuated.cues), false)
  const rolling = dedupeRolling([
    { start: 0, end: 2, text: 'welcome to another episode of the remastered podcast' },
    { start: 1.5, end: 4, text: 'another episode of the remastered podcast hosted by myself' },
    { start: 3, end: 6, text: 'a completely different sentence about prayer' },
  ])
  assert.equal(rolling.length, 3)
  assert.match(rolling[1].text, /^hosted by myself/)
  assert.match(rolling[2].text, /completely different/)
})

test('unpunctuated captions either yield clips or say plainly why there are none', () => {
  const lines = ['# timestamps: start time of each caption line']
  for (let second = 0; second <= 180; second += 3) {
    const clock = `0:${String(Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}`
    const text = second === 90
      ? "don't treat the prayer as a burden but the salah is how a heart stays soft"
      : second === 120
        ? 'allah says the prayer guards the one who keeps it with care'
        : 'people gather and listen and the talk moves along without a full stop here'
    lines.push(`[${clock}] ${text}`)
  }
  const result = dualExtract(lines.join('\n'), [])
  const explained = result.notes.some((note) => /No clips were found/.test(note) && /full stops/.test(note))
  assert.ok(result.cuts.length > 0 || explained, result.notes.join(' | '))
  if (result.cuts.length) assert.match(result.notes.join(' '), /no full stops/)
})

test('re-running the extractor keeps approved clips and a tier write is blocked while they exist', () => {
  const rows = rowsKeptOnExtract([
    { id: 1, status: 'approved' },
    { id: 2, status: 'draft' },
    { id: 3, status: 'rejected' },
  ])
  assert.deepEqual(rows.keep.map((row) => row.id), [1])
  assert.deepEqual(rows.drop.map((row) => row.id), [2, 3])
  assert.equal(tierWriteBlocked(2), 'approved')
  assert.equal(tierWriteBlocked(0), null)
})

test('transcript bytes come from local storage first, then the remote bucket', async () => {
  assert.deepEqual(mediaObjectKeys('talk.txt', 'sheets'), ['sheets/talk.txt', 'talk.txt'])
  const local = await readStoredMediaBytes(
    { filename: 'talk.txt', prefix: 'sheets' },
    {
      readLocal: async (filePath) => (filePath.endsWith('/media/sheets/talk.txt') ? Buffer.from('from-disk') : null),
      readRemote: async () => Buffer.from('from-bucket'),
      settings: { bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', region: 'auto', forcePathStyle: true },
    },
  )
  assert.equal(local?.toString(), 'from-disk')
  const remote = await readStoredMediaBytes(
    { filename: 'talk.txt', prefix: 'sheets' },
    {
      readLocal: async () => null,
      readRemote: async (key) => (key === 'sheets/talk.txt' ? Buffer.from('from-bucket') : null),
      settings: { bucket: 'b', accessKeyId: 'a', secretAccessKey: 's', region: 'auto', forcePathStyle: true },
    },
  )
  assert.equal(remote?.toString(), 'from-bucket')
  const missing = await readStoredMediaBytes(
    { filename: 'missing.txt' },
    { readLocal: async () => null, settings: null },
  )
  assert.equal(missing, null)
})

test('paid AI stays off unless the run is ticked, and the estimate is shown first', async () => {
  const keys = { anthropic: true, openai: false }
  assert.equal(paidRun('anthropic', keys, false), 'mock')
  assert.equal(paidRun('anthropic', keys, true), 'live')
  assert.equal(paidRun('openai', keys, true), 'mock')
  assert.equal(jobNote('Whole pipeline', false), 'Whole pipeline')
  assert.equal(paidFromNote(jobNote('Whole pipeline', true)), true)
  assert.equal(paidFromNote('Whole pipeline'), false)
  const estimate = estimatePaidCost({ chars: 8000, calls: 1, keys })
  assert.ok(estimate && estimate.usd > 0)
  assert.match(paidCostLabel({ chars: 8000, calls: 1, keys, kind: 'extractor' }), /Estimate if you tick paid AI/)
  assert.match(paidCostLabel({ chars: 8000, calls: 1, keys: { anthropic: false, openai: false }, kind: 'extractor' }), /costs nothing/)
  const previous = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'sk-test-should-not-be-called'
  try {
    const result = await extractWithFallback('A short line with a full stop. Another line follows it here today.', [], { usePaidAi: false })
    assert.equal(result.engine, 'deterministic')
    assert.equal(result.notes.some((note) => /Paid AI was ticked/.test(note)), false)
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = previous
  }
})
