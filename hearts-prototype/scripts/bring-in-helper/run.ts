/**
 * Caption helper. Runs on your own machine, not on the HEARTS server.
 *
 *   HEARTS_BASE=https://hearts.example HEARTS_HELPER_TOKEN=hlp_… npx tsx scripts/bring-in-helper/run.ts
 *   HEARTS_HELPER_DRY_RUN=1 npx tsx scripts/bring-in-helper/run.ts
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { isUnavailableFilm } from '../../src/lib/bring-in-plan'
import { ytDlpBinary } from '../../src/lib/youtube'
import { attachDecision, helperAttachMessage, helperGapMs, helperRunFailed, punctuateCues, punctuateTranscript, speechCuesFromJson } from './plan'

const execFileAsync = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))

type Talk = { id: number; youtubeId: string; title?: string }

const dry = process.argv.includes('--dry-run') || process.env.HEARTS_HELPER_DRY_RUN === '1'
const base = (process.env.HEARTS_BASE || '').replace(/\/$/, '')
const token = process.env.HEARTS_HELPER_TOKEN || ''
const gap = helperGapMs(process.env.HELPER_GAP_MS)
const engine = process.env.STT_ENGINE || 'faster-whisper'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function api(method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(`${base}/api/hearts/awaiting-transcript`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let json: { error?: string; talks?: Talk[]; ok?: boolean } = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { error: text.slice(0, 200) }
  }
  return { status: response.status, json }
}

async function yt(args: string[], url: string) {
  const result = await execFileAsync(ytDlpBinary(), [...args, url], { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }).catch((error: { stdout?: string; stderr?: string; code?: number }) => ({
    stdout: String(error.stdout || ''),
    stderr: String(error.stderr || ''),
    code: error.code || 1,
  }))
  return { stdout: String(result.stdout || ''), stderr: String('stderr' in result ? result.stderr : ''), code: 'code' in result ? result.code : 0 }
}

async function captionsFor(id: string, dir: string) {
  const url = `https://www.youtube.com/watch?v=${id}`
  const ran = await yt(
    ['--skip-download', '--ignore-no-formats-error', '--no-warnings', '--write-subs', '--write-auto-subs', '--sub-langs', 'en.*,en', '--sub-format', 'vtt', '-o', path.join(dir, '%(id)s.%(ext)s')],
    url,
  )
  const names = await readdir(dir)
  const vtt = names.find((name) => name.endsWith('.vtt'))
  const text = vtt ? await readFile(path.join(dir, vtt), 'utf8') : ''
  return { text, told: `${ran.stdout}\n${ran.stderr}` }
}

async function audioFor(id: string, dir: string) {
  const url = `https://www.youtube.com/watch?v=${id}`
  const ran = await yt(['-x', '--audio-format', 'wav', '--no-warnings', '-o', path.join(dir, '%(id)s.%(ext)s')], url)
  const names = await readdir(dir)
  const audio = names.find((name) => name.endsWith('.wav') || name.endsWith('.m4a') || name.endsWith('.mp3'))
  return { path: audio ? path.join(dir, audio) : '', told: `${ran.stdout}\n${ran.stderr}` }
}

async function speechToText(audioPath: string) {
  const script = path.join(here, 'stt.py')
  const result = await execFileAsync('python3', [script, audioPath], {
    timeout: 600_000,
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  })
  return punctuateCues(speechCuesFromJson(String(result.stdout || '')))
}

async function transcriptForTalk(id: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hearts-helper-'))
  try {
    const captions = await captionsFor(id, dir)
    if (captions.text.trim()) return { text: punctuateTranscript(captions.text), via: 'captions' as const }
    if (isUnavailableFilm({ error: captions.told })) return { text: '', via: 'unavailable' as const }
    const audio = await audioFor(id, dir)
    if (isUnavailableFilm({ error: audio.told })) return { text: '', via: 'unavailable' as const }
    if (!audio.path) return { text: '', via: 'none' as const }
    const text = await speechToText(audio.path)
    return { text, via: text.trim() ? ('speech' as const) : ('none' as const) }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function attach(lesson: number, transcript: string) {
  let last = await api('POST', { lesson, transcript })
  for (let attempt = 0; attempt < 2 && attachDecision(last.status) === 'retry'; attempt++) {
    await sleep(Math.max(gap, 1000))
    last = await api('POST', { lesson, transcript })
  }
  return last
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (!base) fail('Set HEARTS_BASE to the HEARTS site, for example https://hearts.example')
  if (!token.startsWith('hlp_')) fail('Set HEARTS_HELPER_TOKEN to a helper token from the master desk. It starts with hlp_.')
  const listed = await api('GET')
  if (listed.status === 401 || listed.status === 403) fail(listed.json.error || 'The helper token was refused.')
  if (listed.status !== 200) fail(listed.json.error || `The waiting list returned ${listed.status}.`)
  const talks = (listed.json.talks || []).filter((talk) => talk.youtubeId)
  const counts = { talks: talks.length, attached: 0, already: 0, skipped: 0, unavailable: 0, captions: 0, speech: 0 }
  console.log(`${dry ? 'Dry run. Nothing will be attached.' : 'Attaching transcripts.'} ${talks.length} talk${talks.length === 1 ? '' : 's'} waiting. Gap ${gap}ms. Speech engine ${engine}.`)
  for (const talk of talks) {
    if (dry) {
      console.log(`Would fetch ${talk.youtubeId} (${talk.title || talk.id}) and would not attach it.`)
      continue
    }
    const made = await transcriptForTalk(talk.youtubeId).catch((error: { message?: string }) => {
      console.error(`Could not fetch ${talk.youtubeId}: ${error.message || 'unknown error'}`)
      return { text: '', via: 'none' as const }
    })
    if (made.via === 'unavailable') {
      const marked = await api('POST', { lesson: talk.id, unavailable: true })
      if (marked.status === 200) {
        counts.unavailable++
        console.log(`Marked ${talk.youtubeId} as not available. It will not be tried again, and learners cannot see it.`)
      } else if (attachDecision(marked.status) === 'already') {
        counts.already++
        console.log(`Already finished: ${talk.youtubeId}. Left it as it was.`)
      } else {
        counts.skipped++
        console.log(`Could not mark ${talk.youtubeId} as not available: ${marked.json.error || marked.status}`)
      }
    } else if (!made.text.trim()) {
      counts.skipped++
      console.log(`Skipped ${talk.youtubeId}. No captions and no speech transcript.`)
    } else {
      const saved = await attach(talk.id, made.text)
      const decision = attachDecision(saved.status)
      if (decision === 'attached') {
        counts.attached++
        if (made.via === 'speech') counts.speech++
        else counts.captions++
        console.log(`Attached ${talk.youtubeId} from ${made.via}. ${helperAttachMessage()}`)
      } else if (decision === 'already') {
        counts.already++
        console.log(`Already had a transcript: ${talk.youtubeId}. Left it as it was.`)
      } else if (decision === 'denied') {
        fail(saved.json.error || 'The helper token cannot do that.')
      } else {
        counts.skipped++
        console.log(`Could not attach ${talk.youtubeId}: ${saved.json.error || saved.status}`)
      }
    }
    if (gap) await sleep(gap)
  }
  console.log(JSON.stringify({ dry, ...counts }))
  if (!dry && helperRunFailed(counts)) process.exit(1)
}

main().catch((error: { message?: string }) => fail(error.message || 'The helper stopped.'))
