'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import {
  fillCast,
  kindLabel,
  learnerPrompts,
  learnerThread,
  loopCounts,
  stuckRows,
  welcomeLine,
  type DemoPanel,
  type DemoQueueItem,
  type PromptKind,
  type QueueKind,
} from '@/lib/demo-stage'
import { useDemo } from './store'

function Desk({
  who,
  role,
  children,
  nav,
}: {
  who: string
  role: string
  children: ReactNode
  nav: ReactNode
}) {
  const { cast } = useDemo()
  const initial = who.trim().slice(0, 1) || '?'
  return (
    <div className="desk demo-desk">
      <aside className="side">
        <div className="side-brand">
          <span>
            <b>{cast.portalName}</b>
            <small>{role}</small>
          </span>
        </div>
        <div className="side-nav">{nav}</div>
        <div className="side-foot">
          <div className="who">
            <span className="initial">{initial}</span>
            <b>{who}</b>
          </div>
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  )
}

function Jump({ id, children }: { id: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="nav"
      onClick={() => document.querySelector(`[data-anchor="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
    >
      {children}
    </button>
  )
}

function Numbers({ testId }: { testId: string }) {
  const { state } = useDemo()
  const counts = loopCounts(state)
  const tiles = [
    ['courses', 'Courses', counts.courses],
    ['waiting', 'Waiting', counts.waiting],
    ['done', 'Done', counts.done],
    ['stuck', 'Stuck', counts.stuck],
  ] as const
  return (
    <div className="demo-counts" data-testid={testId} data-anchor={testId}>
      {tiles.map(([key, label, value]) => (
        <span key={key}>
          {label} <b data-testid={`demo-num-${key}`}>{value}</b>
        </span>
      ))}
    </div>
  )
}

export function Board({
  only,
  onCourse,
  onNote,
  onPrompt,
  onWrite,
  onReply,
}: {
  only: DemoPanel
  onCourse: (title: string) => void
  onNote: (body: string) => void
  onPrompt: (kind: PromptKind, text: string) => void
  onWrite: (kind: QueueKind, body: string, promptId?: string) => void
  onReply: (id: string, body: string) => void
}) {
  if (only === 'master') return <Master onCourse={onCourse} />
  if (only === 'portal') return <Portal onNote={onNote} />
  if (only === 'teacher') return <Teacher onPrompt={onPrompt} onReply={onReply} />
  return <Learner onWrite={onWrite} />
}

function Fresh({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { state } = useDemo()
  const fresh = state.fresh.includes(id)
  return <div className={`demo-card${className ? ` ${className}` : ''}${fresh ? ' is-fresh' : ''}`} data-fresh={fresh ? '1' : '0'}>{children}</div>
}

function Master({ onCourse }: { onCourse: (title: string) => void }) {
  const { state, cast } = useDemo()
  const [title, setTitle] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = title.trim()
    if (!next) return
    onCourse(next)
    setTitle('')
  }
  return (
    <Desk
      who={cast.master}
      role="Runs the whole system"
      nav={<><Jump id="demo-add-course">Add a course</Jump><Jump id="demo-master-numbers">Numbers</Jump></>}
    >
      <section className="panel" data-anchor="demo-add-course">
        <header><div><h2>Add a course</h2><p>It shows in the library and on the phone straight away.</p></div></header>
        <div className="body">
          <form className="demo-form" onSubmit={submit}>
            <input data-testid="demo-course-title" value={title} placeholder="Name the course" aria-label="Course name" onChange={(event) => setTitle(event.target.value)} />
            <button type="submit" className="btn small" data-testid="demo-add-course" disabled={!title.trim()}>Add course</button>
          </form>
        </div>
      </section>
      <section className="panel">
        <header><div><h2>Courses</h2><p>{cast.portalName} can open these.</p></div></header>
        <div className="body demo-list" data-testid="demo-master-courses">
          {state.courses.map((course) => (
            <Fresh id={course.id} key={course.id}>
              <p><b>{course.title}</b></p>
            </Fresh>
          ))}
        </div>
      </section>
      <section className="panel">
        <header><div><h2>This place</h2><p>The numbers move when people write, and when {cast.teacher} writes back.</p></div></header>
        <div className="body">
          <Numbers testId="demo-master-numbers" />
        </div>
      </section>
    </Desk>
  )
}

function Portal({ onNote }: { onNote: (body: string) => void }) {
  const { state, cast } = useDemo()
  const [body, setBody] = useState('')
  const stuck = stuckRows(state)
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = body.trim()
    if (!next) return
    onNote(next)
    setBody('')
  }
  return (
    <Desk
      who={cast.portalAdmin}
      role="Looks after this place"
      nav={<><Jump id="demo-library">Library</Jump><Jump id="demo-post-note">Announcement</Jump><Jump id="demo-stuck">Who is stuck</Jump></>}
    >
      <section className="panel" data-anchor="demo-library">
        <header><div><h2>Library</h2><p>Courses people can open.</p></div></header>
        <div className="body demo-list" data-testid="demo-library">
          {state.courses.map((course) => (
            <Fresh id={course.id} key={course.id}>
              <p><b>{course.title}</b></p>
            </Fresh>
          ))}
        </div>
      </section>
      <section className="panel" data-anchor="demo-post-note">
        <header><div><h2>Announcement</h2><p>This shows on {cast.learner}’s phone.</p></div></header>
        <div className="body demo-stack">
          <form className="demo-form" onSubmit={submit}>
            <textarea data-testid="demo-note-body" value={body} placeholder="Write an announcement" aria-label="Announcement" rows={2} onChange={(event) => setBody(event.target.value)} />
            <button type="submit" className="btn small" data-testid="demo-post-note" disabled={!body.trim()}>Post announcement</button>
          </form>
          <div data-testid="demo-notes">
            {state.notes.map((note) => (
              <Fresh id={note.id} key={note.id}>
                <p>{note.body}</p>
              </Fresh>
            ))}
          </div>
        </div>
      </section>
      <section className="panel" data-anchor="demo-stuck" data-testid="demo-stuck">
        <header><div><h2>Who is stuck ({stuck.length})</h2><p>Waiting for a reply, or they have not written back yet.</p></div></header>
        <div className="body demo-list">
          {stuck.map((row) => (
            <p key={row.id} data-testid="demo-stuck-row"><b>{fillCast(row.name, cast)}</b> <span className="hint">{row.why}</span></p>
          ))}
        </div>
      </section>
      <section className="panel" data-anchor="demo-activity">
        <header><div><h2>What just happened</h2></div></header>
        <div className="body demo-list" data-testid="demo-activity">
          {state.activity.map((row) => (
            <p key={row.id}>{fillCast(row.text, cast)}</p>
          ))}
        </div>
      </section>
    </Desk>
  )
}

function Teacher({ onPrompt, onReply }: { onPrompt: (kind: PromptKind, text: string) => void; onReply: (id: string, body: string) => void }) {
  const { state, cast } = useDemo()
  const [text, setText] = useState('')
  const waiting = state.queue.filter((row) => !row.done)
  const done = state.queue.filter((row) => row.done)
  function setPrompt(kind: PromptKind) {
    const next = text.trim()
    if (!next) return
    onPrompt(kind, next)
    setText('')
  }
  return (
    <Desk
      who={cast.teacher}
      role="Guides the learners"
      nav={<><Jump id="demo-ask">Ask</Jump><Jump id="demo-queue">Reply queue</Jump></>}
    >
      <section className="panel" data-anchor="demo-ask">
        <header><div><h2>Ask {cast.learner}</h2><p>A question or a workbook prompt shows on the phone.</p></div></header>
        <div className="body demo-stack">
          <textarea data-testid="demo-prompt-text" value={text} placeholder="Write a question or a workbook prompt" aria-label="Question or workbook prompt" rows={2} onChange={(event) => setText(event.target.value)} />
          <div className="demo-row">
            <button type="button" className="btn small" data-testid="demo-set-question" disabled={!text.trim()} onClick={() => setPrompt('question')}>Set a question</button>
            <button type="button" className="btn ghost small" data-testid="demo-set-workbook" disabled={!text.trim()} onClick={() => setPrompt('workbook')}>Set a workbook prompt</button>
          </div>
        </div>
      </section>
      <section className="panel" data-anchor="demo-queue" data-testid="demo-queue">
        <header>
          <div>
            <h2>Reply queue</h2>
            <p data-testid="demo-queue-counts">
              Waiting <b data-testid="demo-waiting-count">{waiting.length}</b>
              {' · '}
              Done <b data-testid="demo-done-count">{done.length}</b>
            </p>
          </div>
        </header>
        <div className="body demo-stack">
          {state.queue.map((row) => (
            <QueueCard key={row.id} row={row} onReply={onReply} />
          ))}
        </div>
      </section>
    </Desk>
  )
}

function QueueCard({ row, onReply }: { row: DemoQueueItem; onReply: (id: string, body: string) => void }) {
  const { state, cast } = useDemo()
  const [body, setBody] = useState('')
  const fresh = state.fresh.includes(row.id)
  const name = fillCast(row.learner, cast)
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = body.trim()
    if (!next) return
    onReply(row.id, next)
    setBody('')
  }
  return (
    <article className={`demo-card demo-queue${fresh ? ' is-fresh' : ''}`} data-testid="demo-queue-item" data-id={row.id} data-done={row.done ? 'true' : 'false'} data-fresh={fresh ? '1' : '0'}>
      <p className="hint">{kindLabel(row.kind)} · {name}</p>
      <p className="hint">{row.prompt}</p>
      <p><b>{name}:</b> {row.body}</p>
      {row.done ? (
        <>
          <p data-testid="demo-queue-reply"><b>{cast.teacher}:</b> {row.reply}</p>
          <p className="demo-done" data-testid="demo-done-mark">Done</p>
        </>
      ) : (
        <form className="demo-form" onSubmit={submit}>
          <textarea data-testid={`demo-reply-${row.id}`} value={body} placeholder={`Write back to ${name}`} aria-label={`Reply to ${name}`} rows={2} onChange={(event) => setBody(event.target.value)} />
          <button type="submit" className="btn small" data-testid={`demo-reply-send-${row.id}`} disabled={!body.trim()}>Send reply</button>
        </form>
      )}
    </article>
  )
}

function Learner({ onWrite }: { onWrite: (kind: QueueKind, body: string, promptId?: string) => void }) {
  const { state, cast } = useDemo()
  const [comment, setComment] = useState('')
  const prompts = learnerPrompts(state)
  const thread = learnerThread(state)
  function sendComment(event: FormEvent) {
    event.preventDefault()
    const next = comment.trim()
    if (!next) return
    onWrite('comment', next)
    setComment('')
  }
  return (
    <div className="app evening demo-app" data-testid="demo-learner-app">
      <header className="app-head">
        <p className="eyebrow">{cast.portalName}</p>
        <h1 data-testid="demo-welcome">{welcomeLine(cast)}</h1>
      </header>
      <div className="app-scroll">
        <div className="demo-stack">
          <section data-anchor="demo-phone-notes" data-testid="demo-phone-notes">
            {state.notes.map((note) => (
              <Fresh id={note.id} key={note.id} className="demo-phone-card">
                <p className="eyebrow">Announcement</p>
                <p>{note.body}</p>
              </Fresh>
            ))}
          </section>
          <section data-anchor="demo-feed" data-testid="demo-feed">
            <p className="eyebrow">Courses</p>
            {state.courses.map((course) => (
              <Fresh id={course.id} key={course.id} className="demo-phone-card">
                <p><b>{course.title}</b></p>
              </Fresh>
            ))}
          </section>
          <section data-anchor="demo-learner-prompts" data-testid="demo-learner-prompts">
            {prompts.map((prompt) => (
              <PromptCard key={prompt.id} id={prompt.id} kind={prompt.kind} text={prompt.text} onWrite={onWrite} />
            ))}
          </section>
          <section className="card" data-anchor="demo-comment">
            <p className="eyebrow">Comment</p>
            <form className="demo-form" onSubmit={sendComment}>
              <textarea data-testid="demo-comment-body" value={comment} placeholder="Write a comment" aria-label="Comment" rows={2} onChange={(event) => setComment(event.target.value)} />
              <button type="submit" className="pill gold small" data-testid="demo-send-comment" disabled={!comment.trim()}>Send comment</button>
            </form>
          </section>
          <section data-anchor="demo-learner-replies" data-testid="demo-learner-replies">
            <p className="eyebrow">From {cast.teacher}</p>
            {thread.map((row) => (
              <article className={`card${state.fresh.includes(row.id) ? ' is-fresh' : ''}`} key={row.id} data-testid="demo-thread-item">
                <p className="hint">{kindLabel(row.kind)} · {row.prompt}</p>
                <p>{row.body}</p>
                {row.reply ? <p data-testid="demo-got-reply"><b>{cast.teacher}:</b> {row.reply}</p> : <p className="hint">Waiting for a reply</p>}
                {row.done ? <p className="demo-done">Done</p> : null}
              </article>
            ))}
          </section>
        </div>
      </div>
      <nav className="tabbar dark demo-tabs">
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-phone-notes"]')?.scrollIntoView({ block: 'start' })}>Home</button>
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-learner-prompts"]')?.scrollIntoView({ block: 'start' })}>Write</button>
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-learner-replies"]')?.scrollIntoView({ block: 'start' })}>Replies</button>
      </nav>
    </div>
  )
}

function PromptCard({
  id,
  kind,
  text,
  onWrite,
}: {
  id: string
  kind: PromptKind
  text: string
  onWrite: (kind: QueueKind, body: string, promptId?: string) => void
}) {
  const { state } = useDemo()
  const [body, setBody] = useState('')
  const sent = state.queue.find((row) => row.promptId === id && row.learner === '{learner}')
  const fresh = state.fresh.includes(id)
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = body.trim()
    if (!next || sent) return
    onWrite(kind === 'workbook' ? 'workbook' : 'answer', next, id)
    setBody('')
  }
  return (
    <article className={`card${fresh ? ' is-fresh' : ''}`} data-testid="demo-prompt-card" data-prompt-id={id} data-fresh={fresh ? '1' : '0'}>
      <p className="eyebrow">{kind === 'workbook' ? 'Workbook prompt' : 'Question'}</p>
      <p>{text}</p>
      {sent ? (
        <>
          <p data-testid={`demo-sent-${id}`}>{sent.body}</p>
          {sent.reply ? <p data-testid="demo-got-reply"><b>Reply:</b> {sent.reply}</p> : <p className="hint">Waiting for a reply</p>}
          {sent.done ? <p className="demo-done">Done</p> : null}
        </>
      ) : (
        <form className="demo-form" onSubmit={submit}>
          <textarea
            data-testid={`demo-write-${id}`}
            value={body}
            placeholder={kind === 'workbook' ? 'Write your workbook line' : 'Write your answer'}
            aria-label={kind === 'workbook' ? 'Workbook line' : 'Answer'}
            rows={2}
            onChange={(event) => setBody(event.target.value)}
          />
          <button type="submit" className="pill gold small" data-testid={`demo-send-${id}`} disabled={!body.trim()}>
            {kind === 'workbook' ? 'Send workbook line' : 'Send answer'}
          </button>
        </form>
      )}
    </article>
  )
}
