import { tidyTalkTitle } from './talk-title'
import { cutIdFromSaved } from './saved'

/** Drop a YouTube “ - Khutbah by Shaykh …” or “ :: Khutbah by …” tail after the pipe suffix is gone. */
const UPLOAD_BY = /\s+(?:[-–—]|::)\s+(?:khutbah|khutba|lecture|talk|sermon|friday khutbah)?\s*by\s+.+$/i
const SPEAKER_DASH = /\s+(?:[-–—]|::)\s+(?:sh\.|shaykh|sheikh|imam|ustadh)\b.+$/i
const DOUBLE_COLON = /\s*::\s+.+$/

/**
 * Desk and Saved helper. Built on tidyTalkTitle so talk-title.ts can merge with
 * courses-planning and r5c without a rewrite.
 */
export function cleanTitle(raw: string) {
  const tidy = tidyTalkTitle(raw)
  const stripped = tidy.replace(UPLOAD_BY, '').replace(SPEAKER_DASH, '').replace(DOUBLE_COLON, '').replace(/\s+/g, ' ').trim()
  return stripped || tidy
}

/** One Saved row per talk. Same lesson, or the same cleaned title, collapses. */
export function uniqueSavedTalks(ids: string[], meta: Record<string, { talk?: string; title?: string }>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const cut = `cut-${cutIdFromSaved(id) || id}`
    const row = meta[id] || meta[cut] || {}
    const key = row.talk || row.title || cut
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}
