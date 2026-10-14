import { tidyCaption } from './tidy-caption'

export function foldCaption(value: string) {
  return value.replace(/[.?!]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** The words said at this moment. A talk title, series name or empty line is not a caption. */
export function spokenCaption(line: { text?: string; tidy?: string } | null | undefined, titles: (string | undefined)[]) {
  const shown = tidyCaption((line?.tidy || line?.text || '').trim())
  if (!shown) return ''
  const spoken = foldCaption(shown)
  if (titles.some((title) => title && spoken === foldCaption(title))) return ''
  return shown
}

export type FilmCaptionLine = {
  at?: number
  end?: number
  text?: string
  tidy?: string
  role?: string
}

const SUMMARY_ROLES = new Set(['hook', 'turn', 'land'])
/** linesFromWords never puts more than this on one spoken card. */
const SHORT_LINE = 16
/** A line that stays up longer than this is stuck on the film. */
const MAX_CAPTION_WINDOW = 8

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function isSummary(shown: string, summaries: (string | undefined)[]) {
  const spoken = foldCaption(shown)
  if (!spoken) return false
  return summaries.some((summary) => {
    const folded = summary ? foldCaption(summary) : ''
    if (!folded) return false
    if (spoken === folded) return true
    const shorter = spoken.length <= folded.length ? spoken : folded
    const longer = spoken.length <= folded.length ? folded : spoken
    return shorter.length >= 24 && longer.startsWith(shorter)
  })
}

/**
 * Text allowed over a playing feed film.
 * Hook, turn, land, and a quote with no short timed window stay off the picture.
 * A short line with a real in and out point can stay.
 */
export function feedFilmCaption(
  line: FilmCaptionLine | null | undefined,
  lines: readonly FilmCaptionLine[] | null | undefined,
  titles: (string | undefined)[],
  summaries: (string | undefined)[] = [],
  clipEnd?: number,
) {
  if (!line || (line.role && SUMMARY_ROLES.has(line.role))) return ''
  const shown = spokenCaption(line, titles)
  if (!shown || isSummary(shown, summaries) || wordCount(shown) > SHORT_LINE) return ''
  const list = lines || []
  const index = list.indexOf(line)
  const nextAt = index >= 0 ? list[index + 1]?.at : undefined
  const end = line.end ?? nextAt ?? clipEnd
  if (line.at == null || !Number.isFinite(line.at) || end == null || !Number.isFinite(end)) return ''
  if (end - line.at > MAX_CAPTION_WINDOW) return ''
  return shown
}
