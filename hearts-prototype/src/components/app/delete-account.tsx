'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { formatCount } from '@/server/erase/copy'
import type { CountRow, EraseSummary } from '@/server/erase/types'

export function DeleteAccount({ name, next }: { name: string; next: string }) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<EraseSummary | null>(null)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')

  async function load() {
    setOpen(true)
    setError('')
    const response = await fetch('/api/erase?scope=user&self=1&what=summary', { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as EraseSummary & { error?: string }
    if (!response.ok || body?.error) {
      setError(body?.error || 'The summary could not be loaded.')
      return
    }
    setSummary(body)
  }

  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase() && Boolean(name.trim())
  const lines = (summary?.counts || []).filter((row: CountRow) => row.n > 0)

  return (
    <section className="card" data-testid="delete-account" style={{ marginTop: 14 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Delete my account
        <HelpTip topic="delete-account" label="What is Delete my account?">{TOOL.deleteAccount}</HelpTip>
      </h3>
      <p>This wipes your answers, progress and files, then signs you out. It cannot be undone.</p>
      {!open ? (
        <button className="pill outline small" type="button" data-testid="delete-account-open" onClick={() => void load()}>
          Delete my account
        </button>
      ) : (
        <div data-testid="delete-account-panel">
          {error ? <p className="flash error">{error}</p> : null}
          {summary ? (
            <>
              <ul data-testid="delete-account-counts">
                {lines.map((row) => (
                  <li key={row.key}>{formatCount(row.n, row.label)}</li>
                ))}
              </ul>
              <p>
                <a className="pill outline small" href="/api/erase?scope=user&self=1&what=export&format=xlsx" data-testid="delete-account-export">
                  Download a copy first
                </a>
              </p>
              <form action="/api/hearts" method="post" className="form-stack">
                <Hidden fields={{ action: 'delete-account', next, confirmName: typed }} />
                <label>
                  Type your name to confirm
                  <input className="field" value={typed} onChange={(event) => setTyped(event.target.value)} data-testid="delete-account-confirm" autoComplete="off" />
                </label>
                <button className="pill outline small" type="button" onClick={() => setOpen(false)}>Keep my account</button>
                <button className="pill ink small" type="submit" data-testid="delete-account-submit" disabled={!matches}>
                  Wipe my account
                </button>
              </form>
            </>
          ) : !error ? (
            <p className="muted">Counting what will be wiped…</p>
          ) : null}
        </div>
      )}
    </section>
  )
}
