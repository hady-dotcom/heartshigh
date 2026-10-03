/**
 * A title a learner can read. Slugs, file names and video ids are not titles.
 * When neither the source title nor the stored title is a real sentence, the course name and part number stand in.
 */

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
    const text = (raw || '').replace(/\s+/g, ' ').trim()
    if (!text || isMachineTitle(text, ids)) continue
    return text
  }
  return fallback
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
