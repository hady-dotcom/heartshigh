'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { seeHowCaptionAt, seeHowFor, type SeeHowPage } from '@/lib/see-how'
import styles from './see-how.module.css'

function Player({ page, helpKey, onClose }: { page: SeeHowPage & { id: string }; helpKey: string; onClose: () => void }) {
  const titleId = useId()
  const [src, setSrc] = useState(page.overrideVideo || page.video)
  const [caption, setCaption] = useState(page.captions[0]?.text || '')

  useEffect(() => {
    let cancel = false
    fetch('/see-how/overrides.json')
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, unknown>) => {
        const custom = data?.[page.id] ?? data?.[helpKey]
        if (!cancel && typeof custom === 'string' && custom && !custom.startsWith('_')) setSrc(custom)
      })
      .catch(() => {})
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
          onTimeUpdate={(event) => setCaption(seeHowCaptionAt(page, event.currentTarget.currentTime))}
        />
        {caption ? <p className={styles.caption} data-testid="see-how-caption">{caption}</p> : null}
      </div>
    </div>,
    document.body,
  )
}

/** Optional link at the end of a help tip. Renders nothing when this key has no demo. */
export function SeeHowLink({ helpKey }: { helpKey?: string }) {
  const page = seeHowFor(helpKey)
  const [open, setOpen] = useState(false)
  if (!page || !helpKey) return null
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.link}
        data-testid="see-how"
        data-see-how={helpKey}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        See how
      </button>
      {open ? <Player page={page} helpKey={helpKey} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}
