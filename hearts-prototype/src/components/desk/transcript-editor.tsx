'use client'

import { useEffect, useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { formatTimestamp } from '@/lib/transcript'
import { learnerEmbedSrc } from '@/lib/yt'

function replaceInLines(lines: Line[], find: string, replace: string) {
  if (!find) return { lines, count: 0 }
  let count = 0
  const next = lines.map((line) => {
    if (!line.text.includes(find)) return line
    count += line.text.split(find).length - 1
    return { ...line, text: line.text.split(find).join(replace) }
  })
  return { lines: next, count }
}

type Line = { start: number; end: number; text: string }

export function TranscriptEditor({
  lessonId,
  youtubeId,
  timed,
  lines,
  canUndo,
  canRedo,
  versions,
}: {
  lessonId: number
  youtubeId: string
  timed: boolean
  lines: Line[]
  canUndo: boolean
  canRedo: boolean
  versions: number
}) {
  const [draft, setDraft] = useState(lines)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [note, setNote] = useState('')
  const [at, setAt] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const back = `/master/transcripts/${lessonId}`
  const play = (start: number) => setAt(Math.floor(start))
  const swap = () => {
    const result = replaceInLines(draft, find, replace)
    setDraft(result.lines)
    setNote(result.count ? `Replaced “${find}” in ${result.count} ${result.count === 1 ? 'place' : 'places'}. Save to keep it.` : 'That word is not in this talk.')
  }

  return (
    <div className="tx-editor" data-testid="transcript-editor" data-hydrated={ready ? 'yes' : 'no'}>
      <div className="tx-stage">
        <div className="tx-player" data-testid="transcript-player-box">
          {youtubeId ? (
            <iframe
              key={at ?? 'start'}
              title="Talk"
              src={learnerEmbedSrc(youtubeId, { start: at ?? 0, autoplay: at == null ? 0 : 1, controls: 1, playsinline: 1, rel: 0, skipOrigin: 1 })}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              data-testid="transcript-player"
              data-start={at ?? 0}
            />
          ) : (
            <p className="hint">This talk has no YouTube film. The lines are still here to edit.</p>
          )}
        </div>
        <div className="tx-tools">
          {youtubeId ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'fetch-talk-captions', lesson: lessonId, next: back }} />
              <button className="btn ghost small" type="submit" data-testid="transcript-refetch">{lines.length ? 'Get captions from YouTube again' : 'Get captions from YouTube'}</button>
            </form>
          ) : null}
          {lines.length ? <a className="btn ghost small" href={`/master/transcripts/${lessonId}/vtt`} data-testid="transcript-download">Download .vtt</a> : null}
          {canUndo ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'undo-transcript', lesson: lessonId, next: back }} />
              <button className="btn ghost small" type="submit" data-testid="transcript-undo">Undo</button>
            </form>
          ) : null}
          {canRedo ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'redo-transcript', lesson: lessonId, next: back }} />
              <button className="btn ghost small" type="submit" data-testid="transcript-redo">Redo</button>
            </form>
          ) : null}
          {versions ? <span className="hint">{versions} earlier {versions === 1 ? 'save' : 'saves'}</span> : null}
        </div>
      </div>
      {draft.length ? (
        <form className="tx-lines" action="/api/hearts" method="post" data-testid="transcript-lines">
          <Hidden fields={{ action: 'save-transcript', lesson: lessonId, next: back, timed: timed ? 'yes' : 'no' }} />
          <div className="tx-find">
            <label>Find<input value={find} onChange={(event) => setFind(event.target.value)} data-testid="transcript-find" /></label>
            <label>Replace with<input value={replace} onChange={(event) => setReplace(event.target.value)} data-testid="transcript-replace" /></label>
            <button className="btn ghost small" type="button" onClick={swap} data-testid="transcript-replace-all">Replace</button>
          </div>
          {note ? <p className="hint" data-testid="transcript-replace-note">{note}</p> : null}
          <ol>
            {draft.map((line, index) => (
              <li key={`${line.start}-${index}`} className="tx-line" data-testid="transcript-line">
                <button type="button" className="tx-time" onClick={() => play(line.start)} disabled={!youtubeId} data-testid="transcript-line-play">{formatTimestamp(line.start)}</button>
                <input type="hidden" name="start" value={line.start} />
                <input type="hidden" name="end" value={line.end} />
                <textarea name="text" rows={2} value={line.text} aria-label={`Line at ${formatTimestamp(line.start)}`} data-testid="transcript-line-text" onChange={(event) => setDraft(draft.map((item, at) => at === index ? { ...item, text: event.target.value } : item))} />
              </li>
            ))}
          </ol>
          <div className="actions"><button className="btn ink" type="submit" data-testid="transcript-save">Save</button></div>
        </form>
      ) : (
        <p data-testid="transcript-no-lines">This talk has no words yet. Get captions from YouTube, or add a file from the list and pick this title.</p>
      )}
    </div>
  )
}
