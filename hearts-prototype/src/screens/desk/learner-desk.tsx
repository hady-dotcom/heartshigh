import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import { ClickRow } from '@/components/desk/row-link'
import { portalDisplayName } from '@/lib/portal-name'
import {
  actorScope,
  canReadLearner,
  diaryDeleteRefusal,
  managesLearnerAccounts,
  matchesLearnerSearch,
  planActionRefusal,
} from '@/lib/learner-desk'
import { HideTestFilter } from '@/components/desk/hide-test'
import { hideTestFromQuery, visiblePeople } from '@/lib/test-accounts'
import type { SessionUser } from '@/server/context'
import { dayNumber } from '@/server/learner'
import { JournalList } from '@/components/desk/journal-list'
import { JOURNAL_LABEL } from '@/lib/journal-copy'
import { journalAnswered, journalWhen } from '@/lib/journal-list'
import { diaryWords } from '@/server/learner-desk'
import { idOf } from '@/lib/ids'
import { type Query, longDate, ref, rows, str } from '../common'
import { DeskFrame, masterNav } from './shell'
import { AdminFrame } from './overview'
import type { Ctx } from '../common'

type MasterCtx = { payload: Payload; user: SessionUser; query: Query }

function Frame({ ctx, active, title, intro, testId, primary, children }: { ctx: MasterCtx; active: string; title: string; intro: string; testId: string; primary?: { label: string; href: string }; children: ReactNode }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active={active} nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId} primary={primary}>
      {children}
    </DeskFrame>
  )
}

function dated(iso?: string | null, empty = 'Not recorded') {
  if (!iso) return empty
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return empty
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function portalOf(person: { tenants?: { tenant?: unknown }[] }, portals: { id: number; name?: unknown; organisationName?: unknown }[]) {
  const id = idOf(person.tenants?.[0]?.tenant)
  const portal = portals.find((row) => row.id === id)
  return { id, name: portal ? portalDisplayName(portal) : 'Not in a portal' }
}

export function LearnerFilters({
  action,
  query,
  portals,
  locked,
}: {
  action: string
  query: Query
  portals: { id: number; name: string }[]
  locked?: boolean
}) {
  return (
    <form className="learner-filters" action={action} method="get" data-testid="learner-filters">
      {query.hideTest === '0' ? <input type="hidden" name="hideTest" value="0" /> : null}
      <label>
        Search
        <input type="search" name="q" defaultValue={query.q || ''} placeholder="Name or email" data-testid="learner-search" />
      </label>
      <label>
        Portal
        <select name="portal" defaultValue={query.portal || ''} data-testid="learner-portal-filter" disabled={locked}>
          {locked ? null : <option value="">All portals</option>}
          {portals.map((portal) => (
            <option key={portal.id} value={portal.id}>{portal.name}</option>
          ))}
        </select>
      </label>
      <button className="btn ink small" type="submit" data-testid="learner-filter-submit">Show</button>
    </form>
  )
}

export function BulkBar({ id, action, next, pick, confirmHint, buttons }: { id: string; action: string; next: string; pick: string; confirmHint: string; buttons: { op?: string; label: string; testId: string; danger?: boolean; valueName?: string }[] }) {
  return (
    <form id={id} className="bulk-bar" action="/api/hearts" method="post" data-testid={id}>
      <Hidden fields={{ action, next }} />
      <input name="confirm" data-testid="bulk-confirm" placeholder={confirmHint} aria-label={confirmHint} autoComplete="off" />
      {buttons.map((button) => (
        <button key={button.testId} className={`btn ${button.danger ? 'danger' : 'ghost'} small`} name={button.valueName || 'op'} value={button.op || pick} type="submit" data-testid={button.testId}>{button.label}</button>
      ))}
    </form>
  )
}

export async function MasterLearners(ctx: MasterCtx) {
  const [people, portals] = await Promise.all([
    rows(ctx.payload, 'users', { role: { equals: 'learner' } }, { limit: 500, sort: 'name' }),
    rows(ctx.payload, 'portals', undefined, { sort: 'name', limit: 100 }),
  ])
  const hide = hideTestFromQuery(ctx.query)
  const wanted = Number(ctx.query.portal) || 0
  const q = ctx.query.q || ''
  const visible = visiblePeople(people, hide).filter((person) => {
    const home = portalOf(person as { tenants?: { tenant?: unknown }[] }, portals)
    if (wanted && home.id !== wanted) return false
    return matchesLearnerSearch(str(person.name), str(person.email), q)
  })
  const here = '/master/learners'
  return (
    <Frame ctx={ctx} active="learners" title="Learners" intro="Everyone learning across the portals. Open a row to reset a password, pause them, move them, or delete the account." testId="master-learners" primary={{ label: `Open ${JOURNAL_LABEL.many.toLowerCase()}`, href: '/master/diaries' }}>
      <section className="panel" id="learner-list">
        <header className="light">
          <h2 data-testid="learner-count">Learners ({visible.length})</h2>
          <HideTestFilter action={here} hide={hide} />
        </header>
        <div className="body">
          <LearnerFilters action={here} query={ctx.query} portals={portals.map((portal) => ({ id: portal.id, name: portalDisplayName(portal) }))} />
          {managesLearnerAccounts(ctx.user.role) ? (
            <BulkBar
              id="learner-bulk"
              action="learner-bulk"
              next={here}
              pick="learner"
              confirmHint="Type delete or remove"
              buttons={[
                { op: 'reset', label: 'New passwords', testId: 'bulk-reset' },
                { op: 'remove', label: 'Take out of portal', testId: 'bulk-remove' },
                { op: 'delete', label: 'Delete accounts', testId: 'bulk-delete', danger: true },
              ]}
            />
          ) : null}
        </div>
        <PeopleTable
          people={visible}
          portals={portals}
          hrefFor={(id) => `/master/learners/${id}`}
          pickable={managesLearnerAccounts(ctx.user.role)}
          emptyHref={here}
        />
      </section>
    </Frame>
  )
}

function PeopleTable({
  people,
  portals,
  hrefFor,
  pickable,
  emptyHref,
  extra,
}: {
  people: { id: number; name?: unknown; email?: unknown; paused?: unknown; tenants?: { tenant?: unknown }[]; joinedAt?: unknown; createdAt?: unknown }[]
  portals: { id: number; name?: unknown; organisationName?: unknown }[]
  hrefFor: (id: number) => string
  pickable: boolean
  emptyHref: string
  extra?: (person: { id: number }) => ReactNode
}) {
  const span = (pickable ? 5 : 4) + (extra ? 1 : 0)
  return (
    <div className="table-wrap">
      <table className="data people-table">
        <thead>
          <tr>
            {pickable ? <th>Pick</th> : null}
            <th>Name</th>
            <th>Email</th>
            <th>Portal</th>
            <th>Joined</th>
            {extra ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const home = portalOf(person, portals)
            const href = hrefFor(person.id)
            return (
              <ClickRow key={person.id} href={href} testId="learner-row">
                {pickable ? (
                  <td data-label="Pick">
                    <input form="learner-bulk" type="checkbox" name="learner" value={person.id} data-testid="learner-pick" aria-label={`Select ${str(person.name)}`} />
                  </td>
                ) : null}
                <td data-label="Name">
                  <a href={href} data-testid="learner-open"><b>{str(person.name)}</b></a>
                  {person.paused ? <div className="badge rose" data-testid="learner-paused">Paused</div> : null}
                </td>
                <td data-label="Email" className="email-cell"><span title={str(person.email)}>{str(person.email)}</span></td>
                <td data-label="Portal" data-testid="learner-portal">{home.name}</td>
                <td data-label="Joined">{dated(str(person.joinedAt) || str(person.createdAt), 'Not recorded')}</td>
                {extra ? <td>{extra(person)}</td> : null}
              </ClickRow>
            )
          })}
          {!people.length ? (
            <tr>
              <td colSpan={span}>
                <ExampleInUse desk title="Maryam Begum" action={{ href: emptyHref, label: 'Show everyone' }}>
                  <p>East London Mosque · joined in October · one talk finished</p>
                </ExampleInUse>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

async function learnerFacts(payload: Payload, learnerId: number) {
  const [done, plans, diaries, watches, answers] = await Promise.all([
    payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: { user: { equals: learnerId } } }),
    payload.find({ collection: 'schedules', overrideAccess: true, depth: 0, limit: 1, where: { or: [{ owner: { equals: learnerId } }, { learners: { contains: learnerId } }] } }),
    payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: { user: { equals: learnerId } } }),
    payload.find({ collection: 'watch-sessions', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: { user: { equals: learnerId } } }),
    payload.find({ collection: 'answers', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: { user: { equals: learnerId } } }),
  ])
  const stamps = [done.docs[0]?.createdAt, watches.docs[0]?.createdAt, answers.docs[0]?.createdAt].filter((value): value is string => typeof value === 'string')
  return { progress: done.totalDocs, plans: plans.totalDocs, diaries: diaries.totalDocs, activity: stamps.sort().at(-1) || null }
}

function DetailFacts({ portal, joined, seen, progress, plans, diaries }: { portal: string; joined: string; seen: string; progress: string; plans: number; diaries: number }) {
  return (
    <div className="fact-grid" data-testid="learner-facts">
      <div className="count-tile"><span>Portal</span><b data-testid="learner-portal">{portal}</b></div>
      <div className="count-tile"><span>Joined</span><b data-testid="learner-joined">{joined}</b></div>
      <div className="count-tile"><span>Last seen</span><b data-testid="learner-last-seen">{seen}</b></div>
      <div className="count-tile"><span>Progress</span><b data-testid="learner-progress">{progress}</b></div>
      <div className="count-tile"><span>Study plans</span><b data-testid="learner-plans">{plans}</b></div>
      <div className="count-tile"><span>{JOURNAL_LABEL.one} entries</span><b data-testid="learner-diaries">{diaries}</b></div>
    </div>
  )
}

function AccountActions({
  learner,
  next,
  portals,
  master,
}: {
  learner: { id: number; name: string; paused: boolean }
  next: string
  portals: { id: number; name: string }[]
  master: boolean
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'start' }}>
      <form className="panel" action="/api/hearts" method="post" data-testid="reset-password">
        <header><h2>New password</h2></header>
        <div className="body form">
          <p>Makes a temporary password and shows it once. They must choose their own the next time they sign in.</p>
          <Hidden fields={{ action: 'learner-reset', learner: learner.id, next }} />
          <button className="btn ink" type="submit">Make a new password</button>
        </div>
      </form>
      {master ? (
        <form className="panel" action="/api/hearts" method="post" data-testid="move-portal">
          <header><h2>Move to another portal</h2></header>
          <div className="body form">
            <Hidden fields={{ action: 'learner-move', learner: learner.id, next }} />
            <label className="stack">Portal
              <select name="portal" data-testid="move-portal-pick" required>
                <option value="">Choose a portal</option>
                {portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}
              </select>
            </label>
            <button className="btn ink" type="submit">Move</button>
          </div>
        </form>
      ) : null}
      <form className="panel" action="/api/hearts" method="post">
        <header><h2>{learner.paused ? 'Let them sign in' : 'Pause sign-in'}</h2></header>
        <div className="body form">
          <p>{learner.paused ? `They can sign in again. Their ${JOURNAL_LABEL.one.toLowerCase()} and plans stay as they are.` : 'They stay in the portal, and they cannot sign in until you let them.'}</p>
          <Hidden fields={{ action: learner.paused ? 'learner-unpause' : 'learner-pause', learner: learner.id, next }} />
          <button className="btn ink" type="submit" data-testid={learner.paused ? 'unpause-learner' : 'pause-learner'}>{learner.paused ? 'Let them sign in' : 'Pause'}</button>
        </div>
      </form>
      <form className="panel" action="/api/hearts" method="post" data-testid="remove-learner">
        <header><h2>Take out of this portal</h2></header>
        <div className="body form">
          <p>They leave this portal. The account, {JOURNAL_LABEL.one.toLowerCase()} and plans stay until you delete them.</p>
          <Hidden fields={{ action: 'learner-remove', learner: learner.id, next }} />
          <label className="check"><input type="checkbox" name="sure" required data-testid="remove-confirm" /> Yes, take them out</label>
          <button className="btn ghost" type="submit">Take out of portal</button>
        </div>
      </form>
      <form className="danger-zone" action="/api/hearts" method="post" data-testid="delete-account">
        <b>Delete the account</b>
        <p>Type {learner.name} to confirm. This deletes their {JOURNAL_LABEL.one.toLowerCase()}, study plans and answers. Charts keep the numbers, but not their name.</p>
        <Hidden fields={{ action: 'learner-delete', learner: learner.id, next }} />
        <label className="stack">Their name<input name="confirm" data-testid="delete-name" required autoComplete="off" /></label>
        <button className="btn danger" type="submit" data-testid="delete-learner">Delete the account</button>
      </form>
    </div>
  )
}

async function LearnerDetailBody({ payload, user, learnerId, next, masterDesk }: { payload: Payload; user: SessionUser; learnerId: number; next: string; masterDesk: boolean }) {
  const learner = (await payload.findByID({ collection: 'users', id: learnerId, overrideAccess: true, depth: 0 }).catch(() => null)) as (SessionUser & { paused?: boolean | null; lastSeenAt?: string | null }) | null
  if (!learner || learner.role !== 'learner') {
    return <section className="panel"><div className="body" data-testid="learner-missing"><p>That learner could not be found.</p></div></section>
  }
  if (!canReadLearner(actorScope(user), { role: learner.role, portalId: idOf(learner.tenants?.[0]?.tenant) })) {
    return <section className="panel"><div className="body" data-testid="learner-refused"><p>That learner is in another portal.</p></div></section>
  }
  const portals = await rows(payload, 'portals', undefined, { sort: 'name', limit: 100 })
  const home = portalOf(learner, portals)
  const facts = await learnerFacts(payload, learner.id)
  const seenAt = learner.lastSeenAt || facts.activity
  const progress = facts.progress === 1 ? '1 part watched' : `${facts.progress} parts watched`
  const manage = managesLearnerAccounts(user.role)
  return (
    <div data-testid="learner-detail" style={{ display: 'grid', gap: 18 }}>
      <section className="panel">
        <header className="light"><h2>{learner.name}{learner.paused ? <span className="badge rose" data-testid="learner-paused">Paused</span> : null}</h2><p>Day {dayNumber(learner)}</p></header>
        <div className="body"><DetailFacts portal={home.name} joined={dated(learner.joinedAt || learner.createdAt)} seen={seenAt ? dated(seenAt, 'Not signed in yet') : 'Not signed in yet'} progress={progress} plans={facts.plans} diaries={facts.diaries} /></div>
      </section>
      {manage ? <AccountActions learner={{ id: learner.id, name: learner.name || 'This learner', paused: Boolean(learner.paused) }} next={next} portals={portals.map((portal) => ({ id: portal.id, name: portalDisplayName(portal) }))} master={masterDesk && user.role === 'master'} /> : <p className="hint">You can look. A portal admin changes the account.</p>}
    </div>
  )
}

export async function MasterLearnerDetail(ctx: MasterCtx, id: number) {
  return (
    <Frame ctx={ctx} active="learners" title="Learner" intro="Their portal, when they joined, when they were last seen, and what to do next." testId="master-learner" primary={{ label: 'Back to learners', href: '/master/learners' }}>
      {await LearnerDetailBody({ payload: ctx.payload, user: ctx.user, learnerId: id, next: `/master/learners/${id}`, masterDesk: true })}
    </Frame>
  )
}

export async function PortalLearnerDetail(ctx: Ctx, id: number) {
  const next = `${ctx.base}/admin/teach/${id}`
  return (
    <AdminFrame ctx={ctx} active="teach" title="Learner" intro="Their portal, when they joined, when they were last seen, and what to do next." testId="portal-learner" primary={{ label: 'Back to learners', href: `${ctx.base}/admin/teach` }}>
      {await LearnerDetailBody({ payload: ctx.payload, user: ctx.user, learnerId: id, next, masterDesk: false })}
    </AdminFrame>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

async function planRows(payload: Payload, where?: Parameters<typeof rows>[2]) {
  const [plans, portals, people] = await Promise.all([
    rows(payload, 'schedules', where, { sort: '-createdAt', limit: 200 }),
    rows(payload, 'portals', undefined, { sort: 'name', limit: 100 }),
    rows(payload, 'users', { role: { equals: 'learner' } }, { limit: 500, sort: 'name' }),
  ])
  return { plans, portals, people }
}

function PlanTable({
  plans,
  portals,
  people,
  hrefFor,
  pickable,
  emptyHref,
}: {
  plans: { id: number; name?: unknown; portal?: unknown; learners?: unknown; owner?: unknown; startDate?: unknown; endDate?: unknown; slots?: unknown }[]
  portals: { id: number; name?: unknown; organisationName?: unknown }[]
  people: { id: number; name?: unknown }[]
  hrefFor: (id: number) => string
  pickable: boolean
  emptyHref: string
}) {
  const nameOf = (id: number | null) => str(people.find((person) => person.id === id)?.name)
  return (
    <div className="table-wrap">
      <table className="data people-table">
        <thead>
          <tr>
            {pickable ? <th>Pick</th> : null}
            <th>Plan</th>
            <th>Portal</th>
            <th>Learner</th>
            <th>Dates</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const href = hrefFor(plan.id)
            const portal = portals.find((row) => row.id === ref(plan.portal))
            const names = ((plan.learners as unknown[]) || []).map((item) => nameOf(ref(item))).filter(Boolean)
            const owner = nameOf(ref(plan.owner))
            const who = names.join(', ') || owner || 'Themselves'
            return (
              <ClickRow key={plan.id} href={href} testId="schedule-plan">
                {pickable ? <td data-label="Pick"><input form="plan-bulk" type="checkbox" name="plan" value={plan.id} data-testid="plan-pick" aria-label={`Select ${str(plan.name)}`} /></td> : null}
                <td data-label="Plan"><a href={href}><b>{str(plan.name)}</b></a></td>
                <td data-label="Portal" data-testid="plan-portal">{portal ? portalDisplayName(portal) : '—'}</td>
                <td data-label="Learner" data-testid="plan-learner">{who}</td>
                <td data-label="Dates">{str(plan.startDate)} to {str(plan.endDate)}</td>
              </ClickRow>
            )
          })}
          {!plans.length ? (
            <tr>
              <td colSpan={pickable ? 5 : 4}>
                <ExampleInUse desk title="Names class, four weeks" action={{ href: emptyHref, label: 'Make a plan' }}>
                  <p>Maryam · East London Mosque · Tue and Thu · 8 parts</p>
                </ExampleInUse>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

export async function MasterPlans(ctx: MasterCtx) {
  const { plans, portals, people } = await planRows(ctx.payload)
  const here = '/master/plans'
  const first = portals[0]
  return (
    <Frame ctx={ctx} active="plans" title="Study plans" intro="Plans learners and teachers have shared out across the days. Open one to change it or delete it." testId="master-plans" primary={first ? { label: 'Make a plan', href: `/p/${str(first.slug)}/admin/plans` } : undefined}>
      <section className="panel">
        <header className="light"><h2>Plans ({plans.length})</h2></header>
        <div className="body">
          <BulkBar id="plan-bulk" action="plan-bulk-delete" next={here} pick="plan" confirmHint="Type delete" buttons={[{ label: 'Delete plans', testId: 'plan-bulk-delete', danger: true }]} />
        </div>
        <PlanTable plans={plans} portals={portals} people={people} hrefFor={(id) => `/master/plans/${id}`} pickable emptyHref={here} />
      </section>
    </Frame>
  )
}

export function PortalPlanTable({ ctx, plans, people }: { ctx: Ctx; plans: { id: number; name?: unknown; portal?: unknown; learners?: unknown; owner?: unknown; startDate?: unknown; endDate?: unknown }[]; people: { id: number; name?: unknown }[] }) {
  const here = `${ctx.base}/admin/plans`
  return (
    <>
      <BulkBar id="plan-bulk" action="plan-bulk-delete" next={here} pick="plan" confirmHint="Type delete" buttons={[{ label: 'Delete plans', testId: 'plan-bulk-delete', danger: true }]} />
      <PlanTable
        plans={plans.map((plan) => ({ ...plan, portal: plan.portal || ctx.portal.id }))}
        portals={[ctx.portal]}
        people={people}
        hrefFor={(id) => `${ctx.base}/admin/plans/${id}`}
        pickable
        emptyHref="#new-plan"
      />
    </>
  )
}

async function PlanDetailBody({ payload, user, planId, next }: { payload: Payload; user: SessionUser; planId: number; next: string }) {
  const plan = (await payload.findByID({ collection: 'schedules', id: planId, overrideAccess: true, depth: 0 }).catch(() => null)) as {
    id: number
    name?: string
    portal?: unknown
    learners?: unknown
    owner?: unknown
    startDate?: string
    endDate?: string
    weekdays?: number[]
    slots?: { date?: string; title?: string }[]
  } | null
  if (!plan) return <section className="panel"><div className="body"><p>That study plan could not be found.</p></div></section>
  const portalId = ref(plan.portal)
  if (planActionRefusal(actorScope(user), portalId, 'edit')) {
    return <section className="panel"><div className="body" data-testid="plan-refused"><p>That plan is in another portal.</p></div></section>
  }
  const [portals, people] = await Promise.all([
    rows(payload, 'portals', undefined, { limit: 100 }),
    rows(payload, 'users', undefined, { limit: 500 }),
  ])
  const portal = portals.find((row) => row.id === portalId)
  const names = ((plan.learners as unknown[]) || []).map((item) => str(people.find((person) => person.id === ref(item))?.name)).filter(Boolean)
  const weekdays = plan.weekdays || []
  const slots = plan.slots || []
  return (
    <div data-testid="plan-detail" style={{ display: 'grid', gap: 18 }}>
      <section className="panel">
        <header><h2>{str(plan.name)}</h2><p data-testid="plan-portal">{portal ? portalDisplayName(portal) : 'Not in a portal'} · <span data-testid="plan-learner">{names.join(', ') || 'Themselves'}</span></p></header>
        <form className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'plan-edit', plan: plan.id, next }} />
          <label className="stack">Name<input name="name" defaultValue={str(plan.name)} required data-testid="plan-name" /></label>
          <div className="cols">
            <label className="stack">From<input type="date" name="start" defaultValue={str(plan.startDate)} required data-testid="plan-start" /></label>
            <label className="stack">Until<input type="date" name="end" defaultValue={str(plan.endDate)} required data-testid="plan-end" /></label>
          </div>
          <div className="checks">{DAYS.map((label, index) => <label className="check" key={label}><input type="checkbox" name="weekday" value={index} defaultChecked={weekdays.includes(index)} /> {label}</label>)}</div>
          <div className="actions"><button className="btn ink" type="submit" data-testid="plan-save">Save plan</button></div>
        </form>
      </section>
      <section className="panel">
        <header className="light"><h2>Days ({slots.length})</h2></header>
        <div className="body">
          {slots.map((slot, index) => <p key={index} className="hint" data-testid="schedule-slot">{slot.date}: {slot.title}</p>)}
          {!slots.length ? <ExampleInUse desk title="Tuesday · The Names" action={{ href: next, label: 'Save the days' }}><p>One talk on each ticked day</p></ExampleInUse> : null}
        </div>
      </section>
      <form className="danger-zone" action="/api/hearts" method="post">
        <Hidden fields={{ action: 'plan-delete', plan: plan.id, next: next.replace(/\/\d+$/, '') }} />
        <p>Delete this study plan. The talks stay in the library.</p>
        <button className="btn danger" type="submit" data-testid="plan-delete">Delete plan</button>
      </form>
    </div>
  )
}

export async function MasterPlanDetail(ctx: MasterCtx, id: number) {
  return (
    <Frame ctx={ctx} active="plans" title="Study plan" intro="Change the name and the days, or delete the plan." testId="master-plan" primary={{ label: 'Back to study plans', href: '/master/plans' }}>
      {await PlanDetailBody({ payload: ctx.payload, user: ctx.user, planId: id, next: `/master/plans/${id}` })}
    </Frame>
  )
}

export async function PortalPlanDetail(ctx: Ctx, id: number) {
  return (
    <AdminFrame ctx={ctx} active="plans" title="Study plan" intro="Change the name and the days, or delete the plan." testId="portal-plan" primary={{ label: 'Back to study plans', href: `${ctx.base}/admin/plans` }}>
      {await PlanDetailBody({ payload: ctx.payload, user: ctx.user, planId: id, next: `${ctx.base}/admin/plans/${id}` })}
    </AdminFrame>
  )
}

async function diaryList(payload: Payload, portalId?: number | null) {
  const where = portalId ? { portal: { equals: portalId } } : undefined
  const entries = await rows(payload, 'workbook-entries', where, { sort: '-createdAt', limit: 200, depth: 1 })
  const portals = await rows(payload, 'portals', undefined, { sort: 'name', limit: 100 })
  return { entries, portals }
}

function DiaryTable({
  entries,
  portals,
  hrefFor,
  emptyHref,
}: {
  entries: { id: number; user?: unknown; portal?: unknown; createdAt?: unknown; consent?: boolean | null; body?: unknown; answer?: unknown; teacherReply?: unknown; repliedAt?: unknown; doneAt?: unknown }[]
  portals: { id: number; name?: unknown; organisationName?: unknown }[]
  hrefFor: (id: number) => string
  emptyHref: string
}) {
  const rows = entries.map((entry) => {
    const answer = entry.answer && typeof entry.answer === 'object' ? (entry.answer as { keepPrivate?: boolean }) : null
    const person = entry.user && typeof entry.user === 'object' ? (entry.user as { name?: string }) : null
    const portal = portals.find((row) => row.id === ref(entry.portal))
    return {
      id: String(entry.id),
      at: str(entry.createdAt),
      answered: journalAnswered(entry),
      name: person?.name || 'A learner',
      href: hrefFor(entry.id),
      portal: portal ? portalDisplayName(portal) : '—',
      shared: Boolean(diaryWords(entry, answer)),
    }
  })
  return (
    <JournalList
      rows={rows}
      empty={(
        <ExampleInUse desk title="A line after Fajr" action={{ href: emptyHref, label: 'Open learners' }}>
          <p>Maryam · East London Mosque · Shared</p>
        </ExampleInUse>
      )}
    />
  )
}

export async function MasterDiaries(ctx: MasterCtx) {
  const { entries, portals } = await diaryList(ctx.payload)
  return (
    <Frame ctx={ctx} active="diaries" title={JOURNAL_LABEL.many} intro={`${JOURNAL_LABEL.one} entries across the portals. Open one to read it when the learner shared it, or to delete it.`} testId="master-diaries" primary={{ label: 'Open learners', href: '/master/learners' }}>
      <section className="panel" id="diary-list">
        <header className="light"><h2>Entries ({entries.length})</h2></header>
        <DiaryTable entries={entries} portals={portals} hrefFor={(id) => `/master/diaries/${id}`} emptyHref="/master/learners" />
      </section>
    </Frame>
  )
}

export async function PortalDiaries(ctx: Ctx) {
  const { entries, portals } = await diaryList(ctx.payload, ctx.portal.id)
  return (
    <AdminFrame ctx={ctx} active="diaries" title={JOURNAL_LABEL.many} intro={`${JOURNAL_LABEL.one} entries in this portal. Open one to read it when the learner shared it, or to delete it.`} testId="portal-diaries" primary={{ label: 'Open learners', href: `${ctx.base}/admin/teach` }}>
      <section className="panel" id="diary-list">
        <header className="light"><h2>Entries ({entries.length})</h2></header>
        <DiaryTable entries={entries} portals={portals} hrefFor={(id) => `${ctx.base}/admin/diaries/${id}`} emptyHref={`${ctx.base}/admin/teach`} />
      </section>
    </AdminFrame>
  )
}

async function DiaryDetailBody({ payload, user, entryId, back }: { payload: Payload; user: SessionUser; entryId: number; back: string }) {
  const entry = (await payload.findByID({ collection: 'workbook-entries', id: entryId, overrideAccess: true, depth: 1 }).catch(() => null)) as {
    id: number
    user?: { id?: number; name?: string } | number
    portal?: unknown
    createdAt?: string
    consent?: boolean
    body?: string
    answer?: { keepPrivate?: boolean; body?: string } | number | null
  } | null
  if (!entry) return <section className="panel"><div className="body"><p>That {JOURNAL_LABEL.one.toLowerCase()} entry could not be found.</p></div></section>
  const portalId = ref(entry.portal)
  const actor = actorScope(user)
  const samePortal = user.role === 'master' || (actor.portalId != null && actor.portalId === portalId)
  if (!samePortal) return <section className="panel"><div className="body" data-testid="diary-refused"><p>That {JOURNAL_LABEL.one.toLowerCase()} is in another portal.</p></div></section>
  const portals = await rows(payload, 'portals', undefined, { limit: 100 })
  const portal = portals.find((row) => row.id === portalId)
  const answer = entry.answer && typeof entry.answer === 'object' ? entry.answer : null
  const words = diaryWords(entry, answer)
  const person = entry.user && typeof entry.user === 'object' ? entry.user.name : 'A learner'
  const canDelete = !diaryDeleteRefusal(actor, portalId)
  return (
    <div data-testid="diary-detail" style={{ display: 'grid', gap: 18 }}>
      <section className="panel">
        <header>
          <h2>{person || 'A learner'}</h2>
          <p data-testid="diary-portal">{portal ? portalDisplayName(portal) : 'Not in a portal'} · {journalWhen(entry.createdAt) || longDate(entry.createdAt)}</p>
        </header>
        <div className="body">
          {words ? <p data-testid="diary-body">{words}</p> : <p data-testid="diary-private">This {JOURNAL_LABEL.one.toLowerCase()} is private. You can see who wrote it, which portal, and when. The words stay hidden. You can still delete it.</p>}
        </div>
      </section>
      {canDelete ? (
        <form className="danger-zone" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'diary-delete', entry: entry.id, next: back }} />
          <p>Delete this {JOURNAL_LABEL.one.toLowerCase()} entry. This cannot be undone.</p>
          <button className="btn danger" type="submit" data-testid="diary-delete">Delete this entry</button>
        </form>
      ) : <p className="hint">You can look. A portal admin can delete it.</p>}
    </div>
  )
}

export async function MasterDiaryDetail(ctx: MasterCtx, id: number) {
  return (
    <Frame ctx={ctx} active="diaries" title={`${JOURNAL_LABEL.one} entry`} intro="Read it when the learner shared it. Delete it when it should not stay." testId="master-diary" primary={{ label: `Back to ${JOURNAL_LABEL.many.toLowerCase()}`, href: '/master/diaries' }}>
      {await DiaryDetailBody({ payload: ctx.payload, user: ctx.user, entryId: id, back: '/master/diaries' })}
    </Frame>
  )
}

export async function PortalDiaryDetail(ctx: Ctx, id: number) {
  return (
    <AdminFrame ctx={ctx} active="diaries" title={`${JOURNAL_LABEL.one} entry`} intro="Read it when the learner shared it. Delete it when it should not stay." testId="portal-diary" primary={{ label: `Back to ${JOURNAL_LABEL.many.toLowerCase()}`, href: `${ctx.base}/admin/diaries` }}>
      {await DiaryDetailBody({ payload: ctx.payload, user: ctx.user, entryId: id, back: `${ctx.base}/admin/diaries` })}
    </AdminFrame>
  )
}
