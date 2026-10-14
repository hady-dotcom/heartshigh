'use client'

import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ClickRow } from '@/components/desk/row-link'
import { journalUnanswered, journalUnansweredLabel, journalWhen, sortJournalEntries, type JournalOrder } from '@/lib/journal-list'

export type JournalListRow = {
  id: string
  at: string
  answered?: boolean
  text?: string
  name?: string
  href?: string
  portal?: string
  shared?: boolean
}

export function JournalList({
  rows,
  mode = 'table',
  empty,
}: {
  rows: JournalListRow[]
  mode?: 'table' | 'lines'
  empty?: ReactNode
}) {
  const [order, setOrder] = useState<JournalOrder>('newest')
  const top = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const mark = useId()
  const sorted = useMemo(() => sortJournalEntries(rows, order), [rows, order])
  const waiting = journalUnansweredLabel(journalUnanswered(sorted))

  function jump(where: 'top' | 'bottom') {
    const node = where === 'top' ? top.current : bottom.current
    node?.scrollIntoView({ block: where === 'top' ? 'start' : 'end' })
  }

  return (
    <div data-testid="journal-list" data-order={order}>
      <div className="journal-tools">
        <button type="button" className={`btn small${order === 'newest' ? '' : ' ghost'}`} aria-pressed={order === 'newest'} data-testid="journal-newest" onClick={() => setOrder('newest')}>Newest first</button>
        <button type="button" className={`btn small${order === 'oldest' ? '' : ' ghost'}`} aria-pressed={order === 'oldest'} data-testid="journal-oldest" onClick={() => setOrder('oldest')}>Oldest first</button>
        <button type="button" className="btn ghost small" data-testid="journal-jump-top" onClick={() => jump('top')}>Jump to top</button>
        <button type="button" className="btn ghost small" data-testid="journal-jump-bottom" onClick={() => jump('bottom')}>Jump to bottom</button>
        {waiting ? <p className="journal-waiting" data-testid="journal-unanswered">{waiting}</p> : null}
      </div>
      <div ref={top} id={`${mark}-top`} data-testid="journal-list-top" />
      {mode === 'lines' ? (
        <div className="demo-list">
          {sorted.map((row) => (
            <p key={row.id} data-testid="journal-line">
              {row.at ? <span className="hint" data-testid="journal-when">{journalWhen(row.at)}</span> : null}
              {row.at ? ' ' : null}
              {row.text}
            </p>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data people-table">
            <thead><tr><th>Learner</th><th>Portal</th><th>When</th><th>Words</th></tr></thead>
            <tbody>
              {sorted.map((row) => {
                const href = row.href || '#'
                return (
                  <ClickRow key={row.id} href={href} testId="diary-row">
                    <td data-label="Learner"><a href={href} data-testid="diary-open"><b>{row.name || 'A learner'}</b></a></td>
                    <td data-label="Portal" data-testid="diary-portal">{row.portal || '—'}</td>
                    <td data-label="When" data-testid="journal-when">{journalWhen(row.at)}</td>
                    <td data-label="Words">{row.shared ? <span data-testid="diary-shared">Shared</span> : <span data-testid="diary-private">Private</span>}</td>
                  </ClickRow>
                )
              })}
              {!sorted.length ? (
                <tr>
                  <td colSpan={4}>{empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <div ref={bottom} id={`${mark}-bottom`} data-testid="journal-list-bottom" />
    </div>
  )
}
