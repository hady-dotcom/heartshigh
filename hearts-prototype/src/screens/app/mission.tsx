import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { ExampleInUse, Helplines } from '@/components/app/care'
import { MissionCard } from '@/components/app/mission-card'
import { CARE_SUPPORT_LEAD, CARE_SUPPORT_NOW } from '@/lib/care-copy'
import { learnerBrand } from '@/lib/learner-brand'
import { shellOf } from '@/lib/portal-look'
import { joinCount, loadMission, missionView, openMissionsFor, shapedFor, supportMessages, threadFor } from '@/server/missions'
import { helpContactsFor } from '@/server/opening'
import { type Ctx, shortDate, str, unreadCount } from '../common'

export async function activeMissionCard(payload: Ctx['payload'], portalId: number, base: string, appName = 'HEARTS') {
  const open = await openMissionsFor(payload, portalId)
  const mission = open[0]
  if (!mission) return null
  const joined = await joinCount(payload, mission.id)
  return <MissionCard mission={mission} base={base} joined={joined} compact appName={appName} />
}

export async function MissionScreen({ payload, user, portal, base, query }: Ctx, id: number) {
  const mission = await loadMission(payload, id)
  const unread = await unreadCount(payload, user)
  if (!mission) {
    return (
      <AppFrame testId="mission-missing">
        <div className="app-scroll">
          <Back href={base} label="Home" />
          <div className="app-head"><h1>This ask is not here</h1></div>
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
        )) : (
          <ExampleInUse testId="shaped-empty" title="The Friday reminder" action={{ href: base, label: 'Back home' }}>
            <p>You helped decide: the button now says “Stay with this”.</p>
          </ExampleInUse>
        )}
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}

export async function SupportScreen({ payload, user, portal, base, query }: Ctx) {
  const thread = await threadFor(payload, user, portal.id)
  const messages = await supportMessages(payload, thread.id)
  const contacts = await helpContactsFor(payload, portal.id)
  const unread = await unreadCount(payload, user)
  const modern = shellOf(portal) === 'modern'
  return (
    <AppFrame evening={!modern} testId="support-page" brand={modern ? learnerBrand(portal) : undefined}>
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Ask for help</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <section className="care-panel" data-testid="support-care">
          <h2 style={modern ? { margin: 0 } : { margin: 0, fontSize: 22 }}>A person will read this</h2>
          <p>{CARE_SUPPORT_LEAD}</p>
          <p>{CARE_SUPPORT_NOW}</p>
          <Helplines contacts={contacts} />
        </section>
        {messages.length ? messages.map((message) => (
          <section key={message.id} className="card" data-testid="support-message" data-desk={message.fromDesk ? 'yes' : 'no'}>
            <b>{message.fromDesk ? 'Your portal team' : 'You'}</b>
            <p>{str(message.body)}</p>
            <small className="muted">{shortDate(message.createdAt)}</small>
          </section>
        )) : (
          <ExampleInUse testId="support-example" title="A note, and a reply" action={{ href: '#support-write', label: 'Write to the team' }}>
            <p><b>You</b> · I have been low this week and I do not know who to tell.</p>
            <p style={{ marginTop: 8 }}><b>Your portal team</b> · Thank you for writing. Amina will reply here today. If you need someone sooner, the helplines above answer now.</p>
          </ExampleInUse>
        )}
        <form id="support-write" className="card form-stack" action="/api/missions" method="post">
          <Hidden fields={{ action: 'support', next: `${base}/me/help` }} />
          <label>Your note<textarea className="field" name="body" rows={4} required placeholder="Write what you need, in your own words" data-testid="support-body" /></label>
          <button className="pill gold" type="submit" data-testid="support-send">Send to the team</button>
        </form>
      </div>
      {modern ? <LearnerTabBar base={base} active="me" portal={portal} unread={unread} /> : <TabBar base={base} active="me" unread={unread} />}
    </AppFrame>
  )
}
