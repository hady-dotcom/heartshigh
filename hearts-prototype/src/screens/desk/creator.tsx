'use client'

import { useState } from 'react'
import type { TalkCandidate } from '@/lib/sheet-search'

type Course = { id: number; title: string }

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function CreatorForm({ courses, endpoint, next }: { courses: Course[]; endpoint: string; next: string }) {
  const [topic, setTopic] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [courseId, setCourseId] = useState(courses[0] ? String(courses[0].id) : '')
  const [part, setPart] = useState('Talks')
  const [count, setCount] = useState('8')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [pasted, setPasted] = useState('')
  const [candidates, setCandidates] = useState<TalkCandidate[]>([])
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [uploads, setUploads] = useState<{ mediaId: number; name: string }[]>([])
  const [via, setVia] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const search = async () => {
    setBusy('search')
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ intent: 'search', topic, speaker, count: Number(count) || 8, minSeconds: min ? Number(min) : null, maxSeconds: max ? Number(max) : null }),
      })
      const body = (await response.json()) as { error?: string; via?: string; candidates?: TalkCandidate[] }
      if (!response.ok) {
        setError(body.error || 'Search did not run.')
        setBusy('')
        return
      }
      setCandidates(body.candidates || [])
      setVia(body.via || '')
      setPicked({})
    } catch {
      setError('Search did not run.')
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
      const body = (await response.json()) as { error?: string; mediaId?: number; name?: string }
      if (!response.ok || !body.mediaId) setError(body.error || 'That video did not upload.')
      else setUploads((rows) => [...rows, { mediaId: body.mediaId!, name: body.name || file.name }])
    } catch {
      setError('That video did not upload.')
    }
    setBusy('')
  }

  const build = async () => {
    setBusy('build')
    setError('')
    const sources = [
      ...candidates.filter((item) => picked[item.id]).map((item) => ({
        provider: 'youtube' as const, id: item.id, title: item.title, channel: item.channel, speaker, durationSeconds: item.durationSeconds,
      })),
      ...uploads.map((item) => ({ provider: 'file' as const, mediaId: item.mediaId, title: item.name.replace(/\.[a-z0-9]+$/i, ''), durationSeconds: null })),
    ]
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ intent: 'draft', topic, speaker, course: courseId, part, pasted, sources }),
      })
      const body = (await response.json()) as { error?: string; importId?: number }
      if (!response.ok || !body.importId) {
        setError(body.error || 'The draft could not be built.')
        setBusy('')
        return
      }
      window.location.assign(`${next}?preview=${body.importId}`)
    } catch {
      setError('The draft could not be built.')
      setBusy('')
    }
  }

  return (
    <div data-testid="sheet-creator">
      <section className="panel">
        <header><div><h2>What should the sheet be about?</h2><p>Search, tick the talks you want, and the desk builds a draft. Nothing goes live until you apply the preview.</p></div></header>
        <div className="body form">
          <label className="stack">Topic
            <input data-testid="creator-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Light, patience, the names" />
          </label>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="stack">Speaker or channel, if you have one
              <input data-testid="creator-speaker" value={speaker} onChange={(event) => setSpeaker(event.target.value)} placeholder="Optional" />
            </label>
            <label className="stack">How many talks
              <input data-testid="creator-count" value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
            </label>
            <label className="stack">Shortest, in seconds
              <input data-testid="creator-min" value={min} onChange={(event) => setMin(event.target.value)} inputMode="numeric" placeholder="Optional" />
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
            {candidates.map((item) => (
              <label key={item.id} className="lib-card" data-testid="creator-candidate" data-id={item.id} style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 12, alignItems: 'center' }}>
                {item.thumbnail ? <img src={item.thumbnail} alt="" width={88} height={50} style={{ objectFit: 'cover', borderRadius: 8 }} /> : <span className="hint" style={{ width: 88 }}>No picture</span>}
                <span><b>{item.title}</b><small style={{ display: 'block' }}>{item.channel || 'Channel unknown'} · {item.durationSeconds ? clock(item.durationSeconds) : 'Length unknown'} · captions {item.captions}</small></span>
                <input type="checkbox" data-testid="creator-include" checked={Boolean(picked[item.id])} onChange={(event) => setPicked((value) => ({ ...value, [item.id]: event.target.checked }))} aria-label={`Include ${item.title}`} />
              </label>
            ))}
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
          {error ? <p className="flash error" data-testid="creator-error" role="alert">{error}</p> : null}
          <div className="actions">
            <button className="btn teal" type="button" data-testid="creator-build" disabled={Boolean(busy)} onClick={build}>{busy === 'build' ? 'Building the draft…' : 'Build draft sheet'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
