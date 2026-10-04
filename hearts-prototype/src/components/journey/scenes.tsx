'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { SceneDef, SceneOption } from '@/lib/heart'
import { EASE, T, animate } from '@/lib/motion'
import { httpsHref, plainText, telHref } from '@/lib/text-safety'
import { Arch } from '@/components/arch'
import { COMPASS_DISCLOSURE, compassPrivacyOn } from '@/lib/compass-privacy'
import { OPENING_HEADING } from '@/lib/opening-data'
import { BUBBLE_TINTS, DOOR_TINTS, Glyph } from './glyphs'

export function Caption({ text, className = 'j-caption', testId, as: Tag = 'h1' }: { text: string; className?: string; testId?: string; as?: 'h1' | 'h2' | 'p' }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <Tag className={className} data-testid={testId}>
      {parts.map((part, index) => (index % 2 ? <em key={index}>{part}</em> : <span key={index}>{part}</span>))}
    </Tag>
  )
}

export function Opener({ caption, subline, onPlay, onJustShow, loginHref, signedIn }: { caption: string; subline: string; onPlay: () => void; onJustShow: () => void; loginHref: string; signedIn: boolean }) {
  return (
    <section className="j-screen j-opener" data-screen="opener" data-testid="opener">
      <header className="j-top">
        <span className="j-mark" aria-hidden><Arch size={34} /></span>
        {signedIn ? null : <a className="j-login" href={loginHref} data-testid="opener-login">Log in</a>}
      </header>
      <span className="j-arch" aria-hidden style={{ opacity: 0.15 }}><Arch size={120} /></span>
      <div className="j-body">
        <p className="j-progress" data-testid="progress">1 of 8</p>
        <h1 className="j-heading" data-testid="opener-heading">{OPENING_HEADING}</h1>
        <Caption text={caption} testId="opener-caption" as="p" />
        <p className="j-sub">{subline}</p>
      </div>
      <div className="j-actions">
        <button type="button" className="pill gold block j-play" onClick={onPlay} data-testid="lets-play">Let&apos;s play ›</button>
        <button type="button" className="j-escape" onClick={onJustShow} data-testid="just-show">Just show me something</button>
      </div>
    </section>
  )
}

type SceneProps = {
  scene: SceneDef
  index: number
  total?: number
  selected: string | null
  reply: string | null
  picked: string | null
  onPick: (option: SceneOption, el: HTMLElement) => void
  onPass: () => void
  onJustShow: () => void
  onBrowse?: () => void
}

export function SceneCard({ scene, index, total = 8, selected, reply, picked, onPick, onPass, onJustShow }: SceneProps) {
  const pillRef = useRef<HTMLParagraphElement>(null)
  const tilesRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const locked = Boolean(picked)

  useEffect(() => {
    if (reply) animate(pillRef.current, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], T.fade, EASE.standard, { id: 'reply-pill' })
  }, [reply])

  const tap = (option: SceneOption, event: { currentTarget: HTMLElement }) => {
    if (locked) return
    onPick(option, event.currentTarget)
  }

  const down = (event: ReactPointerEvent) => {
    if (scene.layout === 'doorsCarousel') return
    swipe.current = { x: event.clientX, y: event.clientY }
  }
  const up = (event: ReactPointerEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start || locked) return
    const dx = event.clientX - start.x
    if (dx < -70 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5) onPass()
  }

  return (
    <section className={`j-screen j-scene layout-${scene.layout}`} data-screen={`scene-${index + 1}`} data-testid="scene" data-scene={scene.key}>
      <header className="j-top">
        <span className="j-mark" aria-hidden><Arch size={34} /></span>
        <button type="button" className="j-pass" onClick={onPass} disabled={locked} data-testid="pass">Skip</button>
      </header>
      <div className="j-body">
        <p className="j-progress" data-testid="progress">{index + 2} of {total}</p>
        <Caption text={scene.caption} testId="scene-caption" />
        <p className="j-sub">{scene.subline}</p>
        {index === 0 && compassPrivacyOn() ? <p className="j-sub" data-testid="compass-disclosure">{COMPASS_DISCLOSURE}</p> : null}
      </div>
      <div className="j-choices" onPointerDown={down} onPointerUp={up}>
        <p ref={pillRef} className="j-reply" aria-live="polite" data-testid="reply-pill" style={{ visibility: reply ? 'visible' : 'hidden' }}>{reply || ' '}</p>
        {scene.layout === 'grid4' ? (
          <div ref={tilesRef} className="j-tiles" role="list">
            {scene.options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="listitem"
                className={`j-tile${option.crisis ? ' crisis' : ''}${selected === option.key ? ' chosen' : ''}${picked === option.key ? ' picked' : ''}`}
                onClick={(event) => tap(option, event)}
                data-testid="tile"
                data-option={option.key}
                aria-pressed={selected === option.key}
              >
                {option.crisis ? null : <span className="j-glyph"><Glyph name={option.key} /></span>}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
        {scene.layout === 'bubbles' ? (
          <div ref={tilesRef} className="j-bubbles" role="list">
            <span className="j-envelope" aria-hidden>
              <svg width="64" height="48" viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="58" height="42" rx="6" /><path d="M4 6l28 20L60 6" /></svg>
            </span>
            {scene.options.map((option, at) => (
              <button
                key={option.key}
                type="button"
                role="listitem"
                className={`j-bubble b${at}${selected === option.key ? ' chosen' : ''}${picked === option.key ? ' picked' : ''}`}
                style={{ ['--tint' as string]: BUBBLE_TINTS[at % BUBBLE_TINTS.length] }}
                onClick={(event) => tap(option, event)}
                data-testid="tile"
                data-option={option.key}
                aria-pressed={selected === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        {scene.layout === 'doorsCarousel' ? (
          <div ref={tilesRef} className="j-doors" role="list" data-testid="doors">
            {scene.options.map((option, at) => (
              <button
                key={option.key}
                type="button"
                role="listitem"
                className={`j-door${selected === option.key ? ' chosen' : ''}${picked === option.key ? ' picked' : ''}`}
                style={{ ['--door-a' as string]: DOOR_TINTS[at % DOOR_TINTS.length][0], ['--door-b' as string]: DOOR_TINTS[at % DOOR_TINTS.length][1] }}
                onClick={(event) => tap(option, event)}
                data-testid="tile"
                data-option={option.key}
                aria-pressed={selected === option.key}
              >
                <span className="j-arch"><span className="leaf" /></span>
                <span className="j-door-scrim" aria-hidden />
                <span className="j-door-label">{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="j-actions">
        <button type="button" className="j-escape" onClick={onJustShow} disabled={locked} data-testid="just-show">Just show me something</button>
      </div>
    </section>
  )
}

export type HelpContact = { label: string; phone?: string | null; url?: string | null; hours?: string | null }

export function HelpScreen({ contacts, onBack }: { contacts: HelpContact[]; onBack: () => void }) {
  return (
    <section className="j-screen j-help" data-screen="help" data-testid="help">
      <div className="j-body">
        <h1 className="j-caption small">You don&apos;t have to carry this on your own.</h1>
        <p className="j-sub">These people are there to listen, any time you need them.</p>
      </div>
      <ul className="j-contacts" data-testid="help-contacts">
        {contacts.map((contact) => (
          <li key={contact.label} data-testid="help-contact">
            <b>{plainText(contact.label)}</b>
            {contact.phone && telHref(contact.phone) ? <a href={telHref(contact.phone)!} data-testid="help-phone">{plainText(contact.phone)}</a> : null}
            {httpsHref(contact.url) ? <a href={httpsHref(contact.url)!} target="_blank" rel="noreferrer" data-testid="help-link">{httpsHref(contact.url)!.replace(/^https:\/\//, '').replace(/\/$/, '')}</a> : null}
            {contact.hours ? <small>{plainText(contact.hours)}</small> : null}
          </li>
        ))}
      </ul>
      <div className="j-actions">
        <button type="button" className="pill outline-light block" onClick={onBack} data-testid="back-to-hearts">Back to HEARTS</button>
      </div>
    </section>
  )
}
