'use client'

import { FormEvent, useEffect, useState } from 'react'
import { LIVE_POLL_MS } from '@/lib/live'

type Question = {
  id: number
  body: string
  authorName: string
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
  viewerCount: number
}

type State = {
  session: Session
  questions: Question[]
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
  const [state, setState] = useState(initial)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let on = true
    const tick = async () => {
      const res = await fetch(`/api/live?portal=${encodeURIComponent(portal)}&id=${initial.session.id}&heartbeat=1`, { headers: { accept: 'application/json' } }).catch(() => null)
      const data = res && res.ok ? ((await res.json().catch(() => null)) as (State & { error?: string }) | null) : null
      if (on && data?.session) setState({ session: data.session, questions: data.questions || [] })
    }
    const id = window.setInterval(tick, LIVE_POLL_MS)
    tick()
    return () => {
      on = false
      window.clearInterval(id)
    }
  }, [portal, initial.session.id])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    const res = await fetch('/api/live', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'question', id: state.session.id, body, portal }),
    }).catch(() => null)
    const data = res ? ((await res.json().catch(() => null)) as { ok?: boolean; error?: string; question?: Question } | null) : null
    setSending(false)
    if (!data?.ok || !data.question) {
      setError(data?.error || 'The question could not be sent.')
      return
    }
    setBody('')
    setState((current) => ({ ...current, questions: [data.question!, ...current.questions.filter((row) => row.id !== data.question!.id)] }))
  }

  const card = state.session
  const ended = card.status === 'ended'
  const questions = state.questions

  return (
    <div className="live-watch" data-testid="live-watch" data-status={card.status}>
      <div className="live-stage">
        {card.embedUrl && !ended ? (
          <iframe
            className="live-player"
            title={card.title}
            src={card.embedUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            data-testid="live-player"
          />
        ) : (
          <div className="live-player empty" data-testid="live-player-empty">
            {ended ? 'This session has ended. A replay draft is with the portal team.' : 'The stream will appear here when the source is ready.'}
          </div>
        )}
      </div>
      <header className="live-meta">
        <p className="live-kicker">{ended ? 'Replay' : 'Live now'}</p>
        <h1>{card.title}</h1>
        <p data-testid="live-host">{card.hostName}</p>
        <p className="muted" data-testid="live-viewers">{card.viewerCount} {card.viewerCount === 1 ? 'watching' : 'watching'}</p>
      </header>
      <section className="live-questions" data-testid="live-questions">
        <h2>Questions</h2>
        {!ended ? (
          <form className="live-ask" onSubmit={send} data-testid="live-ask">
            <label className="stack">
              Ask a short question
              <textarea name="body" rows={2} maxLength={240} value={body} onChange={(event) => setBody(event.target.value)} data-testid="live-question-input" />
            </label>
            {error ? <p className="flash error" data-testid="live-question-error">{error}</p> : null}
            <button className="pill gold" type="submit" disabled={sending} data-testid="live-question-send" data-write>Send</button>
          </form>
        ) : (
          <p className="muted">The live questions were kept with the replay.</p>
        )}
        <ul className="live-q-list">
          {questions.map((question) => (
            <li key={question.id} className={`live-q${question.pinned ? ' pinned' : ''}${question.answered ? ' answered' : ''}`} data-testid="live-question">
              <p>{question.body}</p>
              <small>{question.authorName}{question.answered ? ' · Answered' : ''}{question.pinned ? ' · Pinned' : ''}{staff && question.hidden ? ' · Hidden' : ''}</small>
            </li>
          ))}
          {!questions.length ? <li className="muted">No questions yet. Be the first.</li> : null}
        </ul>
      </section>
    </div>
  )
}
