/** Shown in place of a film still when the host has not given us a poster. */
export function FilmFallback({ place, title }: { place: number; title: string }) {
  return (
    <span className="thumb-title">
      <small>Film {place}</small>
      <b>{title}</b>
    </span>
  )
}
