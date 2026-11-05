'use client'

import { useEffect, useRef, useState } from 'react'
import { alertsFor, fillCast, phoneToasts, type DemoPanel } from '@/lib/demo-stage'
import { useDemo } from './store'

const PHONE_W = 390
const PHONE_H = 844
const DESK_W = 1280

export function RealScreen({ src, panel, testId }: { src: string; panel: DemoPanel; testId: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const { state, cast } = useDemo()
  const phone = panel === 'learner'
  const notes = phone
    ? phoneToasts(state)
    : alertsFor(state, panel).slice(0, 3).map((row) => ({ id: row.id, text: fillCast(row.text, cast) }))

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      setSize({ w, h })
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const scale = phone ? Math.min(size.w / PHONE_W, size.h / PHONE_H, 1) : Math.min(size.w / DESK_W, 1)
  const frameW = phone ? PHONE_W : DESK_W
  const frameH = phone ? PHONE_H : Math.max(1, Math.round(size.h / (scale || 1)))
  const shown = size.w > 0 && size.h > 0 && Number.isFinite(scale) && scale > 0

  return (
    <div className={phone ? 'demo-phone-slot' : 'demo-desk-slot'}>
      {notes.length ? (
        <div className="demo-phone-toasts" data-testid={phone ? 'demo-phone-toasts' : `demo-alerts-${panel}`}>
          {notes.map((line) => (
            <p key={line.id} data-testid={phone ? 'demo-phone-toast' : `demo-alert-${panel}`}>{line.text}</p>
          ))}
        </div>
      ) : null}
      <div className={`demo-frame-fit${phone ? ' is-phone' : ''}`} data-testid={phone ? 'demo-phone' : `demo-desk-${panel}`} ref={box}>
        {shown ? (
          <div className="demo-frame-clip" style={{ width: frameW * scale, height: phone ? PHONE_H * scale : size.h }}>
            <iframe
              title={phone ? 'Learner app' : `${panel} desk`}
              data-testid={testId}
              src={src}
              width={frameW}
              height={frameH}
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; fullscreen; encrypted-media"
              style={{ width: frameW, height: frameH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
