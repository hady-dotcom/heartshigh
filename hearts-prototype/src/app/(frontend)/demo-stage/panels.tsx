'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  COVERAGE,
  alertsFor,
  fillCast,
  kindLabel,
  learnerPrompts,
  learnerThread,
  loopCounts,
  stuckRows,
  welcomeLine,
  type CoverageRole,
  type CoverageRow,
  type DemoAction,
  type DemoPanel,
  type DemoQueueItem,
  type DemoState,
  type PromptKind,
  type QueueKind,
} from '@/lib/demo-stage'
import { JournalList } from '@/components/desk/journal-list'
import { JOURNAL_LABEL } from '@/lib/journal-copy'
import { journalWhen } from '@/lib/journal-list'
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

const HOME: Record<CoverageRole, string> = {
  master: 'library',
  portal: 'overview',
  teacher: 'feedback',
}

export function Board({
  only,
  homeTick,
  onRun,
  onCourse,
  onNote,
  onPrompt,
  onWrite,
  onReply,
}: {
  only: DemoPanel
  homeTick: number
  onRun: (action: DemoAction) => void
  onCourse: (title: string) => void
  onNote: (body: string) => void
  onPrompt: (kind: PromptKind, text: string) => void
  onWrite: (kind: QueueKind, body: string, promptId?: string) => void
  onReply: (id: string, body: string) => void
}) {
  if (only === 'master') return <Master homeTick={homeTick} onRun={onRun} onCourse={onCourse} />
  if (only === 'portal') return <Portal homeTick={homeTick} onRun={onRun} onNote={onNote} />
  if (only === 'teacher') return <Teacher homeTick={homeTick} onRun={onRun} onPrompt={onPrompt} onReply={onReply} />
  return <Learner onRun={onRun} onWrite={onWrite} />
}

function rowsFor(role: CoverageRole) {
  return COVERAGE.filter((row) => row.role === role)
}

function SideNav({ role, page, onPick }: { role: CoverageRole; page: string; onPick: (key: string) => void }) {
  let group = ''
  return (
    <>
      {rowsFor(role).map((row) => {
        const head = row.group !== group
        group = row.group
        return (
          <span key={row.key}>
            {head ? <p className="demo-nav-group">{row.group}</p> : null}
            <button type="button" className={`nav${page === row.key ? ' on' : ''}`} data-testid={`demo-nav-${role}-${row.key}`} aria-current={page === row.key ? 'page' : undefined} onClick={() => onPick(row.key)}>
              {row.nav}
            </button>
          </span>
        )
      })}
    </>
  )
}

function Alerts({ panel }: { panel: DemoPanel }) {
  const { state, cast } = useDemo()
  const rows = alertsFor(state, panel).slice(0, 3)
  if (!rows.length) return null
  return (
    <div className="demo-alerts" data-testid={`demo-alerts-${panel}`}>
      {rows.map((row) => (
        <p key={row.id}>{fillCast(row.text, cast)}</p>
      ))}
    </div>
  )
}

function usePage(role: CoverageRole, homeTick: number) {
  const [page, setPage] = useState(HOME[role])
  useEffect(() => {
    setPage(HOME[role])
  }, [homeTick, role])
  return [page, setPage] as const
}

function needsText(row: CoverageRow) {
  if (!row.make) return false
  const action = row.make('x')
  return action.type !== 'pause-learner' && action.type !== 'toggle-garden' && action.type !== 'approve-review' && action.type !== 'reply'
}

function goLabel(row: CoverageRow, state: DemoState) {
  if (!row.make) return 'Add it'
  const action = row.make('x')
  if (action.type === 'pause-learner') return state.paused ? 'Let this learner back in' : 'Pause this learner'
  if (action.type === 'toggle-garden') return state.garden ? 'Turn the garden path off' : 'Turn the garden path on'
  if (action.type === 'approve-review') return 'Let this question through'
  if (action.type === 'reply') return 'Send the waiting reply'
  if (action.type === 'post-note') return 'Post announcement'
  if (action.type === 'add-course') return 'Add course'
  if (action.type === 'set-prompt') return 'Set question'
  if (action.type === 'start-live') return 'Go live'
  if (action.type === 'answer-safety') return 'Send the reply'
  return 'Add it'
}

function liveLines(row: CoverageRow, state: DemoState, castName: (text: string) => string): string[] {
  const key = row.key
  if (key === 'codes' || key === 'access') return state.codes.map((item) => item.text)
  if (key === 'diaries') return state.diary.map((item) => item.text)
  if (key === 'safety') return state.safety.map((item) => (item.reply ? `${item.body} — ${item.reply}` : item.body))
  if (key === 'announcements') return state.notes.map((item) => item.body)
  if (key === 'library' || key === 'content' || key === 'sheet' || key === 'bring-in' || key === 'tiers') return state.courses.map((item) => item.title)
  if (key === 'packs') return state.packs.map((item) => item.text)
  if (key === 'plans') return state.plans.map((item) => item.text)
  if (key === 'live') return state.liveTitle ? [`Live now: ${state.liveTitle}`] : ['Nothing is live yet.']
  if (key === 'nights') return state.events.filter((item) => item.kind === 'night').map((item) => item.title)
  if (key === 'gather') return state.events.filter((item) => item.kind === 'gathering').map((item) => item.title)
  if (key === 'calendar') return state.events.filter((item) => item.kind === 'calendar').map((item) => item.title)
  if (key === 'circle') return state.queue.filter((item) => item.kind === 'answer').map((item) => `${castName(item.learner)}: ${item.body}`)
  if (key === 'missions') return state.missions.map((item) => item.text)
  if (key === 'opening' && row.role === 'master') return state.scenes.map((item) => item.text)
  if (key === 'opening') return state.prompts.filter((item) => item.kind === 'question').map((item) => item.text)
  if (key === 'lanes') return state.lanes.map((item) => item.text)
  if (key === 'experiments' || key === 'settings') return [state.garden ? 'Garden path is on' : 'Garden path is off']
  if (key === 'review') return state.review.map((item) => `${item.text}${item.approved ? ' — let through' : ' — held'}`)
  if (key === 'questions' && row.role === 'portal') return state.joining.map((item) => item.text)
  if (key === 'questions') return state.prompts.map((item) => item.text)
  if (key === 'compass' || key === 'personas') return state.compass.map((item) => item.text)
  if (key === 'learners' || key === 'teach') {
    const people = stuckRows(state).map((item) => `${castName(item.name)} — ${item.why}`)
    return [state.paused ? 'This learner is paused' : 'This learner can come in', ...people]
  }
  if (key === 'feedback') return state.queue.filter((item) => !item.done).map((item) => `${castName(item.learner)}: ${item.body}`)
  if (key === 'overview' && row.role === 'teacher') {
    const counts = loopCounts(state)
    return [`Waiting ${counts.waiting}`, `Done ${counts.done}`, ...state.activity.map((item) => castName(item.text))]
  }
  if (key === 'overview' || key === 'portals' || key === 'insights' || key === 'trends' || key === 'simulator') {
    const counts = loopCounts(state)
    return [`Courses ${counts.courses}`, `Waiting ${counts.waiting}`, `Done ${counts.done}`, `Stuck ${counts.stuck}`, ...state.activity.map((item) => castName(item.text))]
  }
  if (key === 'framing' || key === 'transcripts') return ['A quiet hour — words would show here once a film is playing.']
  return []
}

function CoveragePage({ row, onRun }: { row: CoverageRow; onRun: (action: DemoAction) => void }) {
  const { state, cast } = useDemo()
  const typed = needsText(row)
  const [text, setText] = useState(typed ? row.sample || '' : '')
  const lines = liveLines(row, state, (value) => fillCast(value, cast))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!row.make) return
    if (typed && !text.trim()) return
    onRun(row.make(text))
  }
  return (
    <section className="panel" data-testid={`demo-page-${row.role}-${row.key}`}>
      <header>
        <div>
          <h2>{row.nav}</h2>
          <p>{row.creates}</p>
        </div>
      </header>
      <div className="body demo-stack">
        {row.status !== 'works' ? <p className="hint" data-testid={`demo-reason-${row.role}-${row.key}`}>{row.reason}</p> : null}
        <p><b>Goes down.</b> {row.down}</p>
        <p><b>Comes back.</b> {row.back}</p>
        {row.status === 'works' && row.make ? (
          <form className="demo-form" onSubmit={submit}>
            {typed ? (
              <input data-testid={`demo-cover-input-${row.role}-${row.key}`} value={text} aria-label={row.nav} onChange={(event) => setText(event.target.value)} />
            ) : null}
            <button type="submit" className="btn small" data-testid={`demo-cover-go-${row.role}-${row.key}`} disabled={typed && !text.trim()}>{goLabel(row, state)}</button>
          </form>
        ) : null}
        {row.key === 'diaries' ? (
          <div data-testid={`demo-live-${row.role}-${row.key}`}>
            <JournalList
              mode="lines"
              rows={state.diary.map((item) => ({ id: item.id, at: item.at || '', text: item.text }))}
            />
          </div>
        ) : lines.length ? (
          <div className="demo-list" data-testid={`demo-live-${row.role}-${row.key}`}>
            {lines.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Fresh({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { state } = useDemo()
  const fresh = state.fresh.includes(id)
  return <div className={`demo-card${className ? ` ${className}` : ''}${fresh ? ' is-fresh' : ''}`} data-fresh={fresh ? '1' : '0'}>{children}</div>
}

function Master({ homeTick, onRun, onCourse }: { homeTick: number; onRun: (action: DemoAction) => void; onCourse: (title: string) => void }) {
  const { state, cast } = useDemo()
  const [page, setPage] = usePage('master', homeTick)
  const [title, setTitle] = useState('')
  const row = rowsFor('master').find((item) => item.key === page)
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
      nav={<SideNav role="master" page={page} onPick={setPage} />}
    >
      <Alerts panel="master" />
      {page !== 'library' && row ? <CoveragePage row={row} onRun={onRun} /> : null}
      {page === 'library' ? <>
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
      </> : null}
    </Desk>
  )
}

function Portal({ homeTick, onRun, onNote }: { homeTick: number; onRun: (action: DemoAction) => void; onNote: (body: string) => void }) {
  const { state, cast } = useDemo()
  const [page, setPage] = usePage('portal', homeTick)
  const [body, setBody] = useState('')
  const stuck = stuckRows(state)
  const row = rowsFor('portal').find((item) => item.key === page)
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
      nav={<SideNav role="portal" page={page} onPick={setPage} />}
    >
      <Alerts panel="portal" />
      {page !== 'overview' && row ? <CoveragePage row={row} onRun={onRun} /> : null}
      {page === 'overview' ? <>
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
      </> : null}
    </Desk>
  )
}

function Teacher({ homeTick, onRun, onPrompt, onReply }: { homeTick: number; onRun: (action: DemoAction) => void; onPrompt: (kind: PromptKind, text: string) => void; onReply: (id: string, body: string) => void }) {
  const { state, cast } = useDemo()
  const [page, setPage] = usePage('teacher', homeTick)
  const [text, setText] = useState('')
  const waiting = state.queue.filter((row) => !row.done)
  const done = state.queue.filter((row) => row.done)
  const row = rowsFor('teacher').find((item) => item.key === page)
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
      nav={<SideNav role="teacher" page={page} onPick={setPage} />}
    >
      <Alerts panel="teacher" />
      {page !== 'feedback' && row ? <CoveragePage row={row} onRun={onRun} /> : null}
      {page === 'feedback' ? <>
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
      </> : null}
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

function Learner({ onRun, onWrite }: { onRun: (action: DemoAction) => void; onWrite: (kind: QueueKind, body: string, promptId?: string) => void }) {
  const { state, cast } = useDemo()
  const [comment, setComment] = useState('')
  const [diary, setDiary] = useState('')
  const [feeling, setFeeling] = useState('')
  const [help, setHelp] = useState('')
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
          <Alerts panel="learner" />
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
          <PhonePlace />
          <PhoneWrite
            label={JOURNAL_LABEL.one}
            placeholder={`Write a ${JOURNAL_LABEL.one.toLowerCase()} line`}
            testId="demo-diary-body"
            buttonId="demo-add-diary"
            button={`Save ${JOURNAL_LABEL.one.toLowerCase()} line`}
            value={diary}
            setValue={setDiary}
            onSend={(text) => onRun({ type: 'add-diary', text })}
          />
          <PhoneWrite
            label="How you feel"
            placeholder="Name the feeling"
            testId="demo-compass-body"
            buttonId="demo-add-compass"
            button="Log feeling"
            value={feeling}
            setValue={setFeeling}
            onSend={(text) => onRun({ type: 'add-compass', text })}
          />
          <PhoneWrite
            label="Ask for help"
            placeholder="Tell someone you need a look today"
            testId="demo-safety-body"
            buttonId="demo-add-safety"
            button="Ask for help"
            value={help}
            setValue={setHelp}
            onSend={(text) => onRun({ type: 'add-safety', text })}
          />
          <section data-testid="demo-phone-safety">
            {state.safety.map((row) => (
              <Fresh id={row.id} key={row.id} className="demo-phone-card">
                <p className="eyebrow">Care</p>
                <p>{row.body}</p>
                {row.reply ? <p data-testid="demo-safety-reply"><b>Reply:</b> {row.reply}</p> : <p className="hint">Waiting for someone to look</p>}
              </Fresh>
            ))}
          </section>
        </div>
      </div>
      <nav className="tabbar dark demo-tabs">
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-phone-notes"]')?.scrollIntoView({ block: 'start' })}>Home</button>
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-learner-prompts"]')?.scrollIntoView({ block: 'start' })}>Write</button>
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-learner-replies"]')?.scrollIntoView({ block: 'start' })}>Replies</button>
        <button type="button" className="tab" onClick={() => document.querySelector('[data-anchor="demo-phone-place"]')?.scrollIntoView({ block: 'start' })}>Place</button>
      </nav>
    </div>
  )
}

function PhonePlace() {
  const { state } = useDemo()
  const bits: { id: string; eyebrow: string; text: string; when?: string }[] = [
    ...state.packs.map((item) => ({ id: item.id, eyebrow: 'Pack', text: item.text })),
    ...state.events.map((item) => ({ id: item.id, eyebrow: item.kind === 'night' ? 'Night' : item.kind === 'gathering' ? 'Gathering' : 'Event', text: item.title })),
    ...state.plans.map((item) => ({ id: item.id, eyebrow: 'Study plan', text: item.text })),
    ...state.codes.map((item) => ({ id: item.id, eyebrow: 'Join code', text: item.text })),
    ...state.joining.map((item) => ({ id: item.id, eyebrow: 'At the door', text: item.text })),
    ...state.missions.map((item) => ({ id: item.id, eyebrow: 'Mission', text: item.text })),
    ...state.lanes.map((item) => ({ id: item.id, eyebrow: 'Lane', text: item.text })),
    ...state.scenes.map((item) => ({ id: item.id, eyebrow: 'Opening', text: item.text })),
    ...state.diary.map((item) => ({ id: item.id, eyebrow: JOURNAL_LABEL.one, text: item.text, when: item.at ? journalWhen(item.at) : '' })),
    ...state.compass.map((item) => ({ id: item.id, eyebrow: 'Feeling', text: item.text })),
  ]
  return (
    <section data-anchor="demo-phone-place" data-testid="demo-phone-place">
      {state.liveTitle ? (
        <Fresh id="live" className="demo-phone-card">
          <p className="eyebrow">Live now</p>
          <p>{state.liveTitle}</p>
        </Fresh>
      ) : null}
      <p className="hint">{state.garden ? 'Garden path is on' : 'Garden path is off'}</p>
      {state.paused ? <p className="demo-paused">Your place is paused</p> : null}
      {bits.map((bit) => (
        <Fresh id={bit.id} key={bit.id} className="demo-phone-card">
          <p className="eyebrow">{bit.eyebrow}</p>
          {'when' in bit && bit.when ? <p className="hint" data-testid="demo-journal-when">{bit.when}</p> : null}
          <p>{bit.text}</p>
        </Fresh>
      ))}
    </section>
  )
}

function PhoneWrite({
  label,
  placeholder,
  testId,
  buttonId,
  button,
  value,
  setValue,
  onSend,
}: {
  label: string
  placeholder: string
  testId: string
  buttonId: string
  button: string
  value: string
  setValue: (next: string) => void
  onSend: (text: string) => void
}) {
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = value.trim()
    if (!next) return
    onSend(next)
    setValue('')
  }
  return (
    <section className="card">
      <p className="eyebrow">{label}</p>
      <form className="demo-form" onSubmit={submit}>
        <textarea data-testid={testId} value={value} placeholder={placeholder} aria-label={label} rows={2} onChange={(event) => setValue(event.target.value)} />
        <button type="submit" className="pill gold small" data-testid={buttonId} disabled={!value.trim()}>{button}</button>
      </form>
    </section>
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
