'use client'

import { useEffect, useState } from 'react'
import { applyLiveLabels, mockLine, mockTarget, type MockFace, type MockKind, type MockTarget } from '@/lib/experiment-mock'
import styles from './experiment-mock.module.css'

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M6 10V3M3.2 5.4 6 2.4l2.8 3" fill="none" stroke="#1a1408" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Callout({ text, down = false }: { text: string; down?: boolean }) {
  return (
    <span className={styles.callout} data-testid="experiment-mock-callout">
      {down ? null : <Arrow />}
      {text}
      {down ? <Arrow down /> : null}
    </span>
  )
}

function Screen({ spec, text }: { spec: MockTarget; text: string }) {
  const line = mockLine(text, spec.kind)
  if (spec.kind === 'lanes-tab') {
    return (
      <div className={styles.phone} data-testid="experiment-mock-phone">
        <div className={styles.bar}><span>9:41</span><span>HEARTS</span></div>
        <div className={styles.courses}>
          <div className={styles.course}>Faith</div>
          <div className={styles.course}>Character</div>
        </div>
        <Callout text={spec.callout} down />
        <div className={styles.tabs}>
          <span>Home</span>
          <span className={styles.target} data-testid="experiment-mock-target">{line}</span>
          <span>Week</span>
        </div>
      </div>
    )
  }
  if (spec.kind === 'video-frame') {
    const split = line === 'split'
    return (
      <div className={styles.phone} data-testid="experiment-mock-phone">
        <div className={styles.bar}><span>9:41</span><span>HEARTS</span></div>
        <div className={`${styles.stage} ${split ? styles.split : ''} ${styles.target}`} data-testid="experiment-mock-target" data-framing={line}>
          {split ? <><i /><i /></> : <span className={styles.faceDot} />}
        </div>
        <div className={styles.speaker}>{split ? 'Picture and words, one above the other' : 'The face fills the picture'}</div>
        <Callout text={spec.callout} />
      </div>
    )
  }
  return (
    <div className={styles.phone} data-testid="experiment-mock-phone">
      <div className={styles.bar}><span>9:41</span><span>HEARTS</span></div>
      <div className={`${styles.clip} ${spec.kind === 'talk-button' ? styles.talkClip : ''}`} />
      <div className={styles.speaker}>{spec.kind === 'talk-button' ? 'A three-minute cut' : 'A short clip'}</div>
      <span className={`${styles.gold} ${styles.target}`} data-testid="experiment-mock-target">{line}</span>
      <Callout text={spec.callout} />
    </div>
  )
}

export function ExperimentPhones({
  slot,
  versions,
  live = false,
  compact = false,
}: {
  slot: string
  versions: MockFace[]
  live?: boolean
  compact?: boolean
}) {
  const [faces, setFaces] = useState(versions)
  useEffect(() => {
    if (!live) return
    let frame = 0
    let stop = false
    const read = () => {
      const values: Record<string, string> = {}
      for (const input of document.querySelectorAll<HTMLInputElement>('input[name^="label_"]')) {
        values[input.name.slice('label_'.length)] = input.value
      }
      setFaces((current) => applyLiveLabels(current, values))
    }
    const loop = () => {
      if (stop) return
      read()
      frame = window.requestAnimationFrame(loop)
    }
    document.addEventListener('input', read)
    frame = window.requestAnimationFrame(loop)
    return () => {
      stop = true
      document.removeEventListener('input', read)
      window.cancelAnimationFrame(frame)
    }
  }, [live])
  const spec = mockTarget(slot)
  const shown = faces.slice(0, 2)
  if (shown.length < 2) return null
  return (
    <figure className={`${styles.wrap} ${compact ? styles.compact : ''}`} data-testid="experiment-mock" data-slot={slot} data-kind={spec.kind as MockKind} data-screen={spec.screen}>
      <figcaption className={styles.caption}>{spec.screen}</figcaption>
      <div className={styles.pair}>
        {shown.map((face) => (
          <div key={face.key} className={styles.version} data-testid="experiment-mock-version" data-version={face.letter}>
            <b>Version {face.letter}</b>
            <Screen spec={spec} text={face.text} />
          </div>
        ))}
      </div>
    </figure>
  )
}
