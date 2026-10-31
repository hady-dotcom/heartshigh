import Link from 'next/link'
import { TvHero, type TvSlide } from '@/components/app/tv-hero'

export type TvPoster = {
  id: number
  title: string
  section: string
  href: string
  image: string
}

export type TvWatch = {
  id: number
  title: string
  href: string
  image: string
  left: string
  progress: number
}

export function TvHome({
  title = 'Courses',
  workbookHref,
  slides,
  watching,
  shelves,
}: {
  title?: string
  workbookHref: string
  slides: TvSlide[]
  watching: TvWatch[]
  shelves: { title: string; id: string; cards: TvPoster[] }[]
}) {
  return (
    <div className="tv-home" data-testid="tv-home">
      <div className="app-head"><h1 className="tv-title">{title}</h1></div>
      {slides.length ? <TvHero slides={slides} /> : null}
      <Link className="tv-workbook" href={workbookHref} data-testid="open-workbook">
        <span className="tv-workbook-mark" aria-hidden />
        <span>Workbook<small>The first ten films</small></span>
      </Link>
      {watching.length ? (
        <section className="tv-shelf" data-testid="tv-continue">
          <h2>Continue Watching</h2>
          <div className="tv-row tv-row-wide">
            {watching.map((item) => (
              <Link key={item.id} className="tv-watch" href={item.href} data-testid="tv-watch">
                <img src={item.image} alt="" />
                <span className="tv-watch-bar"><i style={{ width: `${item.progress}%` }} /></span>
                <span className="tv-watch-meta"><b>{item.title}</b><small>{item.left} left</small></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {shelves.map((shelf) => (
        <section className="tv-shelf" id={shelf.id} key={shelf.id} data-testid="library-collection">
          <h2><a href={`#${shelf.id}`}>{shelf.title} <span aria-hidden>›</span></a></h2>
          <div className="tv-row">
            {shelf.cards.map((card) => (
              <Link key={card.id} className="tv-poster" href={card.href} data-testid="course-card">
                <img src={card.image} alt="" />
                <span className="tv-poster-copy">
                  <b>{card.title}</b>
                  <small>{card.section}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
