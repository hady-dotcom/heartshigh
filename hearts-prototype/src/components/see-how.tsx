'use client'

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { seeHowFor, type SeeHowPage } from '@/lib/see-how'

const rowStyle: CSSProperties = { marginTop: 10 }
const linkStyle: CSSProperties = {
  display: 'inline-block',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 750,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  cursor: 'pointer',
}

type PlayerProps = { page: SeeHowPage & { id: string }; helpKey: string; onClose: () => void }

function LazyPlayer(props: PlayerProps) {
  const [View, setView] = useState<ComponentType<PlayerProps> | null>(null)
  useEffect(() => {
    let live = true
    import('./see-how-player').then((mod) => {
      if (live) setView(() => mod.SeeHowPlayer)
    })
    return () => {
      live = false
    }
  }, [])
  if (!View) return null
  return <View {...props} />
}

/** Optional link at the end of a help tip. Renders nothing when this key has no demo. */
export function SeeHowLink({ helpKey }: { helpKey?: string }) {
  const page = seeHowFor(helpKey)
  const [open, setOpen] = useState(false)
  if (!page || !helpKey) return null
  return (
    <div style={rowStyle}>
      <button
        type="button"
        style={linkStyle}
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
      {open ? <LazyPlayer page={page} helpKey={helpKey} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

/** Play button for one filmed page. Used on the master desk list. */
export function SeeHowPlay({ pageId }: { pageId: string }) {
  const page = seeHowFor(pageId)
  const [open, setOpen] = useState(false)
  if (!page) return null
  return (
    <>
      <button
        type="button"
        className="btn ghost small"
        data-testid="see-how-play"
        data-page={pageId}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
      >
        Play
      </button>
      {open ? <LazyPlayer page={page} helpKey={pageId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
