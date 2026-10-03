'use client'

import { useEffect, useRef, useState } from 'react'
import { readHeart, writeHeart, writePending, writePref } from '@/lib/device'
import { freshState } from '@/lib/heart'

/** One setting on the Me tab. Haptics also lives on the device, so the feed can read it without a request. */
export function PrefToggle({ name, label, hint, checked, next }: { name: string; label: string; hint?: string; checked: boolean; next: string }) {
  const form = useRef<HTMLFormElement>(null)
  const [on, setOn] = useState(checked)
  return (
    <form ref={form} action="/api/hearts" method="post" className="pref-row" data-testid={`pref-${name}`}>
      <input type="hidden" name="action" value="me-pref" />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="value" value={on ? 'on' : 'off'} />
      <input type="hidden" name="next" value={next} />
      <label className="toggle" style={{ marginTop: 0 }}>
        <input
          type="checkbox"
          checked={on}
          data-testid={`pref-${name}-input`}
          onChange={(event) => {
            const value = event.target.checked
            setOn(value)
            if (name === 'haptics') writePref('haptics', value)
            window.setTimeout(() => form.current?.requestSubmit(), 0)
          }}
        />
        <span>
          {label}
          {hint ? <small className="muted" style={{ display: 'block', fontWeight: 500, fontSize: 13 }}>{hint}</small> : null}
        </span>
      </label>
    </form>
  )
}

export function StartAgain({ base }: { base: string }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true)
    const response = await fetch('/api/hearts/start-again', { method: 'POST' }).catch(() => null)
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null
      setError(body?.error || 'That did not work. Try again in a moment.')
      setBusy(false)
      return
    }
    writeHeart(null)
    writePending([])
    document.cookie = 'hearts_opened=; Max-Age=0; path=/'
    window.location.assign(`${base}/start`)
  }
  if (!asking) {
    return (
      <button type="button" className="pill outline block" onClick={() => setAsking(true)} data-testid="start-again">
        Start again
      </button>
    )
  }
  return (
    <div className="card" data-testid="start-again-confirm">
      <p style={{ marginTop: 0 }}>This clears your six opening answers here and on our side. Your answers to questions in films stay in your workbook.</p>
      {error ? <p className="flash error" role="alert">{error}</p> : null}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="pill ink small" disabled={busy} onClick={go} data-testid="start-again-yes">Clear and start again</button>
        <button type="button" className="pill outline small" onClick={() => setAsking(false)}>Keep them</button>
      </div>
    </div>
  )
}

/** Opt-in lanes live in the device's heart state only (P1), so this toggle never reaches the server. */
export function OptInLane({ lane, label, hint, portal }: { lane: string; label: string; hint: string; portal: string }) {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => setOn(Boolean(readHeart()?.optInLanes.includes(lane))), [lane])
  return (
    <label className="toggle pref-row" data-testid={`optin-${lane}`}>
      <input
        type="checkbox"
        checked={Boolean(on)}
        disabled={on === null}
        onChange={(event) => {
          const state = readHeart() || freshState(portal, 1)
          const rest = state.optInLanes.filter((key) => key !== lane)
          writeHeart({ ...state, optInLanes: event.target.checked ? [...rest, lane] : rest, updatedAt: Date.now() })
          setOn(event.target.checked)
        }}
      />
      <span>
        {label}
        <small className="muted" style={{ display: 'block', fontWeight: 500, fontSize: 13 }}>{hint}</small>
      </span>
    </label>
  )
}
