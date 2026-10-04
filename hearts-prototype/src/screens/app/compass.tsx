import Link from 'next/link'
import { MonthLook } from '@/components/app/month-look'
import { AppFrame, Back, Flash, TabBar } from '@/components/app/shell'
import { LIFE_EVENTS } from '@/lib/compass-bank'
import { learnerPath, monthMoments, recalibrationDueFor } from '@/server/compass'
import { type Ctx } from '../common'

/** The learner's path: warm words and next steps. No numbers, no persona, no score. */
export async function LearnerPathScreen({ payload, user, portal, base, query }: Ctx) {
  const summary = await learnerPath(payload, user.id, String(portal.slug || ''))
  return (
    <AppFrame testId="learner-path">
      <div className="app-scroll compass-learner">
        <div className="app-head"><Back href={`${base}/me`} label="Me" /><h1>Focusing on</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">A little time, in the places that would help this month.</p>
        {summary.focusLine ? <p className="card focus-card" data-testid="focus-line">{summary.focusLine}</p> : null}
        {summary.areas.map((area) => (
          <article key={area.area} className="card" data-testid="soft-area">
            <b>{area.area}</b>
            <p>{area.forward}</p>
          </article>
        ))}
        {summary.steps.length ? <p className="eyebrow">Next steps</p> : null}
        {summary.steps.map((step) => step.href ? (
          <Link key={step.title} className="card next-step" href={step.href} data-testid="next-step"><b>{step.title}.</b> {step.detail}</Link>
        ) : (
          <p key={step.title} className="card" data-testid="next-step"><b>{step.title}.</b> {step.detail}</p>
        ))}
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
        <div className="app-head"><Back href={base} label="Home" /><h1>A fresh look</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">{due ? 'It has been about a month. Five short questions, in different words.' : 'You can take another look whenever you like. The words are a little different this time.'}</p>
        <MonthLook
          scenes={scenes}
          life={LIFE_EVENTS.map((option) => ({ key: option.key, label: option.label }))}
          lifeCaption={copy.lifeCaption}
          formId={formId}
          portal={String(portal.slug || '')}
          next={`${base}/me/path`}
        />
      </div>
      <TabBar base={base} active="home" unread={0} />
    </AppFrame>
  )
}
