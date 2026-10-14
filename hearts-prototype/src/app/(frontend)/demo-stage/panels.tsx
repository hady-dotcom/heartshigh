'use client'

import type { ReactNode } from 'react'
import {
  DEMO_ANNOUNCE,
  DEMO_ANSWER,
  DEMO_COURSE,
  DEMO_LATER,
  DEMO_REPLY,
  DEMO_QUESTION,
  DEMO_UNIT,
  DEMO_VIDEO,
  welcomeLine,
  clock,
  learnerSeesCourse,
  ownStats,
  teacherQueue,
  workbookEntries,
  type DemoPanel,
} from '@/lib/demo-stage'
import { useDemo } from './store'

function Go({
  id,
  hot,
  press,
  className,
  children,
  disabled,
}: {
  id: string
  hot: string
  press: (id: string) => void
  className?: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      data-demo={id}
      className={`${className || ''}${hot === id ? ' demo-next' : ''}`}
      disabled={disabled}
      onClick={() => press(id)}
    >
      {children}
    </button>
  )
}

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

function Stats() {
  const { state } = useDemo()
  const stats = ownStats(state)
  const tiles = [
    ['courses', 'Own courses', stats.courses],
    ['videos', 'Videos', stats.videos],
    ['questions', 'Questions', stats.questions],
    ['answers', 'Answers', stats.answers],
  ] as const
  return (
    <div className="stats-strip" data-testid="demo-stats">
      {tiles.map(([key, label, value]) => (
        <div className="stat-chip" key={key}>
          <b data-testid={`demo-stat-${key}`}>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

export function Board({ hot, press, only }: { hot: string; press: (id: string) => void; only: DemoPanel }) {
  if (only === 'master') return <Master hot={hot} press={press} />
  if (only === 'portal') return <Portal hot={hot} press={press} />
  if (only === 'teacher') return <Teacher hot={hot} press={press} />
  return <Learner hot={hot} press={press} />
}

function Master({ hot, press }: { hot: string; press: (id: string) => void }) {
  const { state, cast, views, setViews } = useDemo()
  const stats = ownStats(state)
  const view = views.master
  return (
    <Desk
      who={cast.master}
      role="Runs the whole system"
      nav={
        <>
          <button type="button" className={`nav${view === 'portals' ? ' on' : ''}`} onClick={() => setViews((current) => ({ ...current, master: 'portals' }))}>Portals</button>
          <Go id="show-library" hot={hot} press={press} className={`nav${view === 'library' ? ' on' : ''}`}>Library</Go>
        </>
      }
    >
      {view === 'library' ? (
        <section className="panel">
          <header><h2>Shared library</h2></header>
          <div className="body demo-list">
            {state.library.map((title) => (
              <p key={title}><b>{title}</b> <span className="hint">Imported · read only</span></p>
            ))}
            <p className="hint">These are HEARTS courses. A portal can view them or take them off a code. It cannot edit the original.</p>
          </div>
        </section>
      ) : (
        <section className="panel">
          <header><h2>{cast.portalName}</h2></header>
          <div className="body">
            <p className="hint">Own content is counted here. The library is not.</p>
            <div className="demo-counts">
              <span>Published <b data-testid="demo-stat-published">{stats.published}</b></span>
              <span>Videos <b>{stats.videos}</b></span>
              <span>Questions <b>{stats.questions}</b></span>
              <span>Answers <b>{stats.answers}</b></span>
            </div>
          </div>
        </section>
      )}
    </Desk>
  )
}

function Portal({ hot, press }: { hot: string; press: (id: string) => void }) {
  const { state, cast, views, setViews } = useDemo()
  const view = views.portal
  const video = state.videos[0]
  const now = state.questions.find((question) => question.when === 'now')
  const later = state.questions.find((question) => question.when === 'later')
  const nav = (id: string, label: string, viewName: string) =>
    id ? (
      <Go id={id} hot={hot} press={press} className={`nav${view === viewName ? ' on' : ''}`}>{label}</Go>
    ) : (
      <button type="button" className={`nav${view === viewName ? ' on' : ''}`} onClick={() => setViews((current) => ({ ...current, portal: viewName }))}>{label}</button>
    )
  return (
    <Desk
      who={cast.portalAdmin}
      role="Looks after the portal"
      nav={
        <>
          <button type="button" className={`nav${view === 'overview' ? ' on' : ''}`} onClick={() => setViews((current) => ({ ...current, portal: 'overview' }))}>Overview</button>
          {nav('show-imported', 'Library', 'imported')}
          {nav('open-content', 'Content', 'content')}
          {nav('open-question', 'Questions', 'question')}
          {nav('open-announce', 'Announcements', 'announce')}
          {nav('open-features', 'Features', 'features')}
        </>
      }
    >
      <Stats />
      {view === 'overview' ? (
        <section className="panel">
          <header><div><h2>{cast.portalName}</h2><p>Your own courses, kept apart from the library.</p></div></header>
          <div className="body">
            <p>{DEMO_COURSE} is {state.visibility === 'published' ? 'published' : 'still a draft'}.</p>
            <p className="hint">People only see a course after you publish it and their code includes it.</p>
          </div>
        </section>
      ) : null}
      {view === 'imported' ? (
        <section className="panel">
          <header><h2>Imported from HEARTS</h2></header>
          <div className="body demo-list">
            {state.library.map((title) => (
              <p key={title}><b>{title}</b> <span className="hint">View only</span></p>
            ))}
            <p><b>{DEMO_COURSE}</b> <span className="hint">Your course · {state.visibility}</span></p>
          </div>
        </section>
      ) : null}
      {view === 'content' ? (
        <section className="panel" data-testid="demo-content">
          <header>
            <div><h2>{DEMO_COURSE}</h2><p>{DEMO_UNIT} · {state.visibility === 'published' ? 'Published' : 'Draft, held back'}</p></div>
            <Go id="publish" hot={hot} press={press} className="btn small" disabled={state.visibility === 'published'}>
              {state.visibility === 'published' ? 'Published' : 'Publish'}
            </Go>
          </header>
          <div className="body">
            {video ? (
              <figure className="demo-thumb" data-testid="demo-thumb">
                <img src={video.thumb} alt="" />
                <figcaption>{video.title}</figcaption>
              </figure>
            ) : (
              <p className="hint">No media in {DEMO_UNIT} yet.</p>
            )}
            <Go id="add-video" hot={hot} press={press} className="btn small" disabled={Boolean(video)}>
              {video ? 'Video added' : 'Add a video'}
            </Go>
          </div>
        </section>
      ) : null}
      {view === 'question' ? (
        <section className="panel" data-testid="demo-question">
          <header><div><h2>Add a question</h2><p>{video ? video.title : 'Add a video first'}</p></div></header>
          <div className="body demo-stack">
            {video ? <img className="demo-poster" src={video.thumb} alt="" /> : <p className="hint">The sitting has no film yet.</p>}
            <div className="demo-timeline" aria-hidden="true"><i style={{ width: `${((state.pausedAt ?? 0) / (video?.seconds || 1)) * 100}%` }} /></div>
            <p>Paused at <b data-testid="demo-paused">{state.pausedAt == null ? '—' : clock(state.pausedAt)}</b></p>
            <Go id="pause-moment" hot={hot} press={press} className="btn ghost small" disabled={!video}>Pause at 1:04</Go>
            <p className="demo-prompt">{DEMO_QUESTION}</p>
            <Go id="save-question" hot={hot} press={press} className="btn small" disabled={!video || Boolean(now)}>
              {now ? `Saved at ${clock(now.at)}` : 'Save question'}
            </Go>
            <p className="demo-prompt">{DEMO_LATER}</p>
            <p className="hint">Future. The two weeks start once the first question is answered.</p>
            <Go id="save-later" hot={hot} press={press} className="btn ghost small" disabled={!now || Boolean(later)}>
              {later ? 'Saved for later' : 'Save the later question'}
            </Go>
          </div>
        </section>
      ) : null}
      {view === 'announce' ? (
        <section className="panel">
          <header><h2>Announcement</h2></header>
          <div className="body demo-stack">
            <p className="demo-prompt">{DEMO_ANNOUNCE}</p>
            <Go id="post-announce" hot={hot} press={press} className="btn small" disabled={state.announcements.length > 0}>
              {state.announcements.length ? 'Posted' : 'Post announcement'}
            </Go>
          </div>
        </section>
      ) : null}
      {view === 'features' ? (
        <section className="panel">
          <header><h2>Features</h2></header>
          <div className="body demo-stack">
            <p className="hint">Switches for this portal only. The phone follows them.</p>
            <Go id="toggle-workbook" hot={hot} press={press} className="btn ghost small">
              Workbook {state.features.workbook ? 'on' : 'off'}
            </Go>
            <Go id="toggle-live" hot={hot} press={press} className="btn small">
              Go live {state.features.live ? 'on' : 'off'}
            </Go>
          </div>
        </section>
      ) : null}
    </Desk>
  )
}

function Teacher({ hot, press }: { hot: string; press: (id: string) => void }) {
  const { state, cast } = useDemo()
  const waiting = teacherQueue(state)
  const answered = state.answers
  return (
    <Desk
      who={cast.teacher}
      role="Guides the learners"
      nav={<Go id="open-queue" hot={hot} press={press} className="nav on">Reply queue</Go>}
    >
      <section className="panel" data-testid="demo-teacher-queue">
        <header>
          <div>
            <h2>Waiting ({waiting.length})</h2>
            <p data-testid="demo-queue-line">{answered.length ? `${cast.learner} answered` : cast.learner}</p>
          </div>
        </header>
        <div className="body demo-stack">
          {!answered.length ? <p className="hint">Nothing is waiting. When {cast.learner} answers, it lands here.</p> : null}
          {answered.map((row) => {
            const prompt = state.questions.find((question) => question.id === row.questionId)?.prompt
            return (
              <article key={row.id} className="demo-queue">
                <p className="hint">{prompt}</p>
                <p><b>{cast.learner}:</b> {row.body}</p>
                {row.reply ? <p data-testid="demo-teacher-reply"><b>You:</b> {row.reply}</p> : (
                  <>
                    <p className="demo-prompt">{DEMO_REPLY}</p>
                    <Go id="send-reply" hot={hot} press={press} className="btn small">Reply</Go>
                  </>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </Desk>
  )
}

function Learner({ hot, press }: { hot: string; press: (id: string) => void }) {
  const { state, cast, views } = useDemo()
  const view = views.learner
  const course = learnerSeesCourse(state)
  const now = state.questions.find((question) => question.when === 'now')
  const later = state.questions.find((question) => question.when === 'later')
  const answer = state.answers.find((row) => row.questionId === now?.id)
  const book = workbookEntries(state)
  const video = state.videos[0]
  return (
    <div className={`app evening demo-app${state.features.live ? ' is-live' : ''}`} data-testid="demo-learner-app">
      <header className="app-head">
        <p className="eyebrow">{cast.portalName}</p>
        <h1 data-testid={view === 'home' ? 'demo-welcome' : undefined}>{view === 'workbook' ? 'Workbook' : view === 'player' || view === 'course' ? DEMO_COURSE : welcomeLine(cast)}</h1>
      </header>
      <div className="app-scroll">
        {view === 'home' ? (
          <div className="demo-stack">
            {state.announcements.map((row) => (
              <section className="card" data-testid="demo-announce" key={row.id}>
                <p className="eyebrow">From your portal</p>
                <p>{row.body}</p>
              </section>
            ))}
            {state.features.live ? <p className="demo-live" data-testid="demo-live">Circle is live</p> : null}
            {course ? (
              <Go id="open-course" hot={hot} press={press} className="demo-course">
                <img src={video?.thumb || '/theme/evening-courtyard.jpg'} alt="" />
                <span>
                  <b data-testid="demo-learner-course">{DEMO_COURSE}</b>
                  <small>{DEMO_UNIT}</small>
                </span>
              </Go>
            ) : (
              <p className="hint" data-testid="demo-learner-empty">Nothing new until your portal publishes a course.</p>
            )}
          </div>
        ) : null}
        {view === 'course' && course ? (
          <div className="demo-stack">
            <h2>{DEMO_UNIT}</h2>
            {video ? (
              <Go id="open-player" hot={hot} press={press} className="demo-course">
                <img src={video.thumb} alt="" />
                <span><b>{DEMO_VIDEO}</b><small>{now ? '1 question' : 'No questions yet'}{later ? ' · 1 later' : ''}</small></span>
              </Go>
            ) : <p className="hint">This course has no film yet.</p>}
          </div>
        ) : null}
        {view === 'course' && !course ? <p className="hint">This course is not published yet.</p> : null}
        {view === 'player' ? (
          <div className="demo-stack">
            {video ? <img className="demo-poster" src={video.thumb} alt="" /> : null}
            <div className="demo-timeline" aria-hidden="true"><i style={{ width: now ? `${(now.at / (video?.seconds || 1)) * 100}%` : '0%' }} /></div>
            {now ? (
              <section className="card" data-testid="demo-popup">
                <p className="eyebrow">At {clock(now.at)}</p>
                <p>{now.prompt}</p>
                {answer ? <p data-testid="demo-sent-answer">{answer.body}</p> : (
                  <>
                    <p className="demo-prompt">{DEMO_ANSWER}</p>
                    <Go id="send-answer" hot={hot} press={press} className="pill gold small">Send answer</Go>
                  </>
                )}
              </section>
            ) : <p className="hint">No question on this film yet.</p>}
            {later ? <p className="hint" data-testid="demo-locked">Unlocks in 14 days. {later.prompt}</p> : null}
          </div>
        ) : null}
        {view === 'workbook' ? (
          <div className="demo-stack" data-testid="demo-workbook">
            {!state.features.workbook ? <p className="hint">The workbook is switched off for this portal.</p> : null}
            {state.features.workbook && !book.length ? <p className="hint">Your answers will gather here.</p> : null}
            {book.map((row) => (
              <article className="card" key={row.prompt}>
                <p className="hint">{row.prompt}</p>
                <p>{row.body}</p>
                {row.reply ? <p data-testid="demo-workbook-reply"><b>{cast.teacher}:</b> {row.reply}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <nav className="tabbar dark demo-tabs">
        <Go id="open-home" hot={hot} press={press} className={`tab${view === 'home' ? ' on' : ''}`}>Home</Go>
        <Go id="open-course" hot={hot} press={press} className={`tab${view === 'course' || view === 'player' ? ' on' : ''}`}>Course</Go>
        {state.features.workbook ? <Go id="open-workbook" hot={hot} press={press} className={`tab${view === 'workbook' ? ' on' : ''}`}>Workbook</Go> : null}
      </nav>
    </div>
  )
}

export type { DemoPanel }
