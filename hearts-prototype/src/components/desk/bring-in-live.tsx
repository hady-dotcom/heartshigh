'use client'

import { useEffect, useState } from 'react'

type Row = { id: number; title: string; status: string; publishState: string; note: string; speaker: string; youtubeId: string }

const LABEL: Record<string, string> = {
  queued: 'Queued',
  processing: 'Processing',
  waiting: 'Waiting for transcript',
  processed: 'Processed',
  failed: 'Failed',
}

export function BringInLive({ ids }: { ids: number[] }) {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => {
    if (!ids.length) return
    let stop = false
    const load = async () => {
      const response = await fetch(`/api/hearts/bring-in-status?ids=${ids.join(',')}`, { headers: { accept: 'application/json' } })
      if (!response.ok || stop) return
      const body = (await response.json()) as { lessons?: Row[] }
      const next = body.lessons || []
      setRows(next)
      if (next.every((row) => row.status !== 'queued' && row.status !== 'processing')) stop = true
    }
    void load()
    const timer = window.setInterval(() => {
      if (!stop) void load()
    }, 2000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [ids])
  if (!rows.length) return null
  return (
    <div className="table-wrap" data-testid="bring-in-live">
      <table className="data">
        <thead><tr><th>Film</th><th>Speaker</th><th>Status</th><th>Learners</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="bring-in-live-row" data-status={row.status} data-publish={row.publishState}>
              <td>{row.title}</td>
              <td>{row.speaker || 'Not set'}</td>
              <td><span className={`badge ${row.status === 'failed' ? 'rose' : row.status === 'processed' ? 'teal' : 'gold'}`}>{LABEL[row.status] || 'Saved'}</span></td>
              <td>{row.publishState === 'draft' ? 'Draft, hidden' : row.status === 'waiting' || row.status === 'failed' ? 'Published, still hidden' : 'Published'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
