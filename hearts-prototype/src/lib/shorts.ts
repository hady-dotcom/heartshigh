/**
 * YouTube Shorts are 9:16 and usually carry the speaker's words burned into the picture, so the feed hides its own
 * caption overlay for them, keeps its buttons out of the lower third, and never paints YouTube's titled thumbnail.
 */

export function isShortsUrl(url: string | null | undefined) {
  if (!url) return false
  try {
    const parsed = new URL(url.trim())
    return /(^|\.)youtube(-nocookie)?\.com$/i.test(parsed.hostname) && /^\/shorts\/[\w-]{11}/.test(parsed.pathname)
  } catch {
    return /youtube\.com\/shorts\/[\w-]{11}/i.test(url)
  }
}

/** Taller than wide by a clear margin: 9:16 is 1.78, a square crop is 1. */
export function isPortraitSize(width: unknown, height: unknown) {
  const w = Number(width)
  const h = Number(height)
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h / w >= 1.3
}

export function isVerticalLesson(lesson: Record<string, unknown> | null | undefined) {
  if (!lesson) return false
  return lesson.vertical === true || isShortsUrl(typeof lesson.youtubeUrl === 'string' ? lesson.youtubeUrl : null) || isShortsUrl(typeof lesson.sourceUrl === 'string' ? lesson.sourceUrl : null)
}
