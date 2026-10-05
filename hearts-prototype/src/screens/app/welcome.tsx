import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadDoors } from '@/server/doors'
import { capitalAfterColon, doorOfClause } from '@/lib/doors'
import { AppFrame, Flash, Hidden } from '@/components/app/shell'
import { Arch } from '@/components/arch'
import { BrandLockup } from '@/components/brand'
import { WelcomePlayer } from '@/components/app/welcome-player'
import { optionLabels } from '@/lib/placing'
import { PRODUCT } from '@/lib/product'
import { afterWelcomePath, filmsFor, nextWelcomeStep, shouldSeeWelcomeWalk, welcomeStepFromQuery } from '@/lib/welcome-films'
import { courseCards, portalName } from '@/server/learner'
import { type Ctx, embedUrl, rows, str } from '../common'

export async function WelcomeScreen({ payload, user, portal, base, query }: Ctx) {
  const films = filmsFor(portal, user.role)
  const asked = welcomeStepFromQuery(query.step)
  const step = query.step || (shouldSeeWelcomeWalk(user, portal) ? 'welcome' : user.onboarded ? 'done' : 'start')

  if (!query.step && shouldSeeWelcomeWalk(user, portal)) {
    redirect(`${base}/welcome?step=welcome`)
  }
  if (!query.step && user.onboarded && !shouldSeeWelcomeWalk(user, portal)) {
    redirect(afterWelcomePath(base, user))
  }

  if (step === 'start') {
    const next = shouldSeeWelcomeWalk(user, portal) ? `${base}/welcome?step=welcome` : `${base}/start`
    return (
      <AppFrame evening testId="welcome" help="welcome">
        <div className="splash" data-testid="splash">
          <div>
            <BrandLockup size={88} />
            <h1>{portal.welcome ? 'Welcome' : 'Someone wanted good for you'}</h1>
            <p>{portal.welcome || `${portalName(portal)} has opened a door for you: short films from real lectures, a few questions to think about, and a circle to sit with.`}</p>
            <p className="muted" data-testid="powered-by-donations">This has been powered by donations.</p>
            <Flash error={query.error} notice={query.notice} />
            <Link className="pill gold block" href={next} style={{ marginTop: 18 }} data-testid="welcome-begin">Begin</Link>
            <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>{portalName(portal)}</p>
          </div>
        </div>
      </AppFrame>
    )
  }

  if (asked !== 'other') {
    const kind = asked
    const film = films[kind]
    const onward = nextWelcomeStep(kind)
    const next = onward === 'done' ? afterWelcomePath(base, user) : `${base}/welcome?step=${onward}`
    const markDone = onward === 'done'
    return (
      <AppFrame evening testId={kind === 'welcome' ? 'welcome-films' : 'welcome-intro'} help="welcome">
        <div className="welcome-walk app-scroll">
          <Journey at={kind === 'welcome' ? 0 : 1} />
          <div className="app-head">
            <h1>{kind === 'welcome' ? 'A welcome' : 'How to begin'}</h1>
            <p className="lead">{kind === 'welcome' ? `A short film from ${portalName(portal)}.` : `How ${PRODUCT} works here.`}</p>
          </div>
          <div data-testid={kind === 'welcome' ? 'welcome-film' : 'intro-film'}>
            {film.kind === 'media' ? <WelcomePlayer src={film.src} /> : null}
            {film.kind === 'url' ? <WelcomePlayer embed={embedUrl(film.src)} /> : null}
            {film.kind === 'empty' ? (
              <div className="welcome-empty" data-testid="welcome-empty">
                <p>No film in this slot yet. Skip when you are ready.</p>
              </div>
            ) : null}
          </div>
          {markDone ? (
            <>
              <form action="/api/hearts" method="post" style={{ marginTop: 18 }}>
                <Hidden fields={{ action: 'seen-welcome', next }} />
                <button className="pill gold block" data-testid="welcome-continue" type="submit">Continue</button>
              </form>
              <form action="/api/hearts" method="post" style={{ marginTop: 10 }}>
                <Hidden fields={{ action: 'seen-welcome', next }} />
                <button className="pill outline block" data-testid="welcome-skip" type="submit">Skip</button>
              </form>
            </>
          ) : (
            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              <Link className="pill gold block" href={next} data-testid="welcome-continue">Continue</Link>
              <Link className="pill outline block" href={next} data-testid="welcome-skip">Skip</Link>
            </div>
          )}
        </div>
      </AppFrame>
    )
  }

  if (step === 'placing') {
    const questions = await rows(payload, 'placing-questions', { or: [{ portal: { exists: false } }, { portal: { equals: portal.id } }] }, { sort: 'order', limit: 20 })
    return (
      <AppFrame evening testId="placing">
        <div className="app-scroll">
          <Journey at={1} />
          <div className="app-head"><h1>Where to begin</h1></div>
          <Flash error={query.error} notice={query.notice} />
          <p className="lead">A few short questions so your first talk is a gentle place to start. There are no wrong answers. Skip this and play the scenes instead if you would rather.</p>
          <p><Link className="pill outline block" href={`${base}/start`} data-testid="welcome-skip">Skip</Link></p>
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'placing', next: user.role === 'learner' ? `${base}/start?after=placing` : `${base}/welcome?step=done` }} />
            {questions.map((question, index) => (
              <fieldset className="q-card" key={question.id} data-testid="placing-question">
                <span className="n">Question {index + 1} of {questions.length}</span>
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
    <AppFrame evening testId="placing-result">
      <div className="app-scroll">
        <Journey at={2} />
        <Flash error={query.error} notice={query.notice} />
        <div style={{ textAlign: 'center', margin: '10px 0 6px', color: 'var(--gold)' }}><Arch size={64} /></div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 34, textAlign: 'center', margin: '6px 0 14px', fontWeight: 600 }}>A good place to start</h1>
        {door ? (
          <article className="clause-card" data-testid="starting-door" data-door={door.number}>
            <div className="clause-num">{door.number}</div>
            <p className="lbl" style={{ margin: '0 0 4px' }}>A door of the hadith of Jibril</p>
            <h3>{capitalAfterColon(door.title)}</h3>
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
      <div className="step-bar-labels"><span>Welcome</span><span>How to begin</span><span>Your first talk</span></div>
    </>
  )
}
