'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { EASE, T, animate, finished } from '@/lib/motion'

/** save: Save, Like or Follow. place: a tab, Me, the speaker page or the full talk, where nothing was kept yet. */
export type SheetReason = 'save' | 'place'

export const SHEET_TITLES: Record<SheetReason, string> = {
  save: 'Want us to keep that one for you?',
  place: 'Want us to keep your place?',
}

/**
 * Sign-up for a guest. It opens only when a guest taps something that needs an account
 * (Save, Like, Follow, the speaker, the full talk, Me or another tab), never on its own between clips.
 * Rises over the lower half; the clip above stays paused and nothing advances until it closes.
 * The account is made in the same request that carries the opening off the device.
 */
export function KeepPlaceSheet({ reason, loginHref, offline, onClose, onSubmit }: {
  reason: SheetReason
  loginHref: string
  offline: boolean
  onClose: () => void
  onSubmit: (account: { name: string; email: string; password: string }) => Promise<string | null>
}) {
  const ref = useRef<HTMLElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(false)

  useEffect(() => {
    animate(ref.current, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], T.sheet, EASE.enter, { id: 'sheet-in' })
  }, [])

  const close = async () => {
    await finished(animate(ref.current, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(100%)', opacity: 1 }], T.exit, EASE.exit, { id: 'sheet-out' }))
    onClose()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    const problem = await onSubmit({ name: String(data.get('name') || ''), email: String(data.get('email') || ''), password: String(data.get('password') || '') })
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <section ref={ref} className="j-sheet" role="dialog" aria-labelledby="keep-title" data-testid="keep-sheet" data-reason={reason}>
      <span className="handle" aria-hidden />
      <h2 id="keep-title" data-testid="keep-title">{SHEET_TITLES[reason]}</h2>
      {offline ? (
        <p data-testid="sheet-offline">Connect to keep your place. Your taps stay on this phone until then.</p>
      ) : (
        <p>{reason === 'place' ? <>Make an account to open this, and we&apos;ll remember where you got to and what you liked. Your taps stay on this phone until you make one.</> : <>Make an account and we&apos;ll remember what you liked, so the next clips fit you better. Your taps stay on this phone until you make one.</>}</p>
      )}
      {form && !offline ? (
        <form className="j-sheet-form" onSubmit={submit} data-testid="keep-form">
          <input className="field" name="name" autoComplete="name" placeholder="Your name" required maxLength={80} data-testid="keep-name" />
          <input className="field" name="email" type="email" autoComplete="email" placeholder="Email" required data-testid="keep-email" />
          <input className="field" name="password" type="password" autoComplete="new-password" placeholder="Password (8 or more characters)" minLength={8} required data-testid="keep-password" />
          {error ? <p className="j-sheet-error" role="alert" data-testid="keep-error">{error}</p> : null}
          <button type="submit" className="pill gold block" disabled={busy} data-testid="keep-submit">{busy ? 'Keeping your place…' : 'Keep my place ›'}</button>
        </form>
      ) : (
        <button type="button" className="pill gold block" disabled={offline} onClick={() => setForm(true)} data-testid="keep-open">Keep my place ›</button>
      )}
      <button type="button" className="j-escape dark" onClick={close} data-testid="not-now">Not now, keep watching</button>
      <p className="j-sheet-small">Already with us? <a href={loginHref} data-testid="sheet-login">Log in</a></p>
    </section>
  )
}
