import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { MissionHelp } from '@/components/desk/help'
import { now } from '@/lib/clock'
import type { SessionUser } from '@/server/context'
import { canEditMissions, canViewMissions, deskThreads, joinCount, listMissions, loadMission, missionView } from '@/server/missions'
import { rows, str } from '../common'
import type { Ctx } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'
import styles from './desk-extra.module.css'

type Query = Record<string, string | undefined>

async function Frame({
  ctx,
  master,
  title,
  intro,
  testId,
  tools,
  children,
}: {
  ctx: Ctx | null
  master: { payload: Payload; user: SessionUser; query: Query } | null
  title: string
  intro: string
  testId: string
  tools?: React.ReactNode
  children: React.ReactNode
}) {
  if (ctx) return <AdminFrame ctx={ctx} active="missions" title={title} intro={intro} testId={testId} tools={tools} help={<MissionHelp />}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="missions" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={tools} help={<MissionHelp />}>
      {children}
    </DeskFrame>
  )
}

function queryOf(ctx: Ctx | null, master: { query: Query } | null) {
  return (ctx?.query || master?.query || {}) as Query
}

export async function MissionPages({ ctx, master, path }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null; path: string[] }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = queryOf(ctx || null, master || null)
  const base = ctx ? `${ctx.base}/admin/missions` : '/master/missions'
  if (!canViewMissions(user)) {
    return <Frame ctx={ctx || null} master={master || null} title="Missions" intro="" testId="missions-denied"><p>Missions are for the master desk and portal admins.</p></Frame>
  }
  const [head, rest] = path
  if (head === 'new') return <EditPage ctx={ctx || null} master={master || null} base={base} />
  if (head && rest === 'edit') return <EditPage ctx={ctx || null} master={master || null} base={base} id={Number(head)} />
  if (head) return <DetailPage ctx={ctx || null} master={master || null} base={base} id={Number(head)} />
  return <ListPage ctx={ctx || null} master={master || null} base={base} query={query} />
}

async function ListPage({ ctx, master, base }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; query: Query }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const items = await listMissions(payload, user)
  const threads = user.role === 'master' ? await deskThreads(payload) : []
  return (
    <Frame
      ctx={ctx}
      master={master}
      title="Help shape HEARTS"
      intro="Ask learners, warmly, to help us try something. Never a scolding. Thank them when you decide."
      testId="missions-desk"
      tools={canEditMissions(user) ? <Link className="btn" href={`${base}/new`} data-testid="mission-new">New mission</Link> : null}
    >
      <div className={styles.page}>
        <div className={styles.cards}>
          {items.map((item) => (
            <Link key={item.id} className={styles.card} href={`${base}/${item.id}`} data-testid="mission-card" data-status={item.status}>
              <span className={`badge ${item.status === 'open' ? 'teal' : item.status === 'shared' ? 'gold' : 'grey'}`}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.ask}</p>
              <p className={styles.quiet}>{item.target} learners · {item.minutesAsked} minutes</p>
            </Link>
          ))}
          {!items.length ? <p className={styles.quiet}>No missions yet. Write a warm ask when you need a hand.</p> : null}
        </div>
        {threads.length ? (
          <section className="panel" data-testid="support-inbox">
            <header><h2>Ask for help</h2></header>
            <div className="body">
              {threads.map((thread) => (
                <p key={thread.id} className={styles.quiet}>{(thread.user && typeof thread.user === 'object' && 'name' in thread.user ? String(thread.user.name) : 'A learner')} · {thread.status}</p>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Frame>
  )
}

async function DetailPage({ ctx, master, base, id }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; id: number }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const mission = await loadMission(payload, id)
  if (!mission) return <Frame ctx={ctx} master={master} title="Missions" intro="" testId="mission-missing"><p>That mission was not found.</p></Frame>
  const view = await missionView(payload, mission)
  const joined = await joinCount(payload, mission.id)
  const masterUser = canEditMissions(user)
  return (
    <Frame ctx={ctx} master={master} title={mission.title} intro={mission.ask} testId="mission-detail" tools={<Link className="btn ghost" href={base}>All missions</Link>}>
      <div className={styles.page}>
        <section className={styles.summary}>
          <div className={styles.tile}><b data-testid="mission-joined">{joined}</b><span>Have joined</span></div>
          <div className={styles.tile}><b data-testid="mission-target">{mission.target}</b><span>Target</span></div>
          <div className={styles.tile}><b>{view.progress.pct}%</b><span>{view.progress.line}</span></div>
          <div className={styles.tile}><b>{mission.minutesAsked}</b><span>Minutes asked</span></div>
        </section>
        <p className={styles.quiet}>{mission.why || 'A thank-you, not a duty.'}</p>
        {masterUser ? (
          <div className="actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {mission.status === 'draft' || mission.status === 'closed' ? (
              <form action="/api/missions" method="post"><Hidden fields={{ action: 'open', id: String(mission.id), next: `${base}/${mission.id}` }} /><button className="btn" type="submit" data-testid="mission-open">Open</button></form>
            ) : null}
            {mission.status === 'open' ? (
              <form action="/api/missions" method="post"><Hidden fields={{ action: 'close', id: String(mission.id), next: `${base}/${mission.id}` }} /><button className="btn ghost" type="submit" data-testid="mission-close">Close</button></form>
            ) : null}
            <Link className="btn ghost" href={`${base}/${mission.id}/edit`}>Edit</Link>
          </div>
        ) : null}
        {masterUser ? (
          <section className="panel" data-testid="mission-result-panel">
            <header><h2>What we decided</h2></header>
            <form className="body form" action="/api/missions" method="post">
              <Hidden fields={{ action: 'result', id: String(mission.id), next: `${base}/${mission.id}` }} />
              <label>A short line for everyone who joined
                <textarea name="result" rows={3} defaultValue={mission.result || ''} data-testid="mission-result" placeholder="the button now says 'Stay with this'" />
              </label>
              <p className={styles.quiet}>Each person gets a thank-you in the app. Email only goes if mail is set up.</p>
              <button className="btn" type="submit" data-testid="mission-share-result">Thank everyone</button>
            </form>
          </section>
        ) : null}
        {mission.result ? <p data-testid="mission-decided"><b>What we decided:</b> {mission.result}</p> : null}
      </div>
    </Frame>
  )
}

async function EditPage({ ctx, master, base, id }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; id?: number }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  if (!canEditMissions(user)) {
    return <Frame ctx={ctx} master={master} title="Missions" intro="" testId="mission-edit-denied"><p>Only the master can write a mission.</p></Frame>
  }
  const current = id ? await loadMission(payload, id) : null
  const portals = await rows(payload, 'portals', undefined, { sort: 'name', limit: 40 })
  const experiments = await rows(payload, 'experiments', undefined, { sort: '-updatedAt', limit: 40 }).catch(() => [])
  const today = now().toISOString().slice(0, 10)
  const later = new Date(now().getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  return (
    <Frame ctx={ctx} master={master} title={current ? `Edit ${current.title}` : 'New mission'} intro="A warm ask. Never guilt." testId="mission-edit">
      <form className="form panel" action="/api/missions" method="post" data-testid="mission-form">
        <header><h2>{current ? 'Details' : 'Write the ask'}</h2></header>
        <div className="body">
          <Hidden fields={{ action: current ? 'update' : 'create', id: current ? String(current.id) : '', next: current ? `${base}/${current.id}` : `${base}/new` }} />
          <label>Title<input name="title" required defaultValue={current?.title || ''} data-testid="mission-title" placeholder="Please use HEARTS for one hour this week" /></label>
          <label>Plain ask<textarea name="ask" required rows={3} defaultValue={current?.ask || ''} data-testid="mission-ask" placeholder="If you have an hour this week, would you sit with HEARTS and tell us how it felt?" /></label>
          <label>Why it matters<textarea name="why" rows={3} defaultValue={current?.why || ''} data-testid="mission-why" placeholder="We are choosing the words on a button, and your hour helps us decide." /></label>
          <label>Minutes asked<input type="number" name="minutesAsked" min={5} max={600} defaultValue={current?.minutesAsked || 60} data-testid="mission-minutes" /></label>
          <label>Start<input type="date" name="startsAt" defaultValue={(current?.startsAt || today).slice(0, 10)} data-testid="mission-start" /></label>
          <label>End<input type="date" name="endsAt" defaultValue={(current?.endsAt || later).slice(0, 10)} data-testid="mission-end" /></label>
          <label>Target learners<input type="number" name="target" min={1} defaultValue={current?.target || 700} data-testid="mission-target-field" /></label>
          <label>Portals
            <select name="portal" multiple defaultValue={(current?.portals || []).map(String)} data-testid="mission-portals">
              {portals.map((portal) => <option key={portal.id} value={portal.id}>{str(portal.name)}</option>)}
            </select>
          </label>
          <p className={styles.quiet}>Leave portals unselected for every portal.</p>
          <label>Experiment
            <select name="experiment" defaultValue={current?.experiment ? String(current.experiment) : ''} data-testid="mission-experiment">
              <option value="">None</option>
              {experiments.map((row) => <option key={row.id} value={row.id}>{str(row.name)}</option>)}
            </select>
          </label>
          <label>Screen to try<input name="tryPath" defaultValue={current?.tryPath || ''} placeholder="/feed" data-testid="mission-try" /></label>
          <button className="btn" type="submit" data-testid="mission-save">{current ? 'Save' : 'Create draft'}</button>
        </div>
      </form>
    </Frame>
  )
}
