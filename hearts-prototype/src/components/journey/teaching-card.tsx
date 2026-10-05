'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { FeedItem } from '@/server/learner'
import { Arch } from '@/components/arch'
import { landedGold, revealedQuote, spreadWords, type SpokenWord } from '@/lib/card-voice'

type Scene = NonNullable<FeedItem['scene']>
type Beat = Scene['beats'][number]

const VOICE_KEY = 'hearts.cardVoice'

function Gold({ quote, gold }: { quote: string; gold: string }) {
  if (!gold) return <>{quote}</>
  const at = quote.toLowerCase().indexOf(gold.toLowerCase())
  if (at < 0) return <>{quote}</>
  return (
    <>
      {quote.slice(0, at)}
      <em>{quote.slice(at, at + gold.length)}</em>
      {quote.slice(at + gold.length)}
    </>
  )
}

const FIT_TEXT = '[data-testid="scene-quote"], .dim-line, .window-card .serif, .bubble-text'
const FIT_BOXES = '.kinetic-body, .scene-stack, .window-card, .bubble-text'

/** Shrink the card's words until nothing spills out of its box or under the footer. */
function useFitText(root: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const slide = root.current
    if (!slide) return
    const texts = [...slide.querySelectorAll<HTMLElement>(FIT_TEXT)]
    for (const text of texts) text.style.fontSize = ''
    const overflowing = () => {
      const bottom = slide.getBoundingClientRect().bottom - parseFloat(getComputedStyle(slide).paddingBottom || '0')
      const foot = slide.querySelector<HTMLElement>('.slide-cta')
      if (foot && foot.getBoundingClientRect().bottom > bottom + 1) return true
      return [...slide.querySelectorAll<HTMLElement>(FIT_BOXES)].some((box) => box.scrollHeight > box.clientHeight + 1)
    }
    for (const text of texts) Object.assign(text.style, { display: '', webkitLineClamp: '', webkitBoxOrient: '', overflow: '' })
    for (let step = 0; step < 8 && overflowing(); step++) {
      for (const text of texts) text.style.fontSize = `${Math.max(13, parseFloat(getComputedStyle(text).fontSize) * 0.88)}px`
    }
    // Still too long at the smallest size: clamp the longest lines, so the words end inside the card with an ellipsis.
    const longest = [...texts].sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
    if (!longest || !overflowing()) return
    const lineHeight = parseFloat(getComputedStyle(longest).lineHeight) || parseFloat(getComputedStyle(longest).fontSize) * 1.3
    for (let lines = Math.floor(longest.scrollHeight / lineHeight) - 1; lines >= 2 && overflowing(); lines--) {
      Object.assign(longest.style, { display: '-webkit-box', webkitBoxOrient: 'vertical', webkitLineClamp: String(lines), overflow: 'hidden' })
    }
  }, [root, key])
}

function readVoice() {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off'
  } catch {
    return true
  }
}

function rememberVoice(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
  return reduced
}

function lineWords(beat: Beat, duration: number): SpokenWord[] {
  if (beat.words?.length) return beat.words
  const count = beat.quote.split(/\s+/).filter(Boolean).length
  return spreadWords(beat.quote, duration || Math.max(2.2, count / 2.5))
}

function Spoken({ beat, elapsed, done, duration }: { beat: Beat; elapsed: number; done: boolean; duration: number }) {
  const words = lineWords(beat, duration)
  const shown = done ? beat.quote : revealedQuote(words, elapsed)
  const gold = landedGold(shown, beat.gold)
  const unsaid = done ? '' : words.filter((word) => word.at > elapsed + 1e-3).map((word) => word.text).join(' ')
  return (
    <>
      <Gold quote={shown || '\u00a0'} gold={gold} />
      {/* The words still to come hold their place, so the line never reflows and is sized once. */}
      {unsaid ? <span className="unsaid" aria-hidden="true"> {unsaid}</span> : null}
      {done && beat.verse ? (
        <span className="verse">
          <Gold quote={beat.verse} gold={landedGold(beat.verse, beat.gold)} />
        </span>
      ) : null}
    </>
  )
}

export function TeachingCard({
  scene,
  speaker,
  course,
  lane,
  onClip,
  cta = 'Learn more',
}: {
  scene: Scene
  speaker: string
  course: string
  lane: string
  onClip: () => void
  cta?: string
}) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [pref, setPref] = useState<'unknown' | 'on' | 'off'>('unknown')
  const [blocked, setBlocked] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [lineDone, setLineDone] = useState(false)
  const [opened, setOpened] = useState(false)
  const [missing, setMissing] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const quoteRef = useRef<HTMLHeadingElement | null>(null)
  const slideRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const src = scene.scene
    if (!src) {
      setMissing(true)
      return
    }
    let cancelled = false
    const image = new Image()
    image.onload = () => { if (!cancelled) setMissing(false) }
    image.onerror = () => { if (!cancelled) setMissing(true) }
    image.src = src
    return () => { cancelled = true }
  }, [scene.scene])

  const beats = scene.beats
  const at = Math.min(step, beats.length - 1)
  const current = beats[at]
  const heard = beats.some((beat) => beat.audio)
  const sound = pref === 'on'
  const holdLand = scene.style === 'unfold' && current?.beat === 'land' && !opened
  const reward = Boolean(lineDone && current?.beat === 'land' && !holdLand)

  useEffect(() => {
    setPref(readVoice() ? 'on' : 'off')
  }, [])

  useEffect(() => {
    if (reduced) setOpened(true)
  }, [reduced])

  useFitText(slideRef, `${scene.style}:${at}:${opened}`)

  // Only the kinetic list scrolls. scrollIntoView would also scroll the clipped feed itself and shift the screen.
  useEffect(() => {
    const quote = quoteRef.current
    const list = quote?.closest<HTMLElement>('.kinetic-body')
    if (!quote || !list) return
    const over = quote.offsetTop + quote.offsetHeight - (list.scrollTop + list.clientHeight)
    if (over > 0) list.scrollTop += over
  }, [at, lineDone])

  useEffect(() => {
    const next = beats[at + 1]
    if (!next?.audio) return
    const preload = new Audio()
    preload.preload = 'auto'
    preload.src = next.audio
  }, [at, beats])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.muted = pref !== 'on'
  }, [pref])

  useEffect(() => {
    setElapsed(0)
    setLineDone(false)
    setDuration(0)
    if (!current || holdLand || pref === 'unknown') return
    let cancelled = false
    let raf = 0
    const audio = audioRef.current
    const finish = () => {
      if (cancelled) return
      cancelled = true
      setLineDone(true)
      if (at < beats.length - 1) setStep((value) => Math.min(beats.length - 1, value + 1))
    }

    if (current.audio && audio) {
      let started = false
      const watch = () => {
        if (cancelled) return
        setElapsed(audio.currentTime)
        if (!audio.ended && !audio.paused) raf = requestAnimationFrame(watch)
      }
      const start = () => {
        if (started || cancelled) return
        started = true
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
        const pending = audio.play()
        pending?.then(() => {
          if (cancelled) return
          setBlocked(false)
          raf = requestAnimationFrame(watch)
        }).catch(() => {
          if (cancelled || pref !== 'on') return
          setBlocked(true)
          audio.pause()
        })
      }
      const onEnd = () => {
        setElapsed(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime)
        finish()
      }
      audio.pause()
      audio.muted = pref !== 'on'
      audio.addEventListener('loadedmetadata', start)
      audio.addEventListener('ended', onEnd)
      audio.src = current.audio
      audio.load()
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
        audio.removeEventListener('loadedmetadata', start)
        audio.removeEventListener('ended', onEnd)
        audio.pause()
      }
    }

    const words = lineWords(current, 0)
    const span = Math.max(1.4, (words[words.length - 1]?.at || 0) + 0.55)
    setDuration(span)
    const t0 = performance.now()
    const tick = (now: number) => {
      if (cancelled) return
      const t = (now - t0) / 1000
      setElapsed(t)
      if (t >= span) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // Mute toggles the element in place. Restarting here would replay the beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, beats.length, current?.audio, current?.quote, holdLand, pref === 'unknown'])

  const unlock = () => {
    rememberVoice(true)
    setPref('on')
    setBlocked(false)
    const audio = audioRef.current
    if (!audio) return
    audio.muted = false
    void audio.play().catch(() => undefined)
  }

  const toggleVoice = () => {
    if (blocked || pref !== 'on') {
      unlock()
      return
    }
    rememberVoice(false)
    setPref('off')
  }

  const openThought = () => {
    setOpened(true)
    if (blocked || pref !== 'on') unlock()
  }

  const next = reward ? (
    <button type="button" className="pill gold" onClick={onClip} data-testid="scene-next">{cta}</button>
  ) : null

  const voiceButton = heard ? (
    <button type="button" className="scene-voice" aria-pressed={sound && !blocked} onClick={toggleVoice} data-testid="scene-voice">
      {blocked ? 'Tap for voice' : sound ? 'Mute' : 'Voice'}
    </button>
  ) : null

  const spoken = current ? <Spoken beat={current} elapsed={elapsed} done={lineDone} duration={duration} /> : null

  return (
    <div
      className={`slide scene-${scene.style} ${scene.style}${scene.brightness === 'light' && !missing ? ' tone-light' : ''}${missing ? ' tone-missing' : ''}`}
      ref={slideRef}
      data-testid="scene-card"
      data-style={scene.style}
      data-scene={scene.scene}
      data-brightness={scene.brightness || undefined}
      data-picture={missing ? 'missing' : 'ready'}
      data-destination="clip"
      data-beat={current?.beat || ''}
      data-voice={blocked ? 'blocked' : sound ? 'on' : 'off'}
      data-audio={heard ? 'yes' : 'no'}
      data-cta={reward ? 'shown' : 'hidden'}
      onClick={(event) => {
        if (!blocked) return
        if ((event.target as HTMLElement).closest('button, a')) return
        unlock()
      }}
    >
      <div className={`bg drift${missing ? ' fallback' : ''}`} style={missing ? undefined : { backgroundImage: `url(${scene.scene})` }} />
      <audio ref={audioRef} preload="auto" data-testid="scene-audio" />
      {scene.style === 'kinetic' ? <Kinetic beats={beats} at={at} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} spoken={spoken} quoteRef={quoteRef} /> : null}
      {scene.style === 'windows' ? <Windows beats={beats} at={at} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} spoken={spoken} /> : null}
      {scene.style === 'conversation' ? <Conversation beats={beats} at={at} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} spoken={spoken} /> : null}
      {scene.style === 'cinema' ? <Cinema beat={current} at={at} count={beats.length} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} spoken={spoken} quoteRef={quoteRef} /> : null}
      {scene.style === 'unfold' ? <Unfold beats={beats} at={at} opened={opened} onOpen={openThought} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} spoken={spoken} /> : null}
    </div>
  )
}

function Foot({ course, next, voice, scrim }: { course: string; next: ReactNode; voice: ReactNode; scrim?: boolean }) {
  return (
    <div className={`slide-cta${scrim ? ' scrim' : ''}`}>
      {next}
      {course ? <div className="slide-foot" data-testid="scene-credit">{course}</div> : null}
      {voice}
    </div>
  )
}

function Kinetic({
  beats, at, lane, speaker, course, voice, next, spoken, quoteRef,
}: {
  beats: Beat[]
  at: number
  lane: string
  speaker: string
  course: string
  voice: ReactNode
  next: ReactNode
  spoken: ReactNode
  quoteRef: RefObject<HTMLHeadingElement | null>
}) {
  const current = beats[at]
  return (
    <>
      <div className="slide-label"><span>0{at + 1} / 0{beats.length}<span className="rule" /></span><span style={{ textAlign: 'right', lineHeight: 1.6 }}>{lane}<br />{speaker}</span></div>
      <div className="kinetic-body">
        <div className="kinetic-steps">
          {beats.map((beat, index) => (
            <Fragment key={beat.beat}>
              <span className={index === at ? 'on' : ''}>{index + 1}</span>
              {index < beats.length - 1 ? <i /> : null}
            </Fragment>
          ))}
        </div>
        <div>
          {beats.slice(0, at).map((beat) => (
            <p key={beat.beat} className="serif dim-line"><Gold quote={beat.quote} gold={beat.gold} />{beat.verse ? <span className="verse"><Gold quote={beat.verse} gold={beat.gold} /></span> : null}</p>
          ))}
          {current ? (
            <h2 className={`serif beat-in${current.quote.length > 90 ? ' long' : ''}`} key={current.beat} data-testid="scene-quote" ref={quoteRef}>
              {spoken}
            </h2>
          ) : null}
        </div>
      </div>
      <Foot course={course} next={next} voice={voice} scrim />
    </>
  )
}

function Windows({
  beats, at, lane, speaker, course, voice, next, spoken,
}: {
  beats: Beat[]
  at: number
  lane: string
  speaker: string
  course: string
  voice: ReactNode
  next: ReactNode
  spoken: ReactNode
}) {
  return (
    <>
      <div className="slide-label"><span>{lane}<span className="rule" /></span>{voice}</div>
      <div className="scene-stack">
        {beats.map((beat, index) => {
          const locked = index > at
          const live = index === at
          return (
            <div key={beat.beat} className={`window-card${locked ? ' locked' : ''}${live ? ' beat-in' : ''}`} aria-hidden={locked || undefined}>
              <div className="n">0{index + 1}</div>
              <div className={`serif${beat.quote.length > 110 ? ' long' : ''}`} data-testid={live ? 'scene-quote' : undefined}>
                {locked ? beat.quote : live ? spoken : <Gold quote={beat.quote} gold={beat.gold} />}
              </div>
            </div>
          )
        })}
      </div>
      <Foot course={speaker && course ? `${speaker} · ${course}` : speaker || course} next={next} voice={null} />
    </>
  )
}

function Conversation({
  beats, at, lane, speaker, course, voice, next, spoken,
}: {
  beats: Beat[]
  at: number
  lane: string
  speaker: string
  course: string
  voice: ReactNode
  next: ReactNode
  spoken: ReactNode
}) {
  return (
    <>
      <div className="slide-label"><span>A conversation<br />on {lane.toLowerCase()}</span>{voice}</div>
      <div className="scene-stack">
        {beats.slice(0, at + 1).map((beat, index) => (
          <div key={beat.beat} className="bubble-row beat-in">
            <span className="bubble-face">
              {index === 0 ? <Arch size={22} /> : index === 1 ? '❦' : '☾'}
            </span>
            <div className={`bubble-text${index === at ? '' : ' earlier'}`} data-testid={index === at ? 'scene-quote' : undefined}>
              {index === at ? spoken : <Gold quote={beat.quote} gold={beat.gold} />}
            </div>
          </div>
        ))}
      </div>
      <Foot course={speaker && course ? `${speaker} · ${course}` : speaker || course} next={next} voice={null} />
    </>
  )
}

function Cinema({
  beat, at, count, lane, speaker, course, voice, next, spoken, quoteRef,
}: {
  beat: Beat | undefined
  at: number
  count: number
  lane: string
  speaker: string
  course: string
  voice: ReactNode
  next: ReactNode
  spoken: ReactNode
  quoteRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <>
      <div className="slide-label"><span>0{at + 1} · {lane}</span>{voice}</div>
      <h2 className={`serif beat-in${(beat?.quote.length || 0) > 90 ? ' long' : ''}`} data-testid="scene-quote" ref={quoteRef}>{spoken}</h2>
      <div className="rule-line" />
      <p className="count-line">{at + 1} of {count}</p>
      <Foot course={`${speaker}${speaker && course ? ' · ' : ''}${course}`} next={next} voice={null} />
    </>
  )
}

function Unfold({
  beats, at, opened, onOpen, lane, speaker, course, voice, next, spoken,
}: {
  beats: Beat[]
  at: number
  opened: boolean
  onOpen: () => void
  lane: string
  speaker: string
  course: string
  voice: ReactNode
  next: ReactNode
  spoken: ReactNode
}) {
  return (
    <>
      <div className="slide-label"><span>{lane}<span className="rule" /></span>{voice}</div>
      <div className="scene-stack">
        {beats.map((beat, index) => {
          const locked = index > at
          const live = index === at
          const cover = live && beat.beat === 'land' && !opened
          return (
            <div key={beat.beat} className={`window-card${locked ? ' locked' : ''}${live ? ' beat-in' : ''}`} aria-hidden={locked || undefined}>
              <div className="n">0{index + 1}</div>
              {cover ? (
                <button type="button" className="peel-open" onClick={onOpen} data-testid="peel-open">Open the thought</button>
              ) : (
                <div className={`serif${beat.quote.length > 110 ? ' long' : ''}`} data-testid={live ? 'scene-quote' : undefined}>
                  {locked ? beat.quote : live ? spoken : <Gold quote={beat.quote} gold={beat.gold} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Foot course={speaker && course ? `${speaker} · ${course}` : speaker || course} next={next} voice={null} />
    </>
  )
}
