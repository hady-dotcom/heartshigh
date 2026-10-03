'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FeedItem, SlideStyle } from '@/server/learner'
import { ArrowIcon, HeartIcon, LockIcon, PlayIcon, SaveIcon, ShareIcon } from '../icons'

type Mode = 'hors' | 'appetiser'
type Motion = 'from-bottom' | 'from-left' | 'from-right' | 'from-top' | 'replay'

const ART: Record<SlideStyle, string> = {
  kinetic: '/slides/bg-kinetic-truck.jpg',
  cinema: '/slides/bg-cinema-road.jpg',
  windows: '/slides/bg-windows-mist.jpg',
  conversation: '/slides/bg-conversation-night.jpg',
  unfold: '/slides/bg-windows-mist.jpg',
}

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

function Emphasis({ text }: { text: string }) {
  const words = text.trim().split(/\s+/)
  if (words.length < 3) return <>{text}</>
  const tail = words.slice(-1).join(' ')
  return (
    <>
      {words.slice(0, -1).join(' ')} <em>{tail}</em>
    </>
  )
}

function useStoredSet(key: string) {
  const [values, setValues] = useState<string[]>([])
  useEffect(() => {
    try {
      setValues(JSON.parse(window.localStorage.getItem(key) || '[]'))
    } catch {
      setValues([])
    }
  }, [key])
  const toggle = useCallback(
    (value: string) => {
      setValues((current) => {
        const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
        window.localStorage.setItem(key, JSON.stringify(next))
        return next
      })
    },
    [key],
  )
  return [values, toggle] as const
}

export function Avatar({ name, portrait, size = 46 }: { name: string; portrait: string | null; size?: number }) {
  const letters = name.replace(/^(shaykh|sheikh|imam|ustadh)\s+/i, '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {portrait ? <img src={portrait} alt="" /> : letters}
    </span>
  )
}

export function FollowButton({ slug, className = 'follow' }: { slug: string; className?: string }) {
  const [followed, toggle] = useStoredSet('hearts-follow')
  const on = followed.includes(slug)
  return (
    <button type="button" className={className} aria-pressed={on} data-testid="follow" onClick={() => toggle(slug)}>
      {on ? 'Following' : 'Follow'}
    </button>
  )
}

export function Feed({ items, base, startLane }: { items: FeedItem[]; base: string; startLane?: string }) {
  const lanes = useMemo(() => [...new Set(items.map((item) => item.lane))], [items])
  const firstIndex = Math.max(0, startLane ? items.findIndex((item) => item.lane === startLane) : 0)
  const [index, setIndex] = useState(firstIndex)
  const [mode, setMode] = useState<Mode>('hors')
  const [motion, setMotion] = useState<Motion>('from-bottom')
  const [turn, setTurn] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [faves, toggleFave] = useStoredSet('hearts-faves')
  const [saved, toggleSave] = useStoredSet('hearts-saved')
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const item = items[index]

  const show = useCallback((nextIndex: number, nextMotion: Motion, message?: string) => {
    setIndex(nextIndex)
    setMode('hors')
    setMotion(nextMotion)
    setTurn((value) => value + 1)
    setPlaying(false)
    if (message) setToast(message)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const replay = useCallback(() => {
    setMotion('replay')
    setTurn((value) => value + 1)
    setPlaying(Boolean(item?.youtubeId))
    setToast('Playing this clip again')
  }, [item])

  const nextLane = useCallback(() => {
    if (!item) return
    const at = lanes.indexOf(item.lane)
    const lane = lanes[(at + 1) % lanes.length]
    const target = items.findIndex((row) => row.lane === lane && row.speaker !== item.speaker)
    const fallback = items.findIndex((row) => row.lane === lane)
    show(target >= 0 ? target : fallback, 'from-top', `Lane · ${items[target >= 0 ? target : fallback].laneLabel}`)
  }, [item, items, lanes, show])

  const moreOnTopic = useCallback(() => {
    if (!item) return
    const order = items.map((_, offset) => (index + 1 + offset) % items.length).filter((at) => at !== index)
    const target = order.find((at) => items[at].lane === item.lane && items[at].speaker !== item.speaker) ?? order.find((at) => items[at].lane === item.lane)
    if (target === undefined) return setToast(`That is everything on ${item.laneLabel.toLowerCase()} for now`)
    show(target, 'from-right', 'Next clip')
  }, [index, item, items, show])

  const moreFromSpeaker = useCallback(() => {
    if (!item) return
    const order = items.map((_, offset) => (index + 1 + offset) % items.length).filter((at) => at !== index)
    const target = order.find((at) => items[at].speaker === item.speaker && items[at].lane !== item.lane) ?? order.find((at) => items[at].speaker === item.speaker)
    if (target === undefined) return setToast(`That is everything from ${item.speaker} for now`)
    show(target, 'from-left', `More from ${item.speaker}`)
  }, [index, item, items, show])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return
      if (event.key === 'ArrowUp') replay()
      if (event.key === 'ArrowDown') nextLane()
      if (event.key === 'ArrowLeft') moreOnTopic()
      if (event.key === 'ArrowRight') moreFromSpeaker()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [replay, nextLane, moreOnTopic, moreFromSpeaker])

  const onPointerDown = (event: ReactPointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY }
    swiped.current = false
  }
  // A swipe often ends past the edge of the screen, where the feed no longer receives pointerup.
  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      if (!start.current) return
      const dx = event.clientX - start.current.x
      const dy = event.clientY - start.current.y
      start.current = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return
      swiped.current = true
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) replay()
        else nextLane()
      } else if (dx < 0) moreOnTopic()
      else moreFromSpeaker()
    }
    const onCancel = () => (start.current = null)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [replay, nextLane, moreOnTopic, moreFromSpeaker])

  const share = async () => {
    if (!item) return
    const url = `${window.location.origin}${base}?lane=${item.lane}`
    try {
      if (navigator.share) await navigator.share({ title: item.courseTitle, text: item.land, url })
      else {
        await navigator.clipboard.writeText(url)
        setToast('Link copied')
      }
    } catch {
      setToast('Sharing was cancelled')
    }
  }

  if (!item) {
    return (
      <div className="feed" data-testid="feed-empty">
        <div className="feed-empty">
          <div>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 30, margin: '0 0 10px' }}>Nothing here yet</p>
            <p style={{ opacity: 0.8, lineHeight: 1.5 }}>When your teachers approve short clips from the talks, they will appear here. The full courses are already open in Lanes.</p>
            <Link className="pill gold" href={`${base}/lanes`} style={{ marginTop: 16 }}>Open Lanes</Link>
          </div>
        </div>
      </div>
    )
  }

  const piece = mode === 'hors' ? item.hors : item.appetiser
  const length = piece.end - piece.start
  const backdrop = item.poster || (item.style ? ART[item.style] : null)
  const showSlide = mode === 'hors' && item.style
  const motionClass = motion === 'from-bottom' ? '' : motion
  const course = `${base}/course/${item.courseId}?part=${item.lessonId}&t=0`

  return (
    <div
      className="feed"
      data-testid="feed"
      data-index={index}
      data-cuts={items.map((row) => row.cutId).join(' ')}
      data-lane={item.lane}
      data-speaker={item.speakerSlug}
      data-mode={mode}
      onPointerDown={onPointerDown}
      onClickCapture={(event) => {
        if (swiped.current) {
          event.preventDefault()
          event.stopPropagation()
          swiped.current = false
        }
      }}
    >
      <div key={`${item.id}-${mode}-${turn}`} className={`clip slide-in ${motionClass}`} data-testid={mode === 'hors' ? 'hors' : 'appetiser'} data-cut={item.cutId}>
        {showSlide ? (
          <Slide item={item} style={item.style!} onMore={() => { setMode('appetiser'); setMotion('from-bottom'); setTurn((value) => value + 1) }} />
        ) : (
          <>
            <div className="clip-bg" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined} />
            {playing && item.youtubeId ? (
              <div className="clip-frame">
                <iframe
                  title={`${item.speaker}, ${item.courseTitle}`}
                  src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?start=${Math.floor(piece.start)}&end=${Math.ceil(piece.end)}&autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1`}
                  allow="autoplay; encrypted-media"
                />
              </div>
            ) : null}
            <div className="clip-top">
              <div className={`progress${playing ? ' run' : ''}`}><i style={{ animationDuration: `${length}s` }} /></div>
              {mode === 'hors' ? (
                <>
                  <div className="clip-hint">↑ swipe up to replay</div>
                  <div className="clip-row">
                    <span className="chip white" data-testid="lane-chip">Lane · {item.laneLabel}</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="chip dark" aria-label="How to swipe" data-testid="gesture-help" onClick={() => setHelp(true)}>?</button>
                      <span className="chip dark">{clock(length)}</span>
                    </span>
                  </div>
                </>
              ) : (
                <div className="clip-row" style={{ marginTop: 14 }}>
                  <span className="chip gold">Extended cut</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{clock(piece.start)} / {clock(piece.end)}</span>
                </div>
              )}
            </div>
            {item.youtubeId ? (
              <button type="button" className="play-hit" aria-label={playing ? 'Pause the clip' : 'Play the clip'} data-testid="play-clip" onClick={() => setPlaying((value) => !value)} />
            ) : null}
            {item.youtubeId && !playing ? <span className="play-badge"><PlayIcon size={28} /></span> : null}
            <p className={`caption${piece.quote.length > 120 ? ' long' : ''}`} data-testid="caption">
              <Emphasis text={piece.quote} />
            </p>
            <div className="rail">
              <button type="button" onClick={share} data-testid="share"><span className="bubble"><ShareIcon /></span>Share</button>
              <button type="button" aria-pressed={faves.includes(item.id)} onClick={() => toggleFave(item.id)} data-testid="fave"><span className="bubble"><HeartIcon filled={faves.includes(item.id)} /></span>Like</button>
              <button type="button" aria-pressed={saved.includes(item.id)} onClick={() => toggleSave(item.id)} data-testid="save"><span className="bubble"><SaveIcon /></span>{saved.includes(item.id) ? 'Saved' : 'Save'}</button>
            </div>
            <div className="clip-foot">
              {mode === 'hors' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link className="speaker-row" href={`${base}/speaker/${item.speakerSlug}`} style={{ flex: 1 }} data-testid="speaker-link">
                      <Avatar name={item.speaker} portrait={item.portrait} />
                      <span className="who"><b>{item.speaker}</b><small>on {item.laneLabel}</small></span>
                    </Link>
                    <FollowButton slug={item.speakerSlug} />
                  </div>
                  <button type="button" className="pill gold block" data-testid="watch-full" onClick={() => { setMode('appetiser'); setMotion('from-bottom'); setTurn((value) => value + 1); setPlaying(false) }}>
                    Learn more
                  </button>
                </>
              ) : (
                <>
                  <Link className="pill gold block" href={course} data-testid="start-course">Start this course ›</Link>
                  <div className="speaker-card">
                    <Avatar name={item.speaker} portrait={item.portrait} />
                    <Link className="who" href={`${base}/speaker/${item.speakerSlug}`} data-testid="speaker-bio-link">
                      <b>{item.speaker}</b>
                      <small>Speaker bio ⌄</small>
                    </Link>
                    <FollowButton slug={item.speakerSlug} className="follow teal" />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <div className="sr-only">
        <button type="button" data-testid="gesture-up" onClick={replay}>Replay this clip</button>
        <button type="button" data-testid="gesture-down" onClick={nextLane}>Switch lane</button>
        <button type="button" data-testid="gesture-left" onClick={moreOnTopic}>Next clip</button>
        <button type="button" data-testid="gesture-right" onClick={moreFromSpeaker}>More from this speaker</button>
      </div>
      {toast ? <div className="lane-switch" data-testid="toast"><span key={toast + turn}>{toast}</span></div> : null}
      {help ? (
        <div className="gesture-help" data-testid="gesture-card" onClick={() => setHelp(false)}>
          <div className="gesture-card">
            <h2>Finding your way</h2>
            <p className="lead">Every swipe brings another short clip. The tabs at the bottom stay where they are.</p>
            <div className="gesture-grid">
              <div><b>Swipe up</b>Play this clip again</div>
              <div><b>Swipe down</b>Switch to a new lane, with a different teacher and topic</div>
              <div><b>Swipe left</b>Another short clip</div>
              <div><b>Swipe right</b>More from this speaker on another topic</div>
            </div>
            <button type="button" className="pill ink block">Got it</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function Slide({ item, style, onMore }: { item: FeedItem; style: SlideStyle; onMore: () => void }) {
  const cta = (cls: string) => (
    <button type="button" className={`pill ${cls}`} onClick={onMore} data-testid="learn-more">
      Learn more <ArrowIcon />
    </button>
  )
  const lane = item.laneLabel
  if (style === 'cinema') {
    return (
      <div className="slide cinema" data-style="cinema">
        <div className="bg" style={{ backgroundImage: `url(${ART.cinema})` }} />
        <div className="slide-label"><span>01 · {lane}</span><span>{Math.max(1, Math.round((item.appetiser.end - item.appetiser.start) / 60))} min</span></div>
        <h2 className="serif"><Emphasis text={item.land} /></h2>
        <div className="rule-line" />
        <p>{item.hook}</p>
        <p className="indent">{item.turn}</p>
        <div className="slide-cta">{cta('')}<div className="slide-foot">{item.speaker}<br />{item.courseTitle}</div></div>
      </div>
    )
  }
  if (style === 'kinetic') {
    return (
      <div className="slide kinetic" data-style="kinetic">
        <div className="bg" style={{ backgroundImage: `url(${ART.kinetic})` }} />
        <div className="slide-label"><span>01 / 03<span className="rule" /></span><span style={{ textAlign: 'right', lineHeight: 1.6 }}>{lane}<br />{item.speaker}</span></div>
        <div className="kinetic-body">
          <div className="kinetic-steps"><span className="on">1</span><i /><span>2</span><i /><span>3</span></div>
          <div>
            <h2 className="serif"><Emphasis text={item.hook} /></h2>
            <p className="serif">{item.turn}</p>
            <p className="serif">{item.land}</p>
          </div>
        </div>
        <div className="slide-cta"><div className="slide-foot">{item.courseTitle}</div>{cta('')}</div>
      </div>
    )
  }
  if (style === 'conversation') {
    return (
      <div className="slide conversation" data-style="conversation">
        <div className="bg" style={{ backgroundImage: `url(${ART.conversation})` }} />
        <div className="slide-label"><span>A conversation<br />on {lane.toLowerCase()}</span><span>···</span></div>
        <div style={{ marginTop: 34 }}>
          <div className="bubble-row"><span className="bubble-face" style={{ backgroundImage: `url(${ART.cinema})`, backgroundSize: 'cover' }} /><div className="bubble-text">{item.hook}</div></div>
          <div className="bubble-row"><span className="bubble-face">❦</span><div className="bubble-text">{item.turn}</div></div>
          <div className="bubble-row"><span className="bubble-face">☾</span><div className="bubble-text dim">{item.land}</div></div>
        </div>
        <p className="serif" style={{ textAlign: 'center', fontSize: 20, margin: '10px 0 0' }}>There is more to this in the full talk.</p>
        <div className="slide-cta">{cta('')}<div className="slide-foot">{item.speaker} · {item.courseTitle}</div></div>
      </div>
    )
  }
  const lines = [item.hook, item.turn, item.land]
  if (style === 'windows') {
    return (
      <div className="slide windows" data-style="windows">
        <div className="slide-label"><span>{lane}<span className="rule" /></span><SaveIcon /></div>
        <div style={{ marginTop: 22 }}>
          {lines.map((line, at) => (
            <div key={at} className={`window-card${at === 2 ? ' locked' : ''}`}>
              {at < 2 ? <span className="art" style={{ backgroundImage: `url(${ART.windows})` }} /> : <span className="lock"><LockIcon /></span>}
              <div className="n">0{at + 1}</div>
              <div className="serif">{line.length > 90 ? `${line.slice(0, 88).trim()}…` : line}</div>
            </div>
          ))}
        </div>
        <div className="slide-cta">{cta('outline')}<div className="slide-foot">{item.speaker}<br />{item.courseTitle}</div></div>
      </div>
    )
  }
  return (
    <div className="slide unfold" data-style="unfold">
      <div className="slide-label"><span>Reflections<span className="rule" /></span><span>{Math.max(1, Math.round((item.appetiser.end - item.appetiser.start) / 60))} min</span></div>
      <div style={{ marginTop: 22 }}>
        {lines.map((line, at) => (
          <div key={at} className={`window-card${at === 2 ? ' locked' : ''}`}>
            {at < 2 ? <span className="art" style={{ backgroundImage: `url(${ART.windows})`, width: '28%' }} /> : null}
            <div className="n">0{at + 1}</div>
            <div className="serif">{line.length > 90 ? `${line.slice(0, 88).trim()}…` : line}</div>
            {at === 2 ? <><span className="peel" /><span className="peel-label">Open the thought</span></> : null}
          </div>
        ))}
      </div>
      <div className="slide-cta">{cta('ink')}<div className="slide-foot">{item.speaker}<br />{item.courseTitle}</div></div>
    </div>
  )
}
