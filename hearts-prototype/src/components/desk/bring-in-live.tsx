'use client'

import { useEffect, useState } from 'react'
import { vimeoWaitingLabel } from '@/lib/vimeo'

type Row = { id: number; title: string; status: string; publishState: string; note: string; speaker: string; youtubeId: string }

const LABEL: Record<string, string> = {
  queued: 'Getting captions… (usually under 30 min)',
  processing: 'Getting captions… (usually under 30 min)',
  waiting: 'Getting captions… (usually under 30 min)',
  processed: 'Ready to publish',
  failed: "Couldn't get captions: upload a transcript",
}

export function BringInLive({ ids, next = '' }: { ids: number[]; next?: string }) {
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
              <td>
                <span className={`badge ${row.status === 'failed' ? 'rose' : row.status === 'processed' ? 'teal' : 'gold'}`}>{(row.status === 'waiting' && vimeoWaitingLabel(row.note)) || LABEL[row.status] || 'Saved'}</span>
                {row.status === 'processed' && row.publishState === 'draft' ? (
                  <form action="/api/hearts" method="post">
                    <input type="hidden" name="action" value="publish-talks" />
                    <input type="hidden" name="lesson" value={row.id} />
                    <input type="hidden" name="giveHolders" value="yes" />
                    <input type="hidden" name="next" value={next} />
                    <button className="btn teal small" type="submit" data-testid="bring-in-live-publish">Publish</button>
                  </form>
                ) : null}
                {row.status === 'failed' ? (
                  <form action="/api/hearts" method="post" encType="multipart/form-data">
                    <input type="hidden" name="action" value="upload-transcript" />
                    <input type="hidden" name="lesson" value={row.id} />
                    <input type="hidden" name="next" value={next} />
                    <label className="btn ghost small">Upload a transcript<input type="file" name="file" accept=".vtt,.srt,.txt,.md" data-testid="bring-in-live-upload" style={{ display: 'none' }} onChange={(event) => event.currentTarget.form?.requestSubmit()} /></label>
                  </form>
                ) : null}
                {row.status === 'queued' || row.status === 'processing' || row.status === 'waiting' ? (
                  <button className="btn ghost small" type="button" data-testid="bring-in-live-check" onClick={() => window.location.reload()}>Check again</button>
                ) : null}
              </td>
              <td>{row.publishState === 'draft' ? 'Draft, hidden' : row.status === 'waiting' || row.status === 'failed' ? 'Published, still hidden' : 'Published'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
