'use client'

import { useEffect, useRef, useState } from 'react'
import { FilmFallback } from '@/components/app/film-fallback'
import { PlayIcon } from '@/components/icons'
import { readGuestDevice, rememberGuestAnswer, rememberGuestProgress } from '@/lib/guest-device'
import { clock } from '@/lib/series-group'
import { guestPlayerSrc, vimeoPlayerEvent, type GuestFilm, type GuestNext } from '@/lib/guest-film'

const PICTURE = new Set(['playProgress', 'timeupdate'])
const ENDED = new Set(['ended', 'finish'])

function Still({ poster, place, title, failed, onError }: { poster: string | null; place: number; title: string; failed?: boolean; onError?: () => void }) {
  if (poster && !failed) return <img className="guest-still" src={poster} alt="" onError={onError} />
  return (
    <span className="thumb is-fallback guest-fallback" data-testid="film-thumb">
      <FilmFallback place={place} title={title} />
    </span>
  )
}

function NextRow({ row }: { row: GuestNext }) {
  const [failed, setFailed] = useState(false)
  return (
    <li>
      <a href={row.href} data-testid="guest-next">
        <span className="guest-next-still">
          <Still poster={row.poster} place={row.place} title={row.title} failed={failed} onError={() => setFailed(true)} />
        </span>
        <span className="guest-next-copy">
          <b>{row.title}</b>
          <small>Film {row.place}{row.seconds ? ` · ${clock(row.seconds)}` : ''}</small>
        </span>
      </a>
    </li>
  )
}

/** A first-film page: poster and a large play control, then what comes after. */
export function GuestFilmView({ film, heading, onEnded }: { film: GuestFilm; heading?: string; onEnded?: () => void }) {
  const [armed, setArmed] = useState(false)
  const [picture, setPicture] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const endedRef = useRef(false)
  const pictureRef = useRef(false)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const src = armed ? guestPlayerSrc(film, true) : ''
  const count = Math.max(film.filmCount || 0, 1)

  const finish = () => {
    if (endedRef.current) return
    endedRef.current = true
    onEndedRef.current?.()
  }

  const listen = () => {
    const frame = frameRef.current?.contentWindow
    if (!frame) return
    for (const value of ['ended', 'finish', 'play', 'playing', 'playProgress', 'timeupdate']) {
      frame.postMessage(JSON.stringify({ method: 'addEventListener', value }), 'https://player.vimeo.com')
    }
  }

  useEffect(() => {
    const saved = readGuestDevice().answers.find((row) => row.lessonId === film.lessonId)
    setNote(saved?.body || '')
    setNoteSaved(Boolean(saved?.body))
  }, [film.lessonId])

  const play = () => {
    rememberGuestProgress({
      lessonId: film.lessonId,
      courseId: film.courseId,
      courseTitle: film.courseTitle,
      title: film.title,
      place: film.place,
      seconds: film.seconds,
      done: false,
    })
    setArmed(true)
  }

  const saveNote = () => {
    rememberGuestAnswer({ lessonId: film.lessonId, title: film.title, body: note })
    setNoteSaved(Boolean(note.trim()))
  }

  useEffect(() => {
    if (!armed) return
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://player.vimeo.com') return
      const name = vimeoPlayerEvent(event.data)
      if (name === 'ready') listen()
      if (PICTURE.has(name)) {
        pictureRef.current = true
        setPicture(true)
      }
      if (ENDED.has(name) && pictureRef.current) {
        rememberGuestProgress({
          lessonId: film.lessonId,
          courseId: film.courseId,
          courseTitle: film.courseTitle,
          title: film.title,
          place: film.place,
          seconds: film.seconds,
          done: true,
        })
        finish()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [armed])

  return (
    <section className="guest-film" data-testid="guest-film">
      <p className="guest-kicker">Start here</p>
      <h1>{heading || film.title}</h1>
      <p className="guest-meta">{heading ? `${film.place}. ${film.title}` : `Film ${film.place} · ${film.courseTitle}`}</p>
      <div className="guest-stage">
        <Still poster={film.poster} place={film.place} title={film.title} failed={posterFailed} onError={() => setPosterFailed(true)} />
        {armed && src ? (
          <iframe
            ref={frameRef}
            className={picture ? 'is-ready' : ''}
            title={film.title}
            src={src}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid="guest-player"
            onLoad={listen}
          />
        ) : null}
        {armed ? null : (
          <button type="button" className="guest-play" data-testid="guest-play" aria-label="Play" onClick={play}>
            <span className="guest-play-mark" aria-hidden><PlayIcon size={28} /></span>
          </button>
        )}
      </div>
      <p className="guest-blurb" data-testid="guest-blurb">{film.description}</p>
      <p className="film-meta">
        <span className="duration-chip" data-testid="guest-duration">{film.seconds ? clock(film.seconds) : 'Length not known yet'}</span>
      </p>
      {film.upNext.length ? (
        <section className="guest-next" data-testid="guest-up-next" aria-label="Up next">
          <h2>Up next</h2>
          <ol>
            {film.upNext.map((row) => <NextRow key={row.lessonId} row={row} />)}
          </ol>
        </section>
      ) : null}
      <label className="guest-note">
        <span>A note for yourself</span>
        <textarea className="field" value={note} maxLength={2000} data-testid="guest-answer" onChange={(event) => { setNote(event.target.value); setNoteSaved(false) }} />
        <button type="button" className="pill outline" data-testid="guest-answer-save" onClick={saveNote}>{noteSaved ? 'Saved on this phone' : 'Save on this phone'}</button>
      </label>
      <a className="guest-see-all" href={film.listHref} data-testid="guest-see-all">
        <span>See all {count} film{count === 1 ? '' : 's'}</span>
        <span aria-hidden>›</span>
      </a>
    </section>
  )
}
