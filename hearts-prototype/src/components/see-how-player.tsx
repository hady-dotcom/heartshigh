'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { seeHowCaptionAt, type SeeHowPage } from '@/lib/see-how'
import styles from './see-how.module.css'

function filmedSrc(page: SeeHowPage, src: string) {
  return src === page.video || (Boolean(page.overrideVideo) && src === page.overrideVideo)
}

export function SeeHowPlayer({ page, helpKey, onClose }: { page: SeeHowPage & { id: string }; helpKey: string; onClose: () => void }) {
  const titleId = useId()
  const [src, setSrc] = useState(page.overrideVideo || page.video)
  const [caption, setCaption] = useState(page.captions[0]?.text || '')

  useEffect(() => {
    let cancel = false
    Promise.all([
      fetch('/api/see-how').then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
      fetch('/see-how/overrides.json').then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
    ]).then(([stored, file]) => {
      if (cancel) return
      const fromDesk = (stored as { clips?: Record<string, unknown> })?.clips?.[page.id]
      if (typeof fromDesk === 'string' && fromDesk) {
        setSrc(fromDesk)
        setCaption('')
        return
      }
      const data = file as Record<string, unknown>
      const custom = data?.[page.id] ?? data?.[helpKey]
      if (typeof custom === 'string' && custom && !custom.startsWith('_')) setSrc(custom)
    })
    return () => {
      cancel = true
    }
  }, [page.id, helpKey])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.back} data-testid="see-how-player" data-see-how={helpKey} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 id={titleId}>See how · {page.title}</h2>
          <button type="button" className={styles.close} data-testid="see-how-close" onClick={onClose}>
            Close
          </button>
        </div>
        <video
          className={styles.video}
          data-testid="see-how-video"
          src={src}
          poster={page.poster || undefined}
          controls
          muted
          playsInline
          autoPlay
          onTimeUpdate={(event) => {
            if (filmedSrc(page, src)) setCaption(seeHowCaptionAt(page, event.currentTarget.currentTime))
          }}
        />
        {caption && filmedSrc(page, src) ? <p className={styles.caption} data-testid="see-how-caption">{caption}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
