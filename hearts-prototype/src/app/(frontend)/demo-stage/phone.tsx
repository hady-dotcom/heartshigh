'use client'

import { useEffect, useRef, useState } from 'react'
import { phoneToasts } from '@/lib/demo-stage'
import { useDemo } from './store'

const PHONE_W = 390
const PHONE_H = 844

export function RealPhone({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const { state } = useDemo()
  const lines = phoneToasts(state)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      setScale(Math.min(w / PHONE_W, h / PHONE_H, 1))
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  return (
    <div className="demo-phone demo-phone-real" data-testid="demo-phone" ref={box}>
      <div className="demo-bezel demo-bezel-real" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
        <iframe
          title="Learner app"
          data-testid="demo-learner-frame"
          src={src}
          width={PHONE_W}
          height={PHONE_H}
          allow="autoplay; fullscreen; encrypted-media"
          style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
        {lines.length ? (
          <div className="demo-phone-toasts" data-testid="demo-phone-toasts">
            {lines.map((line) => (
              <p key={line.id} data-testid="demo-phone-toast">{line.text}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
