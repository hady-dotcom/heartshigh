'use client'

import { useEffect, useState } from 'react'

export type PointView = {
  id: number
  second: number
  prompt: string
  kind: string
  options?: string[]
  state: 'open' | 'waiting' | 'countdown'
  unlocksAt?: string | null
  contingentPrompt?: string
  answered?: boolean
  link?: string
}

export function PreviewClock() {
  const [second, setSecond] = useState(0)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setSecond((value) => value + 1), 250)
    return () => window.clearInterval(timer)
  }, [playing])
  return (
    <div className="card">
      <p className="meta">Play the preview, then pause where the question belongs. The timestamp fills itself.</p>
      <p data-testid="preview-readout">{format(second)}</p>
      <div className="row">
        <button type="button" data-testid="preview-play" onClick={() => setPlaying(true)}>Play preview</button>
        <button type="button" className="quiet" data-testid="preview-pause" onClick={() => setPlaying(false)}>Pause and use this moment</button>
      </div>
      <input
        data-testid="point-timestamp"
        name="second"
        type="number"
        value={second}
        onChange={(event) => setSecond(Number(event.target.value) || 0)}
      />
    </div>
  )
}

function format(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function FilmPlayer({
  youtubeId,
  points,
  serverNow,
  lessonId,
  next,
  swarm,
  duration = 0,
}: {
  youtubeId?: string | null
  points: PointView[]
  serverNow: string
  lessonId: number
  next: string
  swarm: Record<number, { body: string; name: string }[]>
  duration?: number
}) {
  const [second, setSecond] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [now, setNow] = useState(new Date(serverNow).getTime())

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setSecond((value) => value + 1), 400)
    return () => window.clearInterval(timer)
  }, [playing])

  useEffect(() => {
    const hit = points.find((point) => !point.answered && Math.abs(point.second - second) <= 1)
    if (hit) {
      setPlaying(false)
      setOpenId(hit.id)
    }
  }, [second, points])

  const open = points.find((point) => point.id === openId) || null

  return (
    <div>
      {youtubeId ? (
        <iframe
          className="film"
          title="Lecture"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${Math.max(0, second)}&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      ) : (
        <div className="frame"><p>The film will sit here when a YouTube link is saved. You can still walk the questions.</p></div>
      )}
      <p className="meta">Mux playback id can replace this embed later. For now the sitting is on YouTube.</p>
      <div className="timeline" data-testid="timeline">
        <button type="button" data-testid="player-play" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button>
        <span data-testid="player-second">{format(second)}</span>
        {points.map((point) => (
          <button
            key={point.id}
            type="button"
            className={`dot ${point.answered ? 'done' : point.state === 'open' ? 'open' : 'locked'}`}
            data-testid="timeline-dot"
            data-second={point.second}
            title={point.prompt}
            onClick={() => {
              setSecond(point.second)
              setPlaying(false)
              setOpenId(point.id)
            }}
          />
        ))}
      </div>
      {open ? (
        <div className="popup" data-testid="popup" data-state={open.state}>
          <p>{open.prompt}</p>
          {open.link ? <p><a href={open.link}>{open.link}</a></p> : null}
          {open.state === 'waiting' ? (
            <p data-testid="countdown">This opens after you answer “{open.contingentPrompt || 'the earlier question'}”.</p>
          ) : null}
          {open.state === 'countdown' && open.unlocksAt ? (
            <Countdown unlocksAt={open.unlocksAt} now={now} />
          ) : null}
          {open.state === 'open' && !open.answered ? (
            <form action="/api/hearts" method="post" encType="multipart/form-data">
              <input type="hidden" name="action" value="answer" />
              <input type="hidden" name="point" value={open.id} />
              <input type="hidden" name="next" value={next} />
              {open.kind === 'multiple_choice' && open.options?.length ? (
                open.options.map((option) => (
                  <label key={option}><input type="radio" name="choice" value={option} /> {option}</label>
                ))
              ) : (
                <textarea name="body" data-testid="answer-text" placeholder="A few honest words are enough." />
              )}
              <label>Add an image, if you want<input data-testid="answer-image" type="file" name="image" accept="image/*" /></label>
              <label>Or a short video of your practice<input data-testid="answer-video" type="file" name="video" accept="video/*" /></label>
              <label>Or a voice note<input data-testid="answer-audio" type="file" name="audio" accept="audio/*" /></label>
              <label><input data-testid="answer-private" type="checkbox" name="keepPrivate" /> Keep this private from the circle</label>
              <label><input data-testid="answer-share" type="checkbox" name="shareWithTeacher" /> Share this with my teacher</label>
              <button type="submit" data-testid="answer-submit">Save</button>
            </form>
          ) : null}
          {open.answered ? <p>You have already answered this one.</p> : null}
          <div className="swarm" data-testid="swarm">
            <strong>What others were willing to share</strong>
            {(swarm[open.id] || []).length ? (
              (swarm[open.id] || []).map((item, index) => (
                <p key={index} data-testid="swarm-item">{item.name}: {item.body}</p>
              ))
            ) : (
              <p className="meta">Nothing shared yet. Private answers stay off this list.</p>
            )}
          </div>
          <button type="button" className="quiet" onClick={() => setOpenId(null)}>Close</button>
        </div>
      ) : null}
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="lesson" value={lessonId} />
        <input type="hidden" name="seconds" value={second} />
        {duration > 0 && second >= duration ? <input type="hidden" name="ended" value="yes" /> : null}
        <input type="hidden" name="next" value={next} />
        <button type="submit" data-testid="mark-sat">I sat with this</button>
        <p className="meta" data-testid="watch-ratio">{duration ? `${Math.min(100, Math.round((second / duration) * 100))}% of this sitting` : 'No length set'}</p>
      </form>
    </div>
  )
}

function Countdown({ unlocksAt, now }: { unlocksAt: string; now: number }) {
  const remaining = Math.max(0, new Date(unlocksAt).getTime() - now)
  const days = Math.floor(remaining / 86_400_000)
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  const text = `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'} ${minutes} min ${seconds} sec`
  return <p data-testid="countdown">Time to unlock: {text}</p>
}
