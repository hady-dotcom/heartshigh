'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Hidden } from '@/components/app/shell'

/**
 * Checking in stays on this card. A full reload would jump to the notice at the top of the page
 * and the welcome would have to be scrolled back into view.
 */
export function DoorArrival({ id, next, reflectHref }: { id: number; next: string; reflectHref: string }) {
  const [arrived, setArrived] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const scrollTop = useRef<number | null>(null)
  const heldHeight = useRef(0)

  useLayoutEffect(() => {
    if (scrollTop.current == null) return
    const scroller = document.scrollingElement
    if (scroller) scroller.scrollTop = scrollTop.current
    scrollTop.current = null
  }, [arrived, error])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const section = form.closest('section')
    heldHeight.current = section instanceof HTMLElement ? section.offsetHeight : 0
    scrollTop.current = document.scrollingElement?.scrollTop ?? window.scrollY
    setPending(true)
    setError('')
    const response = await fetch('/api/gather', {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    })
    const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    setPending(false)
    if (!response.ok || !data?.ok) {
      setError(data?.error || 'That door code does not match this gathering.')
      return
    }
    setArrived(true)
  }

  if (arrived) {
    return (
      <section className="gather-card welcome-card" id="at-the-door" data-testid="checked-in" style={{ minHeight: heldHeight.current || undefined }}>
        <h3 style={{ marginTop: 0 }} data-testid="welcome-in">You’re in. Welcome.</h3>
        <Link className="pill gold small" href={reflectHref} data-testid="reflect-open">Write one thing you’ll carry</Link>
      </section>
    )
  }

  return (
    <section className="gather-card door-checkin" id="at-the-door" data-testid="door-checkin">
      <h3>At the door</h3>
      <p>Scan the QR on the poster, or type the 4-character door code.</p>
      <form action="/api/gather" method="post" onSubmit={onSubmit}>
        <Hidden fields={{ action: 'checkin', method: 'code', id, next }} />
        <label>Door code
          <input className="field entry-code" name="code" inputMode="text" autoCapitalize="characters" autoComplete="off" maxLength={4} required data-testid="entry-code" />
        </label>
        {error ? <p className="door-error" role="alert" data-testid="door-error">{error}</p> : null}
        <button className="pill gold block" type="submit" data-testid="code-checkin" disabled={pending}>I’m here</button>
      </form>
    </section>
  )
}
