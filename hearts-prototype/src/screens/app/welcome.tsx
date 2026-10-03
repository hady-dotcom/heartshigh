import Link from 'next/link'
import { loadDoors } from '@/server/doors'
import { doorOfClause } from '@/lib/doors'
import { AppFrame, Flash, Hidden } from '@/components/app/shell'
import { Arch } from '@/components/arch'
import { optionLabels } from '@/lib/placing'
import { courseCards, portalName } from '@/server/learner'
import { type Ctx, embedUrl, rows, str } from '../common'

export async function WelcomeScreen({ payload, user, portal, base, query }: Ctx) {
  const staff = user.role !== 'learner'
  const welcome = staff ? portal.teacherWelcomeUrl : portal.learnerWelcomeUrl
  const intro = staff ? portal.teacherIntroUrl : portal.learnerIntroUrl
  const step = query.step || (user.onboarded ? 'done' : 'start')

  if (step === 'start') {
    const next = !user.seenWelcome && (welcome || intro) ? `${base}/welcome?step=films` : `${base}/welcome?step=placing`
    return (
      <AppFrame testId="welcome">
        <div className="splash" data-testid="splash">
          <div>
            <span className="splash-arch" aria-hidden><Arch size={96} /></span>
            <h1>{portal.welcome ? 'Welcome' : 'Someone wanted good for you'}</h1>
            <p>{portal.welcome || `${portalName(portal)} has opened a door for you: short films from real lectures, a few questions to think about, and a circle to sit with.`}</p>
            <Flash error={query.error} notice={query.notice} />
            <Link className="pill gold block" href={next} style={{ marginTop: 18 }} data-testid="welcome-begin">Begin</Link>
            <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>{portalName(portal)}</p>
          </div>
        </div>
      </AppFrame>
    )
  }

  if (step === 'films') {
    return (
      <AppFrame testId="welcome-films">
        <div className="app-scroll">
          <Journey at={0} />
          <div className="app-head"><h1>Before you begin</h1></div>
          <div data-testid="welcome-film">
            {welcome ? <iframe className="film-frame" title="Welcome" src={embedUrl(welcome)} allow="encrypted-media" /> : null}
            {intro ? <iframe className="film-frame" style={{ marginTop: 12 }} title="Introduction" src={embedUrl(intro)} allow="encrypted-media" /> : null}
          </div>
          <form action="/api/hearts" method="post" style={{ marginTop: 18 }}>
            <Hidden fields={{ action: 'seen-welcome', next: staff && user.onboarded ? `${base}/admin` : `${base}/welcome?step=placing` }} />
            <button className="pill gold block" data-testid="welcome-continue" type="submit">Continue</button>
          </form>
        </div>
      </AppFrame>
    )
  }

  if (step === 'placing') {
    const questions = await rows(payload, 'placing-questions', { or: [{ portal: { exists: false } }, { portal: { equals: portal.id } }] }, { sort: 'order', limit: 20 })
    return (
      <AppFrame testId="placing">
        <div className="app-scroll">
          <Journey at={1} />
          <div className="app-head"><h1>Where to begin</h1></div>
          <Flash error={query.error} notice={query.notice} />
          <p className="lead">A few short questions so your first talk is a gentle place to start. There are no wrong answers.</p>
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'placing', next: user.role === 'learner' ? `${base}/start?after=placing` : `${base}/welcome?step=done` }} />
            {questions.map((question, index) => (
              <fieldset className="q-card" key={question.id} data-testid="placing-question" style={{ border: '1px solid #e5dccb' }}>
                <span className="n">{String(index + 1).padStart(2, '0')} of {String(questions.length).padStart(2, '0')}</span>
                <legend className="sr-only">{str(question.prompt)}</legend>
                <h2 aria-hidden>{str(question.prompt)}</h2>
                {question.why ? <p className="why">{str(question.why)}</p> : null}
                {optionLabels(question.options).map((label) => (
                  <label className="choice" key={label}><input type="radio" name={`q-${question.id}`} value={label} required /> {label}</label>
                ))}
              </fieldset>
            ))}
            <button className="pill gold block" data-testid="placing-submit" type="submit">Find my first talk</button>
          </form>
        </div>
      </AppFrame>
    )
  }

  const door = doorOfClause(Number(user.startingClause || 0), await loadDoors(payload))
  const first = (await courseCards(payload, user))[0]
  return (
    <AppFrame testId="placing-result">
      <div className="app-scroll">
        <Journey at={2} />
        <Flash error={query.error} notice={query.notice} />
        <div style={{ textAlign: 'center', margin: '10px 0 6px', color: 'var(--gold)' }}><Arch size={64} /></div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 34, textAlign: 'center', margin: '6px 0 14px', fontWeight: 600 }}>A good place to start</h1>
        {door ? (
          <article className="clause-card" data-testid="starting-door" data-door={door.number}>
            <div className="clause-num">{door.number}</div>
            <p className="lbl" style={{ margin: '0 0 4px' }}>A door of the hadith of Jibril</p>
            <h3>{door.title}</h3>
            {door.teaching ? <p data-testid="starting-door-teaching">{door.teaching}</p> : null}
          </article>
        ) : null}
        {first ? (
          <section className="card" data-testid="first-course">
            <p className="eyebrow" style={{ margin: '0 0 6px' }}>Your first course</p>
            <h3>{first.title}</h3>
            <p>{first.summary || `${first.parts} parts with ${first.speaker}.`}</p>
            <Link className="pill gold block" href={`${base}/course/${first.id}`} style={{ marginTop: 12 }} data-testid="start-first">Start this course</Link>
          </section>
        ) : null}
        <Link className="pill outline block" href={`${base}/feed`} style={{ marginTop: 10 }} data-testid="go-feed">Go to my feed</Link>
      </div>
    </AppFrame>
  )
}

function Journey({ at }: { at: number }) {
  return (
    <>
      <div className="step-bar" aria-hidden>{[0, 1, 2].map((index) => <span key={index} className={index <= at ? 'on' : ''} />)}</div>
      <div className="step-bar-labels"><span>Welcome</span><span>A few questions</span><span>Your first talk</span></div>
    </>
  )
}
