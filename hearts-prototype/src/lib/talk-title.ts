/**
 * A title a learner can read. Slugs, file names and video ids are not titles.
 * When neither the source title nor the stored title is a real sentence, the course name and part number stand in.
 * A YouTube upload often appends "| Prophetic Dua | Shaykh …". That suffix is the channel, not the talk.
 */

/** Drops a "| channel, series" suffix and a trailing "Khutbah by …" credit. */
export function tidyTalkTitle(raw: string) {
  let text = raw.replace(/\s+/g, ' ').trim()
  const pipe = text.indexOf('|')
  if (pipe > 0) text = text.slice(0, pipe).replace(/\s+/g, ' ').trim() || text
  text = text.replace(/\s+[–—-]\s+(Shaykh|Sheikh|Imam|Ustadh|Dr)\b.*$/i, '')
  text = text.replace(/\s+\((?:Shaykh|Sheikh|Imam|Ustadh|Dr)[^)]*\)\s*$/i, '')
  text = text.replace(/\s+[-–—:]+(?:\s+|:)(?:Jum(?:'?uah|mah)\s+)?Khutbah\b.*$/i, '').trim()
  text = text.replace(/\s+::\s+Khutbah\b.*$/i, '').trim()
  return text
}

export function displayTalkTitle(input: {
  title?: string | null
  sourceTitle?: string | null
  courseTitle?: string | null
  part?: number | null
  youtubeId?: string | null
  vimeoId?: string | null
}) {
  const part = input.part && input.part > 0 ? Math.round(input.part) : 1
  const course = (input.courseTitle || '').trim()
  const fallback = course ? `${course} · Part ${part}` : `Part ${part}`
  const ids = new Set([input.youtubeId, input.vimeoId].map((value) => (value || '').trim()).filter(Boolean))
  for (const raw of [input.title, input.sourceTitle]) {
    const text = tidyTalkTitle(raw || '')
    if (!text || isMachineTitle(text, ids)) continue
    return text
  }
  return fallback
}

function plain(value: unknown) {
  if (value == null) return ''
  return String(value)
}

/** The title a learner or a desk should show for one part. Stored slugs stay in the database. */
export function partTitle(
  row: object | null | undefined,
  courseTitle?: unknown,
) {
  const lesson = row as { title?: unknown; sourceTitle?: unknown; order?: unknown; youtubeId?: unknown; vimeoId?: unknown } | null | undefined
  const part = Number(lesson?.order)
  return displayTalkTitle({
    title: plain(lesson?.title),
    sourceTitle: plain(lesson?.sourceTitle),
    courseTitle: plain(courseTitle),
    part: Number.isFinite(part) && part > 0 ? part : 1,
    youtubeId: plain(lesson?.youtubeId),
    vimeoId: plain(lesson?.vimeoId),
  })
}

function isMachineTitle(text: string, ids: Set<string>) {
  if (ids.has(text)) return true
  if (/\.(mp4|webm|mov|m4v|mp3)$/i.test(text)) return true
  if (/^vimeo\s+\d+$/i.test(text)) return true
  if (/^youtube\s+\S+$/i.test(text)) return true
  if (/^\d{5,}$/.test(text)) return true
  if (/^[a-z0-9]+(?:[-_][a-z0-9]+)+$/i.test(text)) return true
  if (/^[A-Za-z0-9_-]{11}$/.test(text) && /\d/.test(text)) return true
  return false
}
