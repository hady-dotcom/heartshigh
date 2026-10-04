'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SAVED_KEY, cutIdFromSaved, parseIdList, savedHref } from '@/lib/saved'
import { cleanTitle, uniqueSavedTalks } from '@/lib/clean-title'

type SavedMeta = Record<string, { talk?: string; title?: string }>

function loadIds() {
  return parseIdList(typeof localStorage === 'undefined' ? '' : localStorage.getItem(SAVED_KEY))
}

export function SavedList({ base }: { base: string }) {
  const [ids, setIds] = useState<string[] | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [meta, setMeta] = useState<SavedMeta>({})
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setIds(loadIds())
  }, [])
  useEffect(() => {
    if (!ids?.length) {
      if (ids) setReady(true)
      return
    }
    const query = ids.map((id) => cutIdFromSaved(id)).filter((id): id is number => Boolean(id)).join(',')
    if (!query) {
      setReady(true)
      return
    }
    fetch(`/api/hearts/saved?ids=${encodeURIComponent(query)}`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body: { titles?: Record<string, string>; talks?: SavedMeta }) => {
        const next: Record<string, string> = {}
        const talks: SavedMeta = {}
        for (const [key, value] of Object.entries(body.titles || {})) {
          if (value) next[key] = cleanTitle(value)
        }
        for (const [key, row] of Object.entries(body.talks || {})) {
          talks[key] = { talk: row.talk, title: row.title ? cleanTitle(row.title) : next[key] }
        }
        setTitles(next)
        setMeta(talks)
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [ids])
  if (ids == null || (ids.length > 0 && !ready)) return <p className="muted" data-testid="saved-list">Loading saved clips…</p>
  if (!ids.length) return <p className="muted" data-testid="saved-empty">Nothing saved on this phone yet. Tap Save on a clip and it will wait here.</p>
  const unique = uniqueSavedTalks(ids, meta)
  return (
    <div className="saved-list" data-testid="saved-list">
      {unique.map((id, index) => {
        const title = titles[id] || titles[`cut-${cutIdFromSaved(id)}`] || meta[id]?.title || meta[`cut-${cutIdFromSaved(id)}`]?.title
        return (
          <Link key={id} className="list-link saved-item" href={savedHref(base, id)} data-testid="saved-item">
            <span className="grow">{title || `Saved clip ${index + 1}`}<small>Opens in today’s clips</small></span>›
          </Link>
        )
      })}
    </div>
  )
}

export function SavedCount({ base }: { base: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const ids = loadIds()
    if (!ids.length) return
    const query = ids.map((id) => cutIdFromSaved(id)).filter((id): id is number => Boolean(id)).join(',')
    if (!query) {
      setCount(ids.length)
      return
    }
    fetch(`/api/hearts/saved?ids=${encodeURIComponent(query)}`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body: { talks?: SavedMeta; titles?: Record<string, string> }) => {
        const meta: SavedMeta = body.talks || {}
        for (const [key, title] of Object.entries(body.titles || {})) {
          if (!meta[key]) meta[key] = { title: cleanTitle(title) }
        }
        setCount(uniqueSavedTalks(ids, meta).length)
      })
      .catch(() => setCount(ids.length))
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
