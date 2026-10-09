'use client'

import { useRef, useState, type ReactNode } from 'react'
import { installSlides, type InstallKind, type InstallSlideId } from '@/lib/install-prompt'
import './install-demo.css'

function ArchMark() {
  return (
    <svg className="demo-arch" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 56 V30 C8 12 56 12 56 30 V56" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20 56 V34 C20 24 44 24 44 34 V56" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32 18.5 v-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="10" r="2.2" fill="currentColor" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 11H6.4A1.4 1.4 0 0 0 5 12.4v6.2A1.4 1.4 0 0 0 6.4 20h11.2a1.4 1.4 0 0 0 1.4-1.4v-6.2a1.4 1.4 0 0 0-1.4-1.4H16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 15V5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.4 8.2 12 4.6l3.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Finger() {
  return <span className="demo-finger" aria-hidden="true" />
}

function IosChrome({ children, dim, shareTap }: { children?: ReactNode; dim?: boolean; shareTap?: boolean }) {
  return (
    <>
      <div className="demo-island" />
      <div className={`demo-page${dim ? ' is-dim' : ''}`}>
        <div className="demo-address">hearts</div>
        <div className="demo-site"><span className="demo-badge"><ArchMark /></span></div>
        {children}
      </div>
      <div className="demo-toolbar">
        <span className="demo-tool">‹</span>
        <span className="demo-tool">›</span>
        <span className="demo-tool demo-share"><ShareIcon />{shareTap ? <Finger /> : null}</span>
        <span className="demo-tool demo-book" />
        <span className="demo-tool demo-tabs" />
      </div>
      <span className="demo-homebar" />
    </>
  )
}

function AndroidChrome({ children, menu, dotsTap }: { children?: ReactNode; menu?: boolean; dotsTap?: boolean }) {
  return (
    <>
      <div className="demo-android-top">
        <span className="demo-omni">hearts</span>
        <span className="demo-dots" aria-hidden="true"><i /><i /><i />{dotsTap ? <Finger /> : null}</span>
      </div>
      <div className={`demo-site android${menu ? ' is-dim' : ''}`}><span className="demo-badge"><ArchMark /></span></div>
      {children}
      <span className="demo-homebar" />
    </>
  )
}

function HomeGrid({ round }: { round?: boolean }) {
  return (
    <div className={`demo-homescreen${round ? ' is-round' : ''}`}>
      <span className="demo-blob sage" />
      <span className="demo-blob gold" />
      <span className="demo-blob mist" />
      <span className="demo-landing">
        <span className="demo-badge"><ArchMark /></span>
        <small>HEARTS</small>
      </span>
      <span className="demo-dock"><i /><i /><i /><i /></span>
    </div>
  )
}

function PhoneDemo({ scene, playing }: { scene: InstallSlideId; playing: boolean }) {
  const os = scene.startsWith('ios') ? 'ios' : 'android'
  return (
    <div className="demo-phone" data-os={os} data-scene={scene} data-playing={playing ? 'yes' : 'no'}>
      <div className="demo-screen">
        {scene === 'ios-share' ? <IosChrome shareTap /> : null}
        {scene === 'ios-sheet' ? (
          <IosChrome dim>
            <div className="demo-sheet">
              <span className="demo-grab" />
              <div className="demo-people"><i /><i /><i /><i /></div>
              <div className="demo-row">Copy</div>
              <div className="demo-row demo-target">Add to Home Screen<Finger /></div>
              <div className="demo-row">Add Bookmark</div>
            </div>
          </IosChrome>
        ) : null}
        {scene === 'ios-add' ? (
          <>
            <div className="demo-addbar">
              <span>Cancel</span>
              <b className="demo-add">Add<Finger /></b>
            </div>
            <div className="demo-preview">
              <span className="demo-badge big"><ArchMark /></span>
              <strong>HEARTS</strong>
              <small>hearts</small>
            </div>
            <span className="demo-homebar" />
          </>
        ) : null}
        {scene === 'ios-home' ? <HomeGrid /> : null}
        {scene === 'android-menu' ? <AndroidChrome dotsTap /> : null}
        {scene === 'android-install' ? (
          <AndroidChrome menu>
            <div className="demo-menu">
              <div className="demo-row">New tab</div>
              <div className="demo-row demo-target">Install<Finger /></div>
              <div className="demo-row">Bookmarks</div>
              <div className="demo-row">History</div>
            </div>
          </AndroidChrome>
        ) : null}
        {scene === 'android-home' ? <HomeGrid round /> : null}
      </div>
    </div>
  )
}

/** Swipeable pictured steps. Each slide plays its animation while it is on screen. */
export function InstallSlides({ kind }: { kind: InstallKind }) {
  const slides = installSlides(kind)
  const [index, setIndex] = useState(0)
  const [play, setPlay] = useState(0)
  const startX = useRef<number | null>(null)
  if (!slides.length) return null
  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next))
    if (clamped === index) return
    setIndex(clamped)
    setPlay((n) => n + 1)
  }
  return (
    <div
      className="install-stage"
      data-testid="install-stage"
      data-slide={slides[index].id}
      data-index={index}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(index + 1)
        if (event.key === 'ArrowLeft') go(index - 1)
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if ((event.target as HTMLElement).closest('button')) return
        event.preventDefault()
        startX.current = event.clientX
      }}
      onPointerUp={(event) => {
        if (startX.current == null) return
        const dx = event.clientX - startX.current
        startX.current = null
        if (dx <= -48) go(index + 1)
        else if (dx >= 48) go(index - 1)
      }}
      onPointerCancel={(event) => {
        if (startX.current == null) return
        const dx = event.clientX - startX.current
        startX.current = null
        if (dx <= -48) go(index + 1)
        else if (dx >= 48) go(index - 1)
      }}
    >
      <div className="install-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div className="install-slide" key={slide.id} aria-hidden={i === index ? undefined : true}>
            <PhoneDemo scene={slide.id} playing={i === index} key={i === index ? `${slide.id}-${play}` : slide.id} />
          </div>
        ))}
      </div>
      <p className="install-caption" aria-live="polite"><span className="sr-only">Step {index + 1} of {slides.length}. </span>{slides[index].caption}</p>
      <div className="install-nav">
        <button type="button" data-testid="install-back" onClick={() => go(index - 1)} disabled={index === 0}>Back</button>
        <div className="install-dots">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              data-testid="install-dot"
              aria-label={`Step ${i + 1} of ${slides.length}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" data-testid="install-next" onClick={() => go(index + 1)} disabled={index === slides.length - 1}>Next</button>
      </div>
    </div>
  )
}
