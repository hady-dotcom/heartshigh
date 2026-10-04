/**
 * Tiny client helper. Failures are swallowed so a missing experiment never
 * breaks a tap, a watch, or an install.
 */
import type { TrackedEvent } from './experiment-slots'

export type TrackProps = Record<string, string | number | boolean | null | undefined>

function bodyOf(event: string, props?: TrackProps) {
  const form = new FormData()
  form.set('action', 'track')
  form.set('event', event)
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue
      form.set(`prop_${key}`, String(value))
    }
  }
  return form
}

export function track(event: TrackedEvent | string, props?: TrackProps) {
  if (typeof window === 'undefined') return
  try {
    void fetch('/api/experiments', { method: 'POST', headers: { accept: 'application/json' }, body: bodyOf(event, props) }).catch(() => undefined)
  } catch {
    // Private browsing or a blocked request: the tap still works.
  }
}

export function expose(slot: string, sessionId?: string) {
  if (typeof window === 'undefined' || !slot) return
  try {
    const key = `hearts.exp.exposed.${slot}`
    if (window.sessionStorage.getItem(key) === '1') return
    const form = new FormData()
    form.set('action', 'expose')
    form.set('slot', slot)
    if (sessionId) form.set('session', sessionId)
    void fetch('/api/experiments', { method: 'POST', headers: { accept: 'application/json' }, body: form })
      .then((response) => {
        if (response.ok) window.sessionStorage.setItem(key, '1')
      })
      .catch(() => undefined)
  } catch {
    // ignore
  }
}

export function sessionId() {
  if (typeof window === 'undefined') return ''
  try {
    const key = 'hearts.exp.session'
    const held = window.sessionStorage.getItem(key)
    if (held) return held
    const next = `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    window.sessionStorage.setItem(key, next)
    return next
  } catch {
    return ''
  }
}
