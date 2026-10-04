'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SAVED_KEY, parseIdList, savedHref } from '@/lib/saved'

export function SavedList({ base }: { base: string }) {
  const [ids, setIds] = useState<string[] | null>(null)
  useEffect(() => {
    setIds(parseIdList(typeof localStorage === 'undefined' ? '' : localStorage.getItem(SAVED_KEY)))
  }, [])
  if (ids == null) return <p className="muted" data-testid="saved-list">Loading saved clips…</p>
  if (!ids.length) return <p className="muted" data-testid="saved-empty">Nothing saved on this phone yet. Tap Save on a clip and it will wait here.</p>
  return (
    <div className="saved-list" data-testid="saved-list">
      {ids.map((id, index) => (
        <Link key={id} className="list-link saved-item" href={savedHref(base, id)} data-testid="saved-item">
          <span className="grow">Saved clip {index + 1}<small>Opens in today’s clips</small></span>›
        </Link>
      ))}
    </div>
  )
}

export function SavedCount({ base }: { base: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(parseIdList(typeof localStorage === 'undefined' ? '' : localStorage.getItem(SAVED_KEY)).length)
  }, [])
  if (!count) return null
  return (
    <Link className="mini-btn" href={`${base}/me#saved`} data-testid="home-saved">
      Saved ({count})
    </Link>
  )
}

export function SavedToast() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const count = parseIdList(typeof localStorage === 'undefined' ? '' : localStorage.getItem(SAVED_KEY)).length
    if (!count || typeof sessionStorage === 'undefined' || sessionStorage.getItem('hearts.saved.toast')) return
    sessionStorage.setItem('hearts.saved.toast', '1')
    setShow(true)
    const timer = window.setTimeout(() => setShow(false), 2800)
    return () => window.clearTimeout(timer)
  }, [])
  if (!show) return null
  return (
    <p className="saved-toast" data-testid="saved-toast" role="status">
      Saved clips stay on this phone.
    </p>
  )
}
