import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { learnerPath, monthMoments, recalibrationDueFor } from '@/server/compass'
import { type Ctx, str } from '../common'

/** The learner's path: warm words, next steps and movement. No numbers. */
export async function LearnerPathScreen({ payload, user, portal, base, query }: Ctx) {
  const summary = await learnerPath(payload, user.id, String(portal.slug || ''))
  return (
    <AppFrame testId="learner-path">
      <div className="app-scroll">
        <div className="app-head"><Back href={`${base}/me`} label="Me" /><h1>Your path</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">A look at where a little time will help. Nothing here is a mark.</p>
        {summary.focusLine ? <p className="card" data-testid="focus-line" style={{ fontSize: 18 }}>{summary.focusLine}</p> : null}
        {summary.areas.map((area) => (
          <article key={area.area} className="card" data-testid="soft-area" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <b>{area.area}</b>
              {area.place ? <span data-testid="soft-place">{area.place}</span> : null}
            </div>
            <p style={{ margin: '8px 0 0' }}>{area.forward}</p>
          </article>
        ))}
        <p className="eyebrow" style={{ marginTop: 18 }}>Next steps</p>
        {summary.steps.map((step) => (
          <p key={step.title} className="card" data-testid="next-step" style={{ marginTop: 10 }}><b>{step.title}.</b> {step.detail}</p>
        ))}
        {summary.talks.length ? <p className="eyebrow" style={{ marginTop: 18 }}>Talks for the areas to grow</p> : null}
        {summary.talks.map((talk) => (
          <Link key={talk.href + talk.title} className="list-link" href={talk.href} data-testid="suggested-talk">
            <span className="grow">{talk.title}</span>›
          </Link>
        ))}
        {summary.movement.length ? <p className="eyebrow" style={{ marginTop: 18 }}>Since last month</p> : null}
        {summary.movement.map((line) => <p key={line} data-testid="movement">{line}</p>)}
        {!summary.areas.length ? <p className="card" data-testid="path-empty">When you have walked through the opening, a few next steps will sit here.</p> : null}
      </div>
      <TabBar base={base} active="me" unread={0} />
    </AppFrame>
  )
}

/** The monthly look: the same scales, different words, plus one line about life just now. */
export async function RecalibrateScreen({ payload, user, portal, base, query }: Ctx) {
  const [{ copy, scenes }, due] = await Promise.all([monthMoments(payload), recalibrationDueFor(payload, user.id)])
  return (
    <AppFrame testId="recalibrate">
      <div className="app-scroll">
        <div className="app-head"><Back href={base} label="Home" /><h1>A fresh look</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">{due ? 'It has been about a month. A few new moments keep the path close to this season.' : 'You can take another look whenever you like. The words are a little different this time.'}</p>
        <form action="/api/compass" method="post">
          <Hidden fields={{ next: `${base}/me/path`, portal: String(portal.slug || '') }} />
          {scenes.map((scene) => (
            <fieldset key={scene.key} className="card" data-testid="month-scene" data-scene={scene.key} style={{ border: 0, marginTop: 12 }}>
              <legend style={{ fontWeight: 700 }}>{scene.caption}</legend>
              {scene.subline ? <p className="muted">{scene.subline}</p> : null}
              {scene.options.map((option) => (
                <label key={option.key} className="list-link" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="radio" name={scene.key} value={option.key} required />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <fieldset className="card" data-testid="life-check" style={{ border: 0, marginTop: 12 }}>
            <legend style={{ fontWeight: 700 }}>{copy.lifeCaption}</legend>
            <p className="muted">{copy.lifeSubline}</p>
            {copy.lifeOptions.map((option) => (
              <label key={option.key} className="list-link" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="radio" name="life" value={option.key} />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <button className="pill ink block" type="submit" data-testid="month-save" style={{ marginTop: 16 }}>Keep this month&apos;s path</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>{str(portal.slug) ? '' : ''}</p>
      </div>
      <TabBar base={base} active="home" unread={0} />
    </AppFrame>
  )
}
