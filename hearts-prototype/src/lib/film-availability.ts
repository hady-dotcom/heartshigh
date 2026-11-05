export type PlaySource = { vimeoId?: string | null; youtubeId?: string | null; videoProvider?: string | null }

/** A film plays when the course row has a video. An empty id is still coming. */
export function filmCanPlay(lesson: PlaySource) {
  const provider = String(lesson.videoProvider || '')
  if (provider === 'file') return true
  const vimeo = String(lesson.vimeoId || '').trim()
  const youtube = String(lesson.youtubeId || '').trim()
  if (provider === 'vimeo' || vimeo) return Boolean(vimeo)
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
