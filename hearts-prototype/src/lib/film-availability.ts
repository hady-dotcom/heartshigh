/** Vimeo ids that refuse to embed. Films 40 and 41 have no id at all. */
export const EMBED_RESTRICTED_VIMEO_IDS = new Set([
  '496862893', // 1
  '496862550', // 2
  '496862832', // 4
  '496880867', // 17
  '496861656', // 22
  '496879209', // 23
  '496880331', // 42
  '496879175', // 49
  '496893629', // 61
  '496895289', // 75
  '496893712', // 90
  '496943558', // 108
])

export type PlaySource = { vimeoId?: string | null; youtubeId?: string | null; videoProvider?: string | null }

/** A film can play when its host will actually embed. A missing or restricted Vimeo id cannot. */
export function filmCanPlay(lesson: PlaySource) {
  const provider = String(lesson.videoProvider || '')
  if (provider === 'file') return true
  const vimeo = String(lesson.vimeoId || '').trim()
  const youtube = String(lesson.youtubeId || '').trim()
  if (provider === 'vimeo' || vimeo) return Boolean(vimeo) && !EMBED_RESTRICTED_VIMEO_IDS.has(vimeo)
  return Boolean(youtube)
}

/** Index of the first film that can play and is not finished. Falls back to the first playable film. */
export function firstPlayableIndex<T>(items: T[], canPlay: (item: T) => boolean, done?: (item: T) => boolean) {
  const open = items.findIndex((item) => canPlay(item) && !done?.(item))
  if (open >= 0) return open
  const any = items.findIndex((item) => canPlay(item))
  return any >= 0 ? any : 0
}

/** Lock order ignores films that cannot play, so a missing film does not block the next one. */
export function earlierPlayableUnfinished<T>(items: T[], index: number, canPlay: (item: T) => boolean, done: (item: T) => boolean) {
  return items.slice(0, Math.max(0, index)).some((item) => canPlay(item) && !done(item))
}
