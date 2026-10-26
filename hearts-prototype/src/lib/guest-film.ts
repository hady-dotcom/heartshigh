import { vimeoPlayerSrc } from './vimeo'

/** The first film a signed-out visitor can press play on. */
export type GuestFilm = {
  courseId: number
  courseTitle: string
  lessonId: number
  title: string
  place: number
  poster: string | null
  vimeoId: string
  vimeoHash: string | null
  youtubeId: string | null
  href: string
  coursesHref: string
}

export function guestPlayerSrc(film: GuestFilm, autoplay: boolean) {
  const extra: Record<string, string> = { playsinline: '1', autopause: '0' }
  if (autoplay) extra.autoplay = '1'
  if (film.vimeoId) return vimeoPlayerSrc(film.vimeoId, film.vimeoHash, extra)
  if (film.youtubeId) {
    const params = new URLSearchParams({ playsinline: '1', rel: '0' })
    if (autoplay) params.set('autoplay', '1')
    return `https://www.youtube-nocookie.com/embed/${film.youtubeId}?${params.toString()}`
  }
  return ''
}
