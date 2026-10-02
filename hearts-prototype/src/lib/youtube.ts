import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { youtubeIdFromUrl } from './extractor'

const execFileAsync = promisify(execFile)

export type YoutubeMeta = {
  id: string
  title: string
  author: string
  thumbnail: string
}

export type YoutubeIngest =
  | { ok: true; meta: YoutubeMeta; transcript: string; transcriptSource: 'youtube' }
  | { ok: false; meta: YoutubeMeta | null; error: string; needsTranscript: boolean }

export async function fetchYoutubeMeta(id: string): Promise<YoutubeMeta | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return null
    const body = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
    if (!body.title) return null
    return {
      id,
      title: body.title,
      author: body.author_name || 'YouTube',
      thumbnail: body.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  } catch {
    return null
  }
}

async function captionsFromYtDlp(id: string): Promise<string | null> {
  const binary = process.env.YT_DLP_PATH || 'yt-dlp'
  try {
    const { stdout } = await execFileAsync(
      binary,
      ['--skip-download', '--write-auto-sub', '--write-sub', '--sub-lang', 'en', '--sub-format', 'vtt', '--print', 'requested_subtitles', `https://www.youtube.com/watch?v=${id}`],
      { timeout: 25_000 },
    )
    if (stdout && stdout.includes('-->')) return stdout
  } catch {
    return null
  }
  return null
}

async function captionsFromTimedText(id: string): Promise<string | null> {
  const urls = [
    `https://www.youtube.com/api/timedtext?v=${id}&lang=en&fmt=vtt`,
    `https://www.youtube.com/api/timedtext?v=${id}&lang=en&kind=asr&fmt=vtt`,
  ]
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(12_000),
      })
      const text = await response.text()
      if (response.ok && text.includes('-->') && !text.includes('<html')) return text
    } catch {
      continue
    }
  }
  return null
}

export async function ingestYoutubeUrl(input: string): Promise<YoutubeIngest> {
  const id = youtubeIdFromUrl(input)
  if (!id) {
    return {
      ok: false,
      meta: null,
      error: 'That link does not look like a YouTube address. Paste a watch, share, or youtu.be link.',
      needsTranscript: false,
    }
  }
  const meta = await fetchYoutubeMeta(id)
  if (!meta) {
    return {
      ok: false,
      meta: null,
      error: 'YouTube did not recognise that film. Check the link and try again.',
      needsTranscript: false,
    }
  }
  const transcript = (await captionsFromYtDlp(id)) || (await captionsFromTimedText(id))
  if (!transcript) {
    return {
      ok: false,
      meta,
      error:
        'The film is real, but captions could not be fetched from here. YouTube often blocks cloud machines. Upload a .vtt, .srt or .txt transcript and the extractor can still run.',
      needsTranscript: true,
    }
  }
  return { ok: true, meta, transcript, transcriptSource: 'youtube' }
}
