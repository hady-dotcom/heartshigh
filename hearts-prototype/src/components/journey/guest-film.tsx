'use client'

import { useState } from 'react'
import { FilmFallback } from '@/components/app/film-fallback'
import { PlayIcon } from '@/components/icons'
import { guestPlayerSrc, type GuestFilm } from '@/lib/guest-film'

/** A light first-film page. Play is a solid button, and Courses is on the page. */
export function GuestFilmView({ film, heading }: { film: GuestFilm; heading?: string }) {
  const [playing, setPlaying] = useState(false)
  const src = playing ? guestPlayerSrc(film, true) : ''
  return (
    <section className="guest-film" data-testid="guest-film">
      <p className="guest-kicker">Start here</p>
      <h1>{heading || film.title}</h1>
      <p className="guest-meta">{heading ? `${film.place}. ${film.title}` : `Film ${film.place} · ${film.courseTitle}`}</p>
      <div className="guest-stage">
        {playing && src ? (
          <iframe title={film.title} src={src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" data-testid="guest-player" />
        ) : (
          <>
            {film.poster ? <img className="guest-still" src={film.poster} alt="" /> : (
              <span className="thumb is-fallback guest-fallback" data-testid="film-thumb">
                <FilmFallback place={film.place} title={film.title} />
              </span>
            )}
            <button type="button" className="guest-play" data-testid="guest-play" onClick={() => setPlaying(true)}>
              <span className="guest-play-mark"><PlayIcon size={22} />Play</span>
            </button>
          </>
        )}
      </div>
      <a className="pill gold block guest-courses" href={film.coursesHref} data-testid="guest-courses">Courses</a>
    </section>
  )
}
