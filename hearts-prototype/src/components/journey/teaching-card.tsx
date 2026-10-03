'use client'

import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { FeedItem } from '@/server/learner'
import { LockIcon } from '../icons'

type Scene = NonNullable<FeedItem['scene']>
type Beat = Scene['beats'][number]

const MARKS = ['/brand/hoopoe-mark.png', '', '']

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

export function TeachingCard({
  scene,
  speaker,
  course,
  lane,
  onClip,
  talkHref,
  onTalk,
}: {
  scene: Scene
  speaker: string
  course: string
  lane: string
  onClip: () => void
  talkHref: string
  onTalk?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [voice, setVoice] = useState(false)
  const [peeled, setPeeled] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const beats = scene.beats
  const at = Math.min(step, beats.length - 1)
  const current = beats[at]
  const heard = beats.some((beat) => beat.audio)

  useEffect(() => {
    if (reduced) setStep(beats.length - 1)
  }, [reduced, beats.length])

  useEffect(() => {
    if (reduced || at >= beats.length - 1) return
    const timer = window.setTimeout(() => setStep((value) => Math.min(beats.length - 1, value + 1)), voice ? 7000 : 4200)
    return () => window.clearTimeout(timer)
  }, [at, beats.length, reduced, voice])

  useEffect(() => {
    setPeeled(false)
    if (scene.style !== 'unfold' || current?.beat !== 'land') return
    const timer = window.setTimeout(() => setPeeled(true), reduced ? 0 : 700)
    return () => window.clearTimeout(timer)
  }, [current?.beat, reduced, scene.style])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    if (!voice || !current?.audio) return
    audio.src = current.audio
    void audio.play().catch(() => undefined)
    return () => audio.pause()
  }, [current?.audio, voice])

  const next = scene.destination === 'clip'
    ? <button type="button" className="pill gold" onClick={onClip} data-testid="scene-next">Watch the 3-minute clip</button>
    : <a className="pill gold" href={talkHref} onClick={onTalk} data-testid="scene-next">Watch the full talk</a>

  const voiceButton = (
    <button type="button" className="scene-voice" aria-pressed={voice} disabled={!heard} onClick={() => setVoice((on) => !on)} data-testid="scene-voice">
      {voice ? 'Voice on' : 'Voice'}
    </button>
  )

  return (
    <div className={`slide scene-${scene.style} ${scene.style}`} data-testid="scene-card" data-style={scene.style} data-scene={scene.scene} data-destination={scene.destination} data-beat={current?.beat || ''} data-voice={voice ? 'on' : 'off'}>
      {scene.style !== 'windows' && scene.style !== 'unfold' ? <div className="bg drift" style={{ backgroundImage: `url(${scene.scene})` }} /> : null}
      <audio ref={audioRef} preload="none" data-testid="scene-audio" />
      {scene.style === 'kinetic' ? <Kinetic beats={beats} at={at} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} /> : null}
      {scene.style === 'windows' ? <Windows beats={beats} at={at} scene={scene.scene} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} /> : null}
      {scene.style === 'conversation' ? <Conversation beats={beats} at={at} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} /> : null}
      {scene.style === 'cinema' ? <Cinema beat={current} at={at} count={beats.length} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} /> : null}
      {scene.style === 'unfold' ? <Unfold beats={beats} at={at} peeled={peeled} scene={scene.scene} lane={lane} speaker={speaker} course={course} voice={voiceButton} next={next} /> : null}
    </div>
  )
}

function Foot({ speaker, course, next, voice }: { speaker: string; course: string; next: ReactNode; voice: ReactNode }) {
  return (
    <div className="slide-cta">
      {next}
      {speaker || course ? <div className="slide-foot">{speaker}{speaker && course ? <br /> : null}{course}</div> : null}
      {voice}
    </div>
  )
}

function Kinetic({ beats, at, lane, speaker, course, voice, next }: { beats: Beat[]; at: number; lane: string; speaker: string; course: string; voice: ReactNode; next: ReactNode }) {
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
            <p key={beat.beat} className="serif dim-line">{beat.quote}</p>
          ))}
          {current ? (
            <h2 className={`serif beat-in${current.quote.length > 90 ? ' long' : ''}`} key={current.beat} data-testid="scene-quote">
              <Gold quote={current.quote} gold={current.gold} />
            </h2>
          ) : null}
        </div>
      </div>
      <Foot speaker="" course={course} next={next} voice={voice} />
    </>
  )
}

function Windows({ beats, at, scene, lane, speaker, course, voice, next }: { beats: Beat[]; at: number; scene: string; lane: string; speaker: string; course: string; voice: ReactNode; next: ReactNode }) {
  return (
    <>
      <div className="slide-label"><span>{lane}<span className="rule" /></span>{voice}</div>
      <div className="scene-stack">
        {beats.slice(0, at + 1).map((beat, index) => (
          <div key={beat.beat} className={`window-card beat-in${index === 2 ? ' locked' : ''}`}>
            {index < 2 ? <span className="art" style={{ backgroundImage: `url(${scene})` }} /> : <span className="lock"><LockIcon /></span>}
            <div className="n">0{index + 1}</div>
            <div className={`serif${beat.quote.length > 90 ? ' long' : ''}`} data-testid={index === at ? 'scene-quote' : undefined}>{beat.quote}</div>
          </div>
        ))}
      </div>
      <Foot speaker={speaker} course={course} next={next} voice={null} />
    </>
  )
}

function Conversation({ beats, at, lane, speaker, course, voice, next }: { beats: Beat[]; at: number; lane: string; speaker: string; course: string; voice: ReactNode; next: ReactNode }) {
  return (
    <>
      <div className="slide-label"><span>A conversation<br />on {lane.toLowerCase()}</span>{voice}</div>
      <div className="scene-stack">
        {beats.slice(0, at + 1).map((beat, index) => (
          <div key={beat.beat} className="bubble-row beat-in">
            <span className="bubble-face">
              {index === 0 ? <img src={MARKS[0]} alt="" /> : index === 1 ? '❦' : '☾'}
            </span>
            <div className={`bubble-text${index === at ? '' : ' dim'}`} data-testid={index === at ? 'scene-quote' : undefined}>
              <Gold quote={beat.quote} gold={beat.gold} />
            </div>
          </div>
        ))}
      </div>
      <Foot speaker={speaker} course={course} next={next} voice={null} />
    </>
  )
}

function Cinema({ beat, at, count, lane, speaker, course, voice, next }: { beat: Beat | undefined; at: number; count: number; lane: string; speaker: string; course: string; voice: ReactNode; next: ReactNode }) {
  return (
    <>
      <div className="slide-label"><span>0{at + 1} · {lane}</span>{voice}</div>
      {beat ? (
        <h2 className={`serif beat-in${beat.quote.length > 90 ? ' long' : ''}`} key={beat.beat} data-testid="scene-quote">
          <Gold quote={beat.quote} gold={beat.gold} />
        </h2>
      ) : null}
      <div className="rule-line" />
      <p className="slide-foot" style={{ textAlign: 'left' }}>{at + 1} of {count}</p>
      <Foot speaker={speaker} course={course} next={next} voice={null} />
    </>
  )
}

function Unfold({ beats, at, peeled, scene, lane, speaker, course, voice, next }: { beats: Beat[]; at: number; peeled: boolean; scene: string; lane: string; speaker: string; course: string; voice: ReactNode; next: ReactNode }) {
  return (
    <>
      <div className="slide-label"><span>{lane}<span className="rule" /></span>{voice}</div>
      <div className="scene-stack">
        {beats.slice(0, at + 1).map((beat, index) => {
          const last = index === at
          return (
            <div key={beat.beat} className={`window-card beat-in${last && beat.beat === 'land' ? ' peel-card' : ''}${peeled && last ? ' open' : ''}`}>
              {beat.beat !== 'land' ? <span className="art" style={{ backgroundImage: `url(${scene})`, width: '28%' }} /> : null}
              <div className="n">0{index + 1}</div>
              <div className={`serif${beat.quote.length > 90 ? ' long' : ''}`} data-testid={last ? 'scene-quote' : undefined}>{beat.quote}</div>
              {last && beat.beat === 'land' ? (
                <>
                  <span className="peel" />
                  <span className="peel-label">Open the thought</span>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
      <Foot speaker={speaker} course={course} next={next} voice={null} />
    </>
  )
}
