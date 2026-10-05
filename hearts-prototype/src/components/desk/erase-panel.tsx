'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { deskTokens } from '@/lib/desk-tokens'
import { formatCount, wipeIntro } from '@/server/erase/copy'
import type { EraseSummary, PersonMode } from '@/server/erase/types'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

export function ErasePanel({
  action,
  next,
  portalSlug,
  portalId,
  personId,
  personName,
  confirmValue,
  kind,
  defaultMode = 'account',
  otherPortals = [],
  help,
  helpTopic,
  label,
  testId,
}: {
  action: 'delete-portal' | 'delete-person'
  next: string
  portalSlug?: string
  portalId?: number
  personId?: number
  personName?: string
  confirmValue: string
  kind: 'portal' | 'user'
  defaultMode?: PersonMode
  otherPortals?: { id: number; name: string }[]
  help: string
  helpTopic: string
  label: string
  testId: string
}) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<EraseSummary | null>(null)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [mode, setMode] = useState<PersonMode>(defaultMode)
  const [ready, setReady] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const manyHomes = otherPortals.length > 0

  useEffect(() => setReady(true), [])

  useEffect(() => {
    if (!open) return
    const root = dialogRef.current
    const prior = openerRef.current
    const nodes = () => [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) || [])]
    const confirm = root?.querySelector<HTMLElement>(`[data-testid="${testId}-confirm"]`)
    ;(confirm || nodes()[0])?.focus({ preventScroll: true })

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const list = nodes()
      if (!list.length) return
      const index = list.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) {
        event.preventDefault()
        list[list.length - 1]?.focus()
      } else if (!event.shiftKey && index === list.length - 1) {
        event.preventDefault()
        list[0]?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      prior?.focus()
    }
  }, [open, summary, testId])

  async function load() {
    setOpen(true)
    setError('')
    setSummary(null)
    setTyped('')
    const params = new URLSearchParams({ scope: kind, what: 'summary' })
    if (kind === 'portal' && portalId) params.set('id', String(portalId))
    if (kind === 'user' && personId) params.set('id', String(personId))
    if (portalSlug) params.set('portal', portalSlug)
    if (kind === 'user') params.set('mode', mode)
    const response = await fetch(`/api/erase?${params.toString()}`, { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as EraseSummary & { error?: string }
    if (!response.ok || body?.error) {
      setError(body?.error || 'The summary could not be loaded.')
      return
    }
    setSummary(body)
  }

  const exportHref = (() => {
    const params = new URLSearchParams({ scope: kind, what: 'export', format: 'xlsx' })
    if (kind === 'portal' && portalId) params.set('id', String(portalId))
    if (kind === 'user' && personId) params.set('id', String(personId))
    if (portalSlug) params.set('portal', portalSlug)
    if (kind === 'user') params.set('mode', mode)
    return `/api/erase?${params.toString()}`
  })()

  const matches = typed.trim().toLowerCase() === confirmValue.trim().toLowerCase() && Boolean(confirmValue.trim())
  const title = kind === 'portal' ? 'Delete this portal' : `Delete ${personName || 'this person'}`

  const dialog = open && ready ? createPortal(
    <div
      className="erase-dialog-back"
      data-testid={`${testId}-backdrop`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div
        ref={dialogRef}
        className="erase-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={`${testId}-panel`}
        style={{
          background: deskTokens.card,
          color: deskTokens.ink,
          border: `1px solid ${deskTokens.line}`,
        }}
      >
        <div className="erase-dialog-head">
          <h3 id={titleId} style={{ margin: '0 0 8px', color: deskTokens.heading, fontSize: 18 }}>{title}</h3>
          {error ? <p className="flash error" data-testid={`${testId}-error`}>{error}</p> : null}
        </div>
        {summary ? (
          <>
            <div className="erase-dialog-body">
              <p style={{ margin: '0 0 10px' }} data-testid={`${testId}-summary`}>
                {wipeIntro(kind, personName || confirmValue)}
              </p>
              <ul data-testid={`${testId}-counts`} style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                {summary.counts.filter((row) => row.n > 0).map((row) => (
                  <li key={row.key}>{formatCount(row.n, row.label)}</li>
                ))}
              </ul>
              {kind === 'user' && manyHomes ? (
                <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }} data-testid={`${testId}-homes`}>
                  <legend style={{ fontWeight: 600, marginBottom: 6 }}>This account is also in another portal</legend>
                  <label style={{ display: 'block', marginBottom: 6 }}>
                    <input type="radio" name={`${testId}-mode`} checked={mode === 'portal'} onChange={() => setMode('portal')} />
                    {' '}Take them off this portal only
                  </label>
                  <label style={{ display: 'block' }}>
                    <input type="radio" name={`${testId}-mode`} checked={mode === 'account'} onChange={() => setMode('account')} />
                    {' '}Wipe the whole account
                  </label>
                </fieldset>
              ) : kind === 'user' ? (
                <p className="hint" data-testid={`${testId}-one-home`}>This account belongs only to this portal, so deleting them removes the account.</p>
              ) : null}
              <p style={{ margin: '0 0 10px' }}>
                <a className="btn ghost small" href={exportHref} data-testid={`${testId}-export`}>Download a copy first</a>
                <HelpTip topic="download-copy" label="What is Download a copy first?" place="end">
                  Download writes a workbook of the rows that will be wiped. Keep it if you may need the names or answers later. The wipe still needs you to type the name.
                </HelpTip>
              </p>
            </div>
            <form className="erase-dialog-foot" action="/api/hearts" method="post">
              <Hidden
                fields={{
                  action,
                  next,
                  portalSlug: portalSlug || '',
                  person: personId || '',
                  mode,
                  confirmName: typed,
                }}
              />
              <label className="stack erase-confirm">
                {summary.confirmLabel}
                <input
                  type="text"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  data-testid={`${testId}-confirm`}
                  autoComplete="off"
                  placeholder={confirmValue}
                />
              </label>
              <div className="actions" style={{ marginTop: 10 }}>
                <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>Keep it</button>
                <button className="btn danger small" type="submit" data-testid={`${testId}-submit`} disabled={!matches}>
                  Wipe
                </button>
              </div>
            </form>
          </>
        ) : !error ? (
          <p className="hint">Counting what will be wiped…</p>
        ) : null}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <div data-testid={testId} className="erase-trigger">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <button ref={openerRef} className="btn danger small" type="button" data-testid={`${testId}-open`} onClick={() => void load()}>
          {label}
        </button>
        <HelpTip topic={helpTopic} label={`What is ${label}?`} place="end">{help}</HelpTip>
      </span>
      {dialog}
    </div>
  )
}
