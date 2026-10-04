'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { LIVE_POLL_MS } from '@/lib/live'
import { STATE, createPlayer, destroyPlayer } from '@/lib/yt'

type Question = {
  id: number
  body: string
  authorName: string
  mine?: boolean
  hidden?: boolean
  answered?: boolean
  pinned?: boolean
}

type Session = {
  id: number
  title: string
  hostName: string
  status: 'scheduled' | 'live' | 'ended'
  embedUrl: string
  youtubeId?: string
  posterUrl?: string
  viewerCount: number
}

type State = {
  session: Session
  questions: Question[]
}

function sortQuestions(rows: Question[]) {
  return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id)
}

function LiveStage({
  session,
  ended,
}: {
  session: Session
  ended: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const poster = session.posterUrl || '/theme/evening-courtyard.jpg'
  const youtubeId = session.youtubeId || ''

  useEffect(() => {
    if (ended || !youtubeId || !hostRef.current) return
    const id = `live-${session.id}`
    let gone = false
    createPlayer({
      id,
      host: hostRef.current,
      videoId: youtubeId,
      start: 0,
      kind: 'hors',
      onReady: (player) => {
        try {
          player.unMute()
          player.playVideo()
        } catch {
          /* keep the poster */
        }
      },
      onState: (state) => {
        if (!gone && state === STATE.PLAYING) setPlaying(true)
      },
    }).catch(() => undefined)
    return () => {
      gone = true
      destroyPlayer(id)
    }
  }, [ended, youtubeId, session.id])

  useEffect(() => {
    if (ended || youtubeId || !session.embedUrl) return
    const onMessage = (event: MessageEvent) => {
      const raw = event.data
      const data = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as { event?: string } } catch { return null } })() : raw
      if (data && typeof data === 'object' && (data as { event?: string }).event === 'play') setPlaying(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ended, youtubeId, session.embedUrl])

  if (ended) {
    return (
      <div className="live-stage">
        <div className="live-player empty" data-testid="live-player-empty">This session has ended. A replay draft is with the portal team.</div>
      </div>
    )
  }

  return (
    <div className="live-stage" data-playing={playing ? 'yes' : 'no'}>
      <div className={`live-player-host${playing ? ' on' : ''}`} ref={hostRef} data-testid="live-player" aria-hidden={!playing} />
      {!youtubeId && session.embedUrl ? (
        <iframe className={`live-player${playing ? ' on' : ''}`} title={session.title} src={session.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" />
      ) : null}
      {!playing ? (
        <div className="live-poster" data-testid="live-poster" style={{ backgroundImage: `url(${poster})` }}>
          <span className="live-poster-pill">Live</span>
          <b>{session.title}</b>
          <small>Starting…</small>
        </div>
      ) : null}
    </div>
  )
}

export function LiveWatchClient({
  portal,
  initial,
  staff,
}: {
  portal: string
  initial: State
  staff: boolean
}) {
  const [state, setState] = useState({ ...initial, questions: sortQuestions(initial.questions) })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const seen = useRef(new Set(initial.questions.map((row) => row.id)))

  useEffect(() => {
    let on = true
    const tick = async () => {
      const res = await fetch(`/api/live?portal=${encodeURIComponent(portal)}&id=${initial.session.id}&heartbeat=1`, { headers: { accept: 'application/json' } }).catch(() => null)
      const data = res && res.ok ? ((await res.json().catch(() => null)) as (State & { error?: string }) | null) : null
      if (on && data?.session) setState({ session: data.session, questions: sortQuestions(data.questions || []) })
    }
    const id = window.setInterval(tick, LIVE_POLL_MS)
    tick()
    return () => {
      on = false
      window.clearInterval(id)
    }
  }, [portal, initial.session.id])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    const form = event.currentTarget
    const typed = String(new FormData(form).get('body') || '')
    setSending(true)
    setError('')
    const res = await fetch('/api/live', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'question', id: state.session.id, body: typed, portal }),
    }).catch(() => null)
    const data = res ? ((await res.json().catch(() => null)) as { ok?: boolean; error?: string; question?: Question } | null) : null
    setSending(false)
    if (!data?.ok || !data.question) {
      setError(data?.error || 'The question could not be sent.')
      return
    }
    form.reset()
    setState((current) => ({ ...current, questions: sortQuestions([data.question!, ...current.questions.filter((row) => row.id !== data.question!.id)]) }))
  }

  const card = state.session
  const ended = card.status === 'ended'
  const questions = state.questions

  return (
    <div className="live-watch" data-testid="live-watch" data-status={card.status}>
      <LiveStage session={card} ended={ended} />
      <header className="live-meta">
        <p className="live-kicker">{ended ? 'Replay' : 'Live now'}</p>
        <h1>{card.title}</h1>
        <p data-testid="live-host">{card.hostName}</p>
        <p className="muted" data-testid="live-viewers">{card.viewerCount} watching</p>
      </header>
      <section className="live-questions" data-testid="live-questions">
        <h2>Questions</h2>
        {!ended ? (
          <form className="live-ask" onSubmit={send} data-testid="live-ask">
            <label className="stack">
              Ask a short question
              <textarea name="body" rows={2} maxLength={240} data-testid="live-question-input" />
            </label>
            {error ? <p className="flash error" data-testid="live-question-error">{error}</p> : null}
            <button className="pill gold" type="submit" disabled={sending} data-testid="live-question-send" data-write>Send</button>
          </form>
        ) : (
          <p className="muted">The live questions were kept with the replay.</p>
        )}
        <ul className="live-q-list">
          {questions.map((question) => {
            const fresh = !seen.current.has(question.id)
            if (fresh) seen.current.add(question.id)
            const minePending = Boolean(question.mine && !question.answered)
            return (
              <li
                key={question.id}
                className={`live-q${question.pinned ? ' pinned' : ''}${question.answered ? ' answered' : ''}${minePending ? ' mine' : ''}${fresh ? ' in' : ''}`}
                data-testid="live-question"
                data-mine={question.mine ? 'yes' : 'no'}
                data-sent={minePending ? 'yes' : 'no'}
              >
                <p>{question.body}</p>
                <small>{minePending ? 'Sent' : question.authorName}{question.answered ? ' · Answered' : ''}{question.pinned ? ' · Pinned' : ''}{staff && question.hidden ? ' · Hidden' : ''}</small>
              </li>
            )
          })}
          {!questions.length ? <li className="muted">No questions yet. Be the first.</li> : null}
        </ul>
      </section>
    </div>
  )
}
