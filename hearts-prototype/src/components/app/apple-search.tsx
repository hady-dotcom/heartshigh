'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Hit = { kind: 'course' | 'film'; title: string; detail: string; href: string }

const RECENT = 'hh-recent-searches'

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

function remember(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  const next = [trimmed, ...readRecent().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6)
  localStorage.setItem(RECENT, JSON.stringify(next))
}

export function AppleSearch() {
  const router = useRouter()
  const listId = useId()
  const box = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Hit[]>([])
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readRecent())
    let gone = false
    const portal = window.location.pathname.match(/^\/p\/([^/]+)/)?.[1] || ''
    const catalogue = portal ? `/api/hearts/catalogue?portal=${encodeURIComponent(portal)}` : '/api/hearts/catalogue'
    fetch(catalogue, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((body: { items?: Hit[] }) => {
        if (!gone && Array.isArray(body.items)) setItems(body.items)
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length < 1) return []
    return items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(needle)).slice(0, 8)
  }, [items, query])

  const go = (href: string) => {
    remember(query)
    setOpen(false)
    router.push(href)
  }

  return (
    <div className={`app-search${open ? ' is-open' : ''}`} ref={box}>
      <button
        type="button"
        className="search-open"
        aria-label="Search"
        data-testid="search-open"
        onClick={() => {
          setRecent(readRecent())
          setOpen(true)
          window.setTimeout(() => field.current?.focus(), 0)
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16.5 20.5 21" />
        </svg>
      </button>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16.5 20.5 21" />
      </svg>
      <input
        ref={field}
        type="search"
        role="combobox"
        value={query}
        placeholder="Search"
        aria-label="Search courses and films"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        data-testid="app-search"
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setRecent(readRecent())
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault()
            go(matches[0].href)
          }
        }}
      />
      <div className="search-panel" id={listId} role="listbox" data-testid="search-panel" hidden={!open}>
          {query.trim() ? (
            matches.length ? matches.map((item) => (
              <a key={item.href} className="search-hit" role="option" href={item.href} data-testid="search-result" onClick={() => remember(query)}>
                <span>{item.title}<small>{item.kind === 'course' ? 'Course' : item.detail}</small></span>
              </a>
            )) : <p className="search-label">Nothing matches that.</p>
          ) : recent.length ? (
            <>
              <p className="search-label">Recent</p>
              {recent.map((term) => (
                <button key={term} type="button" className="search-hit" data-testid="search-recent" onClick={() => setQuery(term)}>{term}</button>
              ))}
            </>
          ) : <p className="search-label">Courses and films</p>}
      </div>
    </div>
  )
}
