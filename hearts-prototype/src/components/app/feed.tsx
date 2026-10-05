'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FeedItem, SlideStyle } from '@/server/learner'
import { ArrowIcon, LockIcon, SaveIcon } from '../icons'

export const ART: Record<SlideStyle, string> = {
  kinetic: '/slides/bg-kinetic-truck.jpg',
  cinema: '/slides/bg-cinema-road.jpg',
  windows: '/slides/bg-windows-mist.jpg',
  conversation: '/slides/bg-conversation-night.jpg',
  unfold: '/slides/bg-windows-mist.jpg',
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

export function Slide({ item, style, onMore }: { item: FeedItem; style: SlideStyle; onMore: () => void }) {
  const hook = item.hookTidy || item.hook
  const turn = item.turnTidy || item.turn
  const land = item.landTidy || item.land
  const cta = (cls: string) => (
    <button type="button" className={`pill ${cls}`} onClick={onMore} data-testid="learn-more" data-parent={item.parents?.hors.parentId || ''} data-parent-level="appetiser">
      Learn more <ArrowIcon />
    </button>
  )
  const lane = item.laneLabel
  if (style === 'cinema') {
    return (
      <div className="slide cinema" data-style="cinema">
        <div className="bg" style={{ backgroundImage: `url(${ART.cinema})` }} />
        <div className="slide-label"><span>01 · {lane}</span><span>{Math.max(1, Math.round((item.appetiser.end - item.appetiser.start) / 60))} min</span></div>
        <h2 className="serif"><Emphasis text={land} /></h2>
        <div className="rule-line" />
        <p>{hook}</p>
        <p className="indent">{turn}</p>
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
            <h2 className="serif"><Emphasis text={hook} /></h2>
            <p className="serif">{turn}</p>
            <p className="serif">{land}</p>
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
        <div className="slide-label"><span>A conversation<br />On {lane}</span><span>···</span></div>
        <div style={{ marginTop: 34 }}>
          <div className="bubble-row"><span className="bubble-face" style={{ backgroundImage: `url(${ART.cinema})`, backgroundSize: 'cover' }} /><div className="bubble-text">{hook}</div></div>
          <div className="bubble-row"><span className="bubble-face">❦</span><div className="bubble-text">{turn}</div></div>
          <div className="bubble-row"><span className="bubble-face">☾</span><div className="bubble-text dim">{land}</div></div>
        </div>
        <p className="serif" style={{ textAlign: 'center', fontSize: 20, margin: '10px 0 0' }}>There is more to this in the full talk.</p>
        <div className="slide-cta">{cta('')}<div className="slide-foot">{item.speaker} · {item.courseTitle}</div></div>
      </div>
    )
  }
  const lines = [hook, turn, land]
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
