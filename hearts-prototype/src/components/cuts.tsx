'use client'

import { useState } from 'react'

const WAYS = ['Kinetic', 'Windows', 'Conversation', 'Cinema', 'Unfold'] as const

export function CutCard({
  hook,
  turn,
  land,
  theme,
  href,
}: {
  hook: string
  turn: string
  land: string
  theme?: string
  href: string
}) {
  const [way, setWay] = useState<(typeof WAYS)[number]>('Conversation')
  const [windowIndex, setWindowIndex] = useState(0)
  const [peeled, setPeeled] = useState(false)
  const lines = [hook, turn, land]
  return (
    <article className="cut" data-testid="feed-cut">
      {way === 'Cinema' || way === 'Kinetic' ? (
        <div className="frame">
          {way === 'Kinetic' ? <div className="bars" aria-hidden><span /><span /><span /></div> : null}
          <p>{land}</p>
        </div>
      ) : null}
      <div className="body">
        <p className="meta">{theme}</p>
        <div className="row">
          {WAYS.map((name) => (
            <button key={name} type="button" className={way === name ? '' : 'quiet'} onClick={() => { setWay(name); setWindowIndex(0); setPeeled(false) }}>{name}</button>
          ))}
        </div>
        {way === 'Conversation' ? (
          <div className="chat">
            <div className="bubble">{hook}</div>
            <div className="bubble">{turn}</div>
            <div className="bubble land">{land}</div>
          </div>
        ) : null}
        {way === 'Windows' ? (
          <div>
            <p>{lines[windowIndex]}</p>
            {windowIndex < 2 ? <button type="button" onClick={() => setWindowIndex((value) => value + 1)}>Another glimpse</button> : null}
          </div>
        ) : null}
        {way === 'Unfold' ? (
          <div>
            <p>{hook}</p>
            {peeled ? <><p>{turn}</p><p><strong>{land}</strong></p></> : <button type="button" onClick={() => setPeeled(true)}>Peel this open</button>}
          </div>
        ) : null}
        {way === 'Kinetic' ? <p>{hook}</p> : null}
        <p><a href={href}>Sit with the whole film</a></p>
      </div>
    </article>
  )
}
