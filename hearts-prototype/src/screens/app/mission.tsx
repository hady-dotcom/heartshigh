import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { MissionCard } from '@/components/app/mission-card'
import { joinCount, joinOf, loadMission, missionView, openMissionsFor, shapedFor, supportMessages, threadFor } from '@/server/missions'
import { type Ctx, shortDate, str, unreadCount } from '../common'

export async function activeMissionCard(payload: Ctx['payload'], portalId: number, base: string) {
  const open = await openMissionsFor(payload, portalId)
  const mission = open[0]
  if (!mission) return null
  const joined = await joinCount(payload, mission.id)
  return <MissionCard mission={mission} base={base} joined={joined} compact />
}

export async function MissionScreen({ payload, user, portal, base, query }: Ctx, id: number) {
  const mission = await loadMission(payload, id)
  const unread = await unreadCount(payload, user)
  if (!mission) {
    return (
      <AppFrame testId="mission-missing">
        <div className="app-scroll">
          <Back href={base} label="Home" />
          <p>That ask is no longer here.</p>
        </div>
        <TabBar base={base} active="home" unread={unread} />
      </AppFrame>
    )
  }
  const view = await missionView(payload, mission, user)
  const tryHref = mission.tryPath ? `${base}${mission.tryPath.startsWith('/') ? mission.tryPath : `/${mission.tryPath}`}` : `${base}/feed`
  return (
    <AppFrame evening testId="mission-page">
      <div className="app-scroll">
        <Back href={base} label="Home" />
        <div className="app-head"><h1>{mission.title}</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">{mission.ask}</p>
        {mission.why ? <p>{mission.why}</p> : null}
        <section className="card" data-testid="mission-progress">
          <p className="eyebrow">Together</p>
          <h2 style={{ margin: '0 0 6px' }}>{view.progress.line}</h2>
          <p className="muted" data-testid="mission-minutes">{view.toward.line}. Take it at your own pace. This is a thank-you, not a duty.</p>
        </section>
        {!view.join ? (
          <form action="/api/missions" method="post">
            <Hidden fields={{ action: 'join', id: String(mission.id), portal: String(portal.id), next: `${base}/mission/${mission.id}` }} />
            <button className="pill gold block" type="submit" data-testid="mission-join">I can help</button>
          </form>
        ) : view.join.finishedAt ? (
          <p className="card" data-testid="mission-done">You did it. Thank you.</p>
        ) : (
          <form action="/api/missions" method="post">
            <Hidden fields={{ action: 'finish', id: String(mission.id), next: `${base}/mission/${mission.id}` }} />
            <button className="pill gold block" type="submit" data-testid="mission-finish">I have done this</button>
          </form>
        )}
        <Link className="text-link" href={tryHref} data-testid="mission-try">Open the screen this ask is about</Link>
      </div>
      <TabBar base={base} active="home" unread={unread} />
    </AppFrame>
  )
}

export async function ShapedScreen({ payload, user, portal, base, query }: Ctx) {
  const items = await shapedFor(payload, user.id)
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame evening testId="shaped-page">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Things you helped shape</h1></div>
        <Flash error={query.error} notice={query.notice} />
        {items.length ? items.map((item) => (
          <section key={item.id} className="card" data-testid="shaped-item">
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>{item.title}</h2>
            <p data-testid="shaped-result">You helped decide: {item.result}</p>
          </section>
        )) : <p className="muted">When a mission you joined is decided, it will sit here.</p>}
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}

export async function SupportScreen({ payload, user, portal, base, query }: Ctx) {
  const thread = await threadFor(payload, user, portal.id)
  const messages = await supportMessages(payload, thread.id)
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame evening testId="support-page">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Ask for help</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Write to the team here. You do not need an email.</p>
        {messages.map((message) => (
          <section key={message.id} className="card" data-testid="support-message" data-desk={message.fromDesk ? 'yes' : 'no'}>
            <b>{message.fromDesk ? 'HEARTS' : 'You'}</b>
            <p>{str(message.body)}</p>
            <small className="muted">{shortDate(message.createdAt)}</small>
          </section>
        ))}
        <form className="card form-stack" action="/api/missions" method="post">
          <Hidden fields={{ action: 'support', next: `${base}/me/help` }} />
          <label>Your note<textarea className="field" name="body" rows={4} required data-testid="support-body" /></label>
          <button className="pill gold" type="submit" data-testid="support-send">Send</button>
        </form>
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}
