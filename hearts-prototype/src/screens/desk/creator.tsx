'use client'

import { useState } from 'react'
import type { TalkCandidate } from '@/lib/sheet-search'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

type Course = { id: number; title: string }
type Upload = { mediaId: number; name: string }
type ProgressLine = { id: string; title: string; state: string }

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function captionLabel(flag: TalkCandidate['captions']) {
  if (flag === 'yes') return 'Has captions'
  if (flag === 'no') return 'No captions'
  if (flag === 'unavailable') return 'Not available'
  return 'Captions could not be checked'
}

async function readBody(response: Response) {
  const text = await response.text()
  if (!text) return {} as Record<string, unknown>
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
    return { error: plain || 'The desk sent a page instead of an answer.' }
  }
}

function pastedLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

export function CreatorForm({ courses, endpoint, next }: { courses: Course[]; endpoint: string; next: string }) {
  const [topic, setTopic] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [courseId, setCourseId] = useState(courses[0] ? String(courses[0].id) : '')
  const [part, setPart] = useState('Talks')
  const [count, setCount] = useState('8')
  const [min, setMin] = useState('300')
  const [max, setMax] = useState('')
  const [pasted, setPasted] = useState('')
  const [candidates, setCandidates] = useState<TalkCandidate[]>([])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [uploads, setUploads] = useState<Upload[]>([])
  const [via, setVia] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState<ProgressLine[]>([])

  const ticked = candidates.filter((item) => picked[item.id])
  const links = pastedLines(pasted)

  const search = async () => {
    setBusy('search')
    setError('')
    setProgress([])
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          intent: 'search',
          topic,
          speaker,
          count: Number(count) || 8,
          minSeconds: min.trim() === '' ? null : Number(min),
          maxSeconds: max.trim() === '' ? null : Number(max),
        }),
      })
      const body = await readBody(response)
      if (!response.ok) {
        setError(String(body.error || 'Search did not run.'))
        setBusy('')
        return
      }
      setCandidates((body.candidates as TalkCandidate[]) || [])
      setVia(String(body.via || ''))
      setPicked({})
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Search did not run.')
    }
    setBusy('')
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy('upload')
    setError('')
    const form = new FormData()
    form.set('intent', 'upload')
    form.set('file', file)
    try {
      const response = await fetch(endpoint, { method: 'POST', body: form, headers: { accept: 'application/json' } })
      const body = await readBody(response)
      if (!response.ok || !body.mediaId) setError(String(body.error || 'That video did not upload.'))
      else setUploads((rows) => [...rows, { mediaId: Number(body.mediaId), name: String(body.name || file.name) }])
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'That video did not upload.')
    }
    setBusy('')
  }

  const removePaste = (line: string) => {
    let removed = false
    setPasted(pasted.split('\n').filter((row) => {
      if (!removed && row.trim() === line) {
        removed = true
        return false
      }
      return true
    }).join('\n'))
  }

  const build = async () => {
    setBusy('build')
    setError('')
    const sources = [
      ...ticked.map((item) => ({
        provider: 'youtube' as const,
        id: item.id,
        title: item.title,
        channel: item.channel,
        speaker,
        durationSeconds: item.durationSeconds,
      })),
      ...uploads.map((item) => ({
        provider: 'file' as const,
        mediaId: item.mediaId,
        title: item.name.replace(/\.[a-z0-9]+$/i, ''),
        durationSeconds: null,
      })),
    ]
    try {
      const collectedResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ intent: 'collect', topic, speaker, course: courseId, part, pasted, sources }),
      })
      const collected = await readBody(collectedResponse)
      if (!collectedResponse.ok || collected.ok === false) {
        setError(String(collected.error || 'Choose at least one talk, or paste a link.'))
        setBusy('')
        return
      }
      const queue = Array.isArray(collected.sources) ? collected.sources as { provider?: string; id?: string; mediaId?: number; title?: string }[] : []
      const drafted: { included?: boolean; warn?: boolean; detail?: string; title?: string; talk?: unknown; questions?: unknown[]; resources?: unknown[] }[] = []
      const lineFor = (index: number, active: string) => queue.map((item, itemIndex) => ({
        id: `${item.provider || 'talk'}:${item.id || item.mediaId || itemIndex}:${itemIndex}`,
        title: String(item.title || item.id || 'This talk'),
        state: itemIndex < index ? String(drafted[itemIndex]?.detail || 'Done') : itemIndex === index ? active : 'Waiting',
      }))
      for (let index = 0; index < queue.length; index += 1) {
        const source = queue[index]
        const title = String(source.title || source.id || 'This talk')
        setProgress(lineFor(index, 'Reading captions…'))
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ intent: 'draft-one', topic, speaker, course: courseId, part, source }),
          })
          const body = await readBody(response)
          drafted.push(response.ok ? body : { included: false, warn: true, detail: String(body.error || 'This talk could not be drafted.'), title })
        } catch (caught) {
          drafted.push({ included: false, warn: true, detail: caught instanceof Error && caught.message ? caught.message : 'This talk could not be drafted.', title })
        }
        setProgress(lineFor(index + 1, 'Waiting'))
      }
      const included = drafted.filter((item) => item.included && item.talk)
      if (!included.length) {
        setError(drafted.map((item) => item.detail).filter(Boolean).join('\n') || 'Choose at least one talk, or paste a link.')
        setBusy('')
        return
      }
      const savedResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          intent: 'assemble',
          topic,
          speaker,
          course: courseId,
          part,
          talks: included.map((item) => item.talk),
          questions: included.flatMap((item) => item.questions || []),
          resources: included.flatMap((item) => item.resources || []),
          notices: drafted.filter((item) => item.warn && item.detail).map((item) => `${item.title || 'A talk'}: ${item.detail}`),
        }),
      })
      const saved = await readBody(savedResponse)
      if (!savedResponse.ok || !saved.importId) {
        setError(String(saved.error || drafted.map((item) => item.detail).filter(Boolean).join('\n') || 'The draft could not be built.'))
        setBusy('')
        return
      }
      window.location.assign(`${next}?preview=${saved.importId}`)
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'The draft could not be built.')
      setBusy('')
    }
  }

  const buildButton = (testId: string) => (
    <button className="btn teal" type="button" data-testid={testId} disabled={Boolean(busy)} onClick={build}>{busy === 'build' ? 'Building the draft…' : 'Build draft sheet'}</button>
  )

  return (
    <div data-testid="sheet-creator">
      <section className="panel" id="creator-search">
        <header><div><h2>What should the sheet be about? <HelpTip topic="creator-search">{TOOL.creatorSearch}</HelpTip></h2><p>Search, tick the talks you want, and the desk builds a draft. Nothing goes live until you apply the preview.</p></div></header>
        <div className="body form">
          <label className="stack">Topic
            <input data-testid="creator-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Light, patience, the names" />
          </label>
          <div className="creator-fields">
            <label className="stack">Speaker or channel, if you have one
              <input data-testid="creator-speaker" value={speaker} onChange={(event) => setSpeaker(event.target.value)} placeholder="Optional" />
            </label>
            <label className="stack">How many talks
              <input data-testid="creator-count" value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
            </label>
            <label className="stack">Shortest, in seconds
              <input data-testid="creator-min" value={min} onChange={(event) => setMin(event.target.value)} inputMode="numeric" placeholder="300 is five minutes" />
            </label>
            <label className="stack">Longest, in seconds
              <input data-testid="creator-max" value={max} onChange={(event) => setMax(event.target.value)} inputMode="numeric" placeholder="Optional" />
            </label>
          </div>
          <div className="actions"><button className="btn" type="button" data-testid="creator-search" disabled={busy === 'search'} onClick={search}>{busy === 'search' ? 'Searching…' : 'Search YouTube'}</button>{via ? <span className="hint">via {via}</span> : null}</div>
        </div>
      </section>

      {candidates.length ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <header><div><h2>Candidates</h2><p>Tick the ones to include. Captions let the draft cut the hors d&apos;oeuvre and the appetiser.</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 12 }}>
            <div className="creator-tools">
              <button className="btn" type="button" data-testid="creator-select-all" onClick={() => setPicked(Object.fromEntries(candidates.map((item) => [item.id, true])))}>Select all</button>
              <button className="btn ghost" type="button" data-testid="creator-clear-all" onClick={() => setPicked({})}>Clear all</button>
              <span className="hint" data-testid="creator-ticked">{ticked.length} ticked</span>
            </div>
            {candidates.map((item) => (
              <div key={item.id} className="lib-card creator-candidate" data-testid="creator-candidate" data-id={item.id}>
                {item.thumbnail ? <img className="creator-thumb" src={item.thumbnail} alt="" width={88} height={50} /> : <span className="hint creator-thumb">No picture</span>}
                <span>
                  <b>{item.title}</b>
                  <small>{item.channel || 'Channel unknown'} · {item.durationSeconds ? clock(item.durationSeconds) : 'Length unknown'} · <span data-testid="creator-captions">{captionLabel(item.captions)}</span></small>
                </span>
                <input type="checkbox" data-testid="creator-include" checked={Boolean(picked[item.id])} onChange={(event) => setPicked((value) => ({ ...value, [item.id]: event.target.checked }))} aria-label={`Include ${item.title}`} />
              </div>
            ))}
            <div className="actions">{buildButton('creator-build-candidates')}</div>
          </div>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 18 }}>
        <header><div><h2>Or bring talks in yourself</h2><p>Paste YouTube or Vimeo links, or upload a video file. Uploads are stored with the other media and play in the lesson.</p></div></header>
        <div className="body form">
          <label className="stack">YouTube or Vimeo links, one per line
            <textarea data-testid="creator-paste" rows={4} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'https://www.youtube.com/watch?v=…\nhttps://vimeo.com/76979871'} />
          </label>
          <label className="stack">Upload a video
            <input data-testid="creator-file" type="file" accept="video/*" onChange={(event) => upload(event.target.files?.[0])} />
          </label>
          {uploads.map((item) => <p key={item.mediaId} className="hint" data-testid="creator-uploaded">Uploaded {item.name}</p>)}
          <label className="stack">Course
            <select data-testid="creator-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="stack">Part
            <input data-testid="creator-part" value={part} onChange={(event) => setPart(event.target.value)} />
          </label>
          <div className="actions">{buildButton('creator-build')}</div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }} data-testid="creator-queued">
        <header><div><h2>Talks going into the draft</h2><p>Ticked talks, pasted links and uploads. Remove one here and it stays out of the build.</p></div></header>
        <div className="body">
          {ticked.length || links.length || uploads.length ? (
            <ul className="creator-queue">
              {ticked.map((item) => (
                <li key={item.id} data-testid="creator-queue-row">
                  <span>{item.title}</span>
                  <button className="btn ghost" type="button" data-testid="creator-remove" onClick={() => setPicked((value) => ({ ...value, [item.id]: false }))}>Remove</button>
                </li>
              ))}
              {links.map((line) => (
                <li key={line} data-testid="creator-queue-row">
                  <span>{line}</span>
                  <button className="btn ghost" type="button" data-testid="creator-remove" onClick={() => removePaste(line)}>Remove</button>
                </li>
              ))}
              {uploads.map((item) => (
                <li key={item.mediaId} data-testid="creator-queue-row">
                  <span>{item.name}</span>
                  <button className="btn ghost" type="button" data-testid="creator-remove" onClick={() => setUploads((rows) => rows.filter((row) => row.mediaId !== item.mediaId))}>Remove</button>
                </li>
              ))}
            </ul>
          ) : <p className="hint">Tick a candidate, paste a link, or upload a video.</p>}
          {progress.length ? (
            <div data-testid="creator-progress" style={{ marginTop: 14 }}>
              {progress.map((line) => <p key={line.id} className="hint" data-testid="creator-progress-row">{line.title}: {line.state}</p>)}
            </div>
          ) : null}
          {error ? <p className="flash error" data-testid="creator-error" role="alert" style={{ whiteSpace: 'pre-line' }}>{error}</p> : null}
        </div>
      </section>
    </div>
  )
}
