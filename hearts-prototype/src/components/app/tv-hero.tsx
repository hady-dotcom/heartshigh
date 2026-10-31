'use client'

import { useRef, useState } from 'react'

export type TvSlide = {
  id: number
  image: string
  kicker: string
  title: string
  line: string
  playHref: string
  moreHref: string
}

export function TvHero({ slides }: { slides: TvSlide[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const onScroll = () => {
    const node = scroller.current
    if (!node || !node.clientWidth) return
    setIndex(Math.round(node.scrollLeft / node.clientWidth))
  }
  return (
    <section className="tv-hero" data-testid="tv-hero">
      <div className="tv-hero-row" ref={scroller} onScroll={onScroll}>
        {slides.map((slide) => (
          <article className="tv-hero-slide" key={slide.id}>
            <img src={slide.image} alt="" />
            <div className="tv-hero-copy">
              <span className="tv-pill">{slide.kicker}</span>
              <h2>{slide.title}</h2>
              <p>{slide.line}</p>
              <div className="tv-hero-actions">
                <a className="tv-play" href={slide.playHref} data-testid="tv-play">Play</a>
                <a className="tv-more" href={slide.moreHref} aria-label={`More about ${slide.title}`} data-testid="tv-more">+</a>
              </div>
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="tv-dots" data-testid="tv-dots">
          {slides.map((slide, dot) => (
            <i key={slide.id} data-on={dot === index ? 'yes' : 'no'} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
