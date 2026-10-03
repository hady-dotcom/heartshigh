'use client'

import { useEffect, useRef, useState } from 'react'
import { wipeViewAs } from '@/lib/device'

type Status = { active: boolean; leftMs?: number; idleLeftMs?: number; writeEnabled?: boolean; ended?: string | null }

export function ViewAsBar({ name, sessionId, writeEnabled, leftMs, returnTo }: { name: string; sessionId: string; writeEnabled: boolean; leftMs: number; returnTo: string }) {
  const [left, setLeft] = useState(leftMs)
  const [idleLeft, setIdleLeft] = useState(leftMs)
  const [write, setWrite] = useState(writeEnabled)
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)
  const exiting = useRef(false)

  useEffect(() => {
    document.body.dataset.viewas = write ? 'write' : 'read-only'
    window.localStorage.setItem('hearts.viewas.active', sessionId)
    const disable = () => {
      if (write) return
      document.querySelectorAll<HTMLElement>('main form button[type="submit"], main form input[type="submit"], main [data-write]').forEach((el) => {
        if (el.closest('[data-viewas-bar]')) return
        el.setAttribute('disabled', '')
        el.setAttribute('title', 'Read-only while viewing as')
        el.dataset.viewasDisabled = 'yes'
      })
    }
    disable()
    const observer = new MutationObserver(disable)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      delete document.body.dataset.viewas
    }
  }, [write, sessionId])

  useEffect(() => {
    const poll = async () => {
      const response = await fetch('/api/view-as/status', { cache: 'no-store' }).catch(() => null)
      const data = (await response?.json().catch(() => null)) as Status | null
      if (!data || exiting.current) return
      if (!data.active) {
        wipeViewAs()
        window.location.reload()
        return
      }
      setLeft(data.leftMs ?? 0)
      setIdleLeft(data.idleLeftMs ?? 0)
      setWrite(Boolean(data.writeEnabled))
    }
    timer.current = window.setInterval(poll, 3000)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [])

  const exit = async () => {
    exiting.current = true
    if (timer.current) window.clearInterval(timer.current)
    setBusy(true)
    const response = await fetch('/api/view-as/stop', { method: 'POST' })
    const data = (await response.json().catch(() => ({}))) as { returnTo?: string }
    wipeViewAs(sessionId)
    window.location.href = data.returnTo || returnTo || '/'
  }

  const keep = async () => {
    const response = await fetch('/api/view-as/keepalive', { method: 'POST' })
    const data = (await response.json().catch(() => null)) as Status | null
    if (data?.active) {
      setLeft(data.leftMs ?? 0)
      setIdleLeft(data.idleLeftMs ?? 0)
    }
  }

  const toggleWrite = async (on: boolean) => {
    setBusy(true)
    const response = await fetch('/api/view-as/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on, reason }) })
    setBusy(false)
    if (response.ok) {
      setWrite(on)
      setAsking(false)
      setReason('')
      window.location.reload()
    }
  }

  const minutes = Math.max(0, Math.ceil(left / 60_000))
  return (
    <div className="viewas-bar" role="status" data-testid="viewas-banner" data-viewas-bar data-mode={write ? 'write' : 'read-only'}>
      <div className="viewas-row">
        <span className="viewas-text" data-testid="viewas-text">
          Viewing as {name}. <button type="button" className="viewas-exit" onClick={exit} disabled={busy} data-testid="viewas-exit">Exit</button>
        </span>
        <span className="viewas-meta">
          <span data-testid="viewas-mode">{write ? 'Changes allowed' : 'Read-only'}</span>
          <span aria-hidden="true"> · </span>
          <span data-testid="viewas-left">{minutes} min left</span>
          {write ? (
            <button type="button" className="viewas-link" onClick={() => toggleWrite(false)} data-testid="viewas-write-off">Stop changes</button>
          ) : (
            <button type="button" className="viewas-link" onClick={() => setAsking(true)} data-testid="viewas-allow">Allow changes</button>
          )}
        </span>
      </div>
      {idleLeft <= 2 * 60_000 ? (
        <div className="viewas-toast" data-testid="viewas-keep-toast">
          This view ends in {Math.max(0, Math.ceil(idleLeft / 60_000))} min if nothing happens.
          <button type="button" className="viewas-link" onClick={keep} data-testid="viewas-keep">Keep viewing</button>
        </div>
      ) : null}
      {asking ? (
        <div className="viewas-dialog" role="dialog" aria-label="Allow changes" data-testid="viewas-dialog">
          <label>
            Why do you need to make changes for {name}?
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} data-testid="viewas-write-reason" />
          </label>
          <p>Changes stay on for 10 minutes at most, and each one is written to the audit log.</p>
          <div className="viewas-actions">
            <button type="button" className="viewas-link" onClick={() => setAsking(false)}>Cancel</button>
            <button type="button" className="viewas-confirm" disabled={!reason.trim() || busy} onClick={() => toggleWrite(true)} data-testid="viewas-write-confirm">Allow changes</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ViewAsEnded({ reason }: { reason: string }) {
  useEffect(() => {
    wipeViewAs()
    fetch('/api/view-as/clear', { method: 'POST' }).catch(() => undefined)
  }, [])
  const timedOut = reason === 'idle-timeout' || reason === 'max-timeout'
  return (
    <div className="viewas-ended" role="status" data-testid="viewas-ended">
      {timedOut ? 'View as ended (timed out)' : 'View as ended'}
    </div>
  )
}

/** Wipes any view-as storage left behind when the session ended while the page was closed. */
export function ViewAsSweep() {
  useEffect(() => {
    if (window.localStorage.getItem('hearts.viewas.active')) wipeViewAs()
  }, [])
  return null
}
