import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { LIFE_EVENTS } from '@/lib/compass-bank'
import { learnerPath, monthMoments, recalibrationDueFor } from '@/server/compass'
import { type Ctx } from '../common'

/** The learner's path: warm words and next steps. No numbers, no persona, no score. */
export async function LearnerPathScreen({ payload, user, portal, base, query }: Ctx) {
  const summary = await learnerPath(payload, user.id, String(portal.slug || ''))
  return (
    <AppFrame testId="learner-path">
      <div className="app-scroll compass-learner">
        <div className="ivy" aria-hidden="true" />
        <div className="app-head"><Back href={`${base}/me`} label="Me" /><h1>Focusing on</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">A little time, pointed at what would help this month.</p>
        {summary.focusLine ? <p className="card focus-card" data-testid="focus-line">{summary.focusLine}</p> : null}
        {summary.areas.map((area) => (
          <article key={area.area} className="card" data-testid="soft-area">
            <div className="area-row">
              <b>{area.area.charAt(0).toUpperCase() + area.area.slice(1)}</b>
              {area.place ? <span className="chip" data-testid="soft-place">{area.place}</span> : null}
            </div>
            <p>{area.forward}</p>
          </article>
        ))}
        <p className="eyebrow">Next steps</p>
        {summary.steps.map((step) => (
          <p key={step.title} className="card" data-testid="next-step"><b>{step.title}.</b> {step.detail}</p>
        ))}
        {summary.talks.length ? <p className="eyebrow">A few talks</p> : null}
        {summary.talks.map((talk) => (
          <Link key={talk.href + talk.title} className="list-link" href={talk.href} data-testid="suggested-talk">
            <span className="grow">{talk.title}</span>›
          </Link>
        ))}
        {summary.movement.length ? <p className="eyebrow">Since last month</p> : null}
        {summary.movement.map((line) => <p key={line} data-testid="movement">{line}</p>)}
        {!summary.areas.length ? <p className="card" data-testid="path-empty">When you have sat with the opening, a few next steps will be here.</p> : null}
      </div>
      <TabBar base={base} active="me" unread={0} />
    </AppFrame>
  )
}

/** Five reworded moments, rotated, plus a life check-in. History is kept on the server. */
export async function RecalibrateScreen({ payload, user, portal, base, query }: Ctx) {
  const [{ copy, formId, scenes }, due] = await Promise.all([monthMoments(payload, user.id), recalibrationDueFor(payload, user.id)])
  return (
    <AppFrame testId="recalibrate">
      <div className="app-scroll compass-learner">
        <div className="ivy" aria-hidden="true" />
        <div className="app-head"><Back href={base} label="Home" /><h1>A fresh look</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">{due ? 'It has been about a month. Five short questions, in different words.' : 'You can take another look whenever you like. The words are a little different this time.'}</p>
        <form action="/api/compass" method="post">
          <Hidden fields={{ next: `${base}/me/path`, portal: String(portal.slug || ''), form: formId }} />
          {scenes.map((scene) => (
            <fieldset key={scene.key} className="card" data-testid="month-scene" data-scene={scene.key}>
              <legend>{scene.caption}</legend>
              {scene.subline ? <p className="muted">{scene.subline}</p> : null}
              {scene.options.map((option) => (
                <label key={option.key} className="list-link choice">
                  <input type="radio" name={scene.key} value={option.key} required />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <fieldset className="card" data-testid="life-check">
            <legend>{copy.lifeCaption}</legend>
            <p className="muted">Tick any that fit. Leave them if none do.</p>
            {LIFE_EVENTS.map((option) => (
              <label key={option.key} className="list-link choice">
                <input type="checkbox" name={`life-${option.key}`} value="yes" />
                <span>{option.label}</span>
              </label>
            ))}
            <label className="note-label" htmlFor="life-note">A line, if you want to add one</label>
            <textarea id="life-note" name="lifeNote" maxLength={280} rows={3} data-testid="life-note" placeholder="Optional." />
          </fieldset>
          <button className="pill gold block" type="submit" data-testid="month-save">Keep this month</button>
        </form>
      </div>
      <TabBar base={base} active="home" unread={0} />
    </AppFrame>
  )
}
