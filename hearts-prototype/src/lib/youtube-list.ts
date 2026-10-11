import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { bringInSourceKind, clockFromListed, parseFlatPlaylistLine, type CaptionFlag, type ListedEntry } from './bring-in-plan'
import { captionLang, ytDlpBinary } from './youtube'
import { youtubeIdFromUrl } from './extractor'

const execFileAsync = promisify(execFile)

export type ExpandedVideo = ListedEntry & { url: string; durationSeconds: number | null; lineSpeaker: string }

const LIST_ARGS = ['--flat-playlist', '--no-warnings', '--print', '%(id)s\t%(title)s\t%(duration)s\t%(channel)s\t%(channel_id)s']

/**
 * Real yt-dlp prints five columns. A sixth column (yes, no, unknown) is optional.
 * When it is missing we ask --list-subs, unless this server is simulating a bot wall.
 */
export async function listYoutubeUrl(pageUrl: string, run = runYtDlp): Promise<{ entries: ListedEntry[]; error: string }> {
  const result = await run(pageUrl, LIST_ARGS)
  if (result.missing) return { entries: [], error: 'yt-dlp is not installed. Run npm run setup, or set YT_DLP_PATH.' }
  const entries = result.stdout
    .split(/\r?\n/)
    .map((line) => parseFlatPlaylistLine(line))
    .filter((row): row is ListedEntry => Boolean(row))
  if (!entries.length) {
    const problem = /not a bot|sign in to confirm/i.test(result.stderr)
      ? 'YouTube asked this server to sign in, so the list could not be read. Try again from the caption helper, or paste the film links one by one.'
      : 'That link did not return any films. Check it is a YouTube film, playlist or channel.'
    return { entries: [], error: problem }
  }
  return { entries, error: '' }
}

export async function captionFlagFor(id: string, lang: string, run = runYtDlp): Promise<CaptionFlag> {
  const result = await run(`https://www.youtube.com/watch?v=${id}`, ['--skip-download', '--list-subs', '--no-warnings'])
  if (result.missing) return 'unknown'
  return captionFlagFromListing(`${result.stdout}\n${result.stderr}`, lang)
}

/**
 * yt-dlp says "has no subtitles" when there is no manual track, then lists automatic captions.
 * en, en-orig and en-US still count as captions for English.
 */
export function captionFlagFromListing(output: string, lang: string): CaptionFlag {
  if (/not a bot|sign in to confirm/i.test(output)) return 'unknown'
  if (subsListHasLang(output, lang)) return 'yes'
  if (/no subtitles|there are no subtitles|no automatic captions|there are no automatic captions/i.test(output)) return 'no'
  return output.trim() ? 'no' : 'unknown'
}

export function subsListHasLang(output: string, lang: string) {
  const code = captionLang(lang)
  return new RegExp(`^${code}(\\s|-)`, 'im').test(output) || new RegExp(`\\b${code}\\b`, 'i').test(output)
}

async function runYtDlp(pageUrl: string, args: string[]) {
  try {
    const result = await execFileAsync(ytDlpBinary(), [...args, pageUrl], { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 })
    return { stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), missing: false }
  } catch (error) {
    const failure = error as { code?: string | number; stderr?: string | Buffer; stdout?: string | Buffer }
    return {
      stdout: String(failure.stdout || ''),
      stderr: String(failure.stderr || ''),
      missing: failure.code === 'ENOENT',
    }
  }
}

export async function expandBringInText(
  raw: string,
  options: { lang?: string; list?: typeof listYoutubeUrl; captions?: typeof captionFlagFor; probeCaptions?: boolean } = {},
): Promise<{ videos: ExpandedVideo[]; errors: string[] }> {
  const list = options.list || listYoutubeUrl
  const captions = options.captions || captionFlagFor
  const probe = options.probeCaptions !== false && process.env.HEARTS_CAPTION_BOT_WALL !== '1'
  const videos: ExpandedVideo[] = []
  const errors: string[] = []
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  for (const line of lines) {
    let link = line
    let lineSpeaker = ''
    const bar = link.indexOf('|')
    if (bar >= 0) {
      lineSpeaker = link.slice(bar + 1).trim()
      link = link.slice(0, bar).trim()
    }
    const kind = bringInSourceKind(link)
    if (kind === 'bad') {
      errors.push(`“${link.slice(0, 80)}” is not a YouTube film, playlist or channel link.`)
      continue
    }
    if (kind === 'video') {
      const id = youtubeIdFromUrl(link)
      if (!id) {
        errors.push(`“${link.slice(0, 80)}” is missing the film part.`)
        continue
      }
      const listed = await list(link)
      const entry = listed.entries.find((row) => row.id === id) || listed.entries[0]
      if (!entry) {
        errors.push(namedLine(link, listed.error || `Could not read ${id}.`))
        continue
      }
      videos.push(await withClock({ ...entry, id }, link, lineSpeaker, options.lang || 'en', captions, probe))
      continue
    }
    const listed = await list(link)
    if (!listed.entries.length) {
      errors.push(namedLine(link, listed.error || 'That playlist or channel did not return any films.'))
      continue
    }
    for (const entry of listed.entries) {
      videos.push(await withClock(entry, `https://www.youtube.com/watch?v=${entry.id}`, lineSpeaker, options.lang || 'en', captions, probe))
    }
  }
  return { videos, errors }
}

async function withClock(
  entry: ListedEntry,
  url: string,
  lineSpeaker: string,
  lang: string,
  captions: typeof captionFlagFor,
  probe: boolean,
): Promise<ExpandedVideo> {
  let flag: CaptionFlag = entry.captions || 'unknown'
  if (probe && !entry.captions) flag = await captions(entry.id, lang)
  return { ...entry, url, lineSpeaker, durationSeconds: clockFromListed(entry.durationRaw), captions: flag }
}

function namedLine(link: string, detail: string) {
  const shown = link.slice(0, 80)
  return detail.includes(shown) ? detail : `“${shown}”: ${detail}`
}
