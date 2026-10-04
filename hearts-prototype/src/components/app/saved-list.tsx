'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { deviceKey } from '@/lib/device'

export function SavedList({ base }: { base: string }) {
  const [ids, setIds] = useState<string[] | null>(null)
  useEffect(() => {
    try {
      setIds(JSON.parse(window.localStorage.getItem(deviceKey('hearts.saved.v1')) || '[]'))
    } catch {
      setIds([])
    }
  }, [])
  if (ids == null) return <p className="muted">Loading your saved clips…</p>
  if (!ids.length) {
    return <p className="muted" data-testid="saved-empty">Nothing saved yet. On a clip, tap Save. It will wait for you here.</p>
  }
  return (
    <div data-testid="saved-list">
      {ids.map((id) => {
        const cut = Number(String(id).replace(/\D/g, ''))
        const href = cut ? `${base}/feed?clip=${cut}` : `${base}/feed`
        return (
          <Link key={id} className="list-link" href={href} data-testid="saved-item">
            <span className="grow">A saved clip<small>Opens in your feed.</small></span>›
          </Link>
        )
      })}
    </div>
  )
}
