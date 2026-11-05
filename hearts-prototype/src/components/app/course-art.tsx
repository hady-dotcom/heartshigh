/** A film still used as a hero only while the colour preview is on. Hidden otherwise. */
export function CourseArtHero({ src }: { src: string | null }) {
  if (!src) return null
  return (
    <figure className="course-hero" data-look-only data-testid="course-hero">
      <img className="course-hero-still" src={src} alt="" />
    </figure>
  )
}
