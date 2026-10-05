import { defaultPlanName } from '@/lib/schedule'
import { now as clockNow } from '@/lib/clock'
import { parseWeekdays } from '@/lib/week'
import { dateKey, formatOnTime, onTimeProgress, ON_TIME_HINT, type PlanSlot } from '@/lib/on-time'
import { ViewAsButton } from '@/components/desk/view-as-button'
import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { EvidencePlayer } from '@/components/desk/tools'
import { now } from '@/lib/clock'
import { visibleCourseIds } from '@/server/context'
import { dayNumber } from '@/server/learner'
import { type Ctx, clock, longDate, portalPeople, ref, rows, shortDate, str } from '../common'
import { AdminFrame } from './overview'

export async function TeachScreen(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const people = await portalPeople(payload, portal.id)
  const learners = people.filter((person) => person.role === 'learner')
  const [entries, answers, completions, notes, watches, courseIds, plans] = await Promise.all([
    rows(payload, 'workbook-entries', { portal: { equals: portal.id } }, { depth: 1, sort: '-createdAt' }),
    rows(payload, 'answers', { portal: { equals: portal.id } }, { depth: 1, sort: '-createdAt', limit: 500 }),
    rows(payload, 'completions', { portal: { equals: portal.id } }, { limit: 2000 }),
    rows(payload, 'feedback-notes', { portal: { equals: portal.id } }, { depth: 1, sort: 'second' }),
    rows(payload, 'watch-sessions', { portal: { equals: portal.id } }, { depth: 1, sort: '-createdAt', limit: 50 }),
    visibleCourseIds(payload, user),
    rows(payload, 'schedules', { portal: { equals: portal.id } }, { limit: 200 }),
  ])
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }, { sort: 'title' }) : []
  const shared = entries.filter((entry) => entry.consent)
  const kept = entries.length - shared.length
  const evidence = answers.filter((answer) => answer.video || answer.audio)
  const picked = evidence.find((answer) => answer.id === Number(query.answer)) || evidence[0]
  const here = `${base}/admin/teach`
  const today = dateKey(now())
  const slotsFor = (learnerId: number): PlanSlot[] => {
    const slots: PlanSlot[] = []
    for (const plan of plans) {
      const members = ((plan.learners as unknown[]) || []).map((item) => ref(item))
      if (!members.includes(learnerId)) continue
      for (const slot of (plan.slots as { date?: string; lessonId?: number }[]) || []) {
        if (slot.lessonId && slot.date) slots.push({ lessonId: Number(slot.lessonId), date: String(slot.date) })
      }
    }
    return slots
  }
  return (
    <AdminFrame ctx={ctx} active="teach" title="Teach" intro="See how each learner is getting on, reply to what they have shared, and leave notes on their recordings." testId="admin-teach">
      <section className="panel" style={{ marginBottom: 18 }}>
        <header className="light"><h2>Learners ({learners.length})</h2></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Name</th><th>E-mail</th><th className="num">Day</th><th className="num">Parts watched</th><th className="num"><abbr className="tip" title={ON_TIME_HINT} data-testid="on-time-header">On time</abbr></th><th className="num">Answers</th><th>Give a course</th><th /></tr></thead>
            <tbody>
              {learners.map((learner) => {
                const done = completions.filter((row) => ref(row.user) === learner.id)
                const progress = onTimeProgress(slotsFor(learner.id), done.map((row) => ({ lessonId: ref(row.lesson) || 0, watchedOn: dateKey(row.watchedAt || row.createdAt) })), today)
                const onTime = formatOnTime(progress)
                return (
                  <tr key={learner.id} data-testid="learner-row">
                    <td><b>{str(learner.name)}</b>{learner.audience && learner.audience !== 'learner' ? <div className="hint">{str(learner.audience)}</div> : null}</td>
                    <td className="email-cell"><span title={str(learner.email)} data-testid="learner-email">{str(learner.email)}</span></td>
                    <td className="num">{dayNumber(learner as never)}</td>
                    <td className="num" data-testid="learner-progress">{done.length}</td>
                    <td className="num" data-testid="on-time" title={progress.planned ? ON_TIME_HINT : 'No study plan yet'}>{onTime}</td>
                    <td className="num" data-testid="learner-answers">{answers.filter((row) => ref(row.user) === learner.id).length}</td>
                    <td>
                      <form action="/api/hearts" method="post" style={{ display: 'flex', gap: 8 }}>
                        <Hidden fields={{ action: 'grant', learner: learner.id, next: here }} />
                        <select name="course" style={{ minWidth: 0, width: 170 }}>{courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}</select>
                        <button className="btn small" data-testid="grant-course" type="submit">Give</button>
                      </form>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'start' }}>
                        <a className="btn ghost small" href={`/api/workbook/${learner.id}?format=csv`} data-testid="workbook-csv">Workbook</a>
                        {user.role !== 'teacher' ? <ViewAsButton targetId={learner.id} name={str(learner.name) || 'this learner'} landing={`${base}`} /> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!learners.length ? <tr><td colSpan={8} className="empty">Nobody has joined with a learner code yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', alignItems: 'start' }}>
        <section className="panel" data-testid="workbook-inbox">
          <header><div><h2>Workbook entries shared with you ({shared.length})</h2><p>{kept} kept private by their writers and not shown here</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 14 }}>
            {shared.map((entry) => {
              const answer = answers.find((row) => row.id === ref(entry.answer))
              const prompt = (answer?.point as { prompt?: string } | undefined)?.prompt
              return (
                <article key={entry.id} className="lib-card" data-testid="workbook-review">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{(entry.user as { name?: string } | null)?.name || 'A learner'}</b><span className="hint">{shortDate(entry.createdAt)}</span></div>
                  {prompt ? <p className="hint" style={{ margin: 0 }}>Question: {prompt}</p> : null}
                  {(answer?.point as { kind?: string } | undefined)?.kind === 'task' ? <p className="badge" data-testid="activation-task">Activation task</p> : null}
                  <p style={{ fontSize: 15, color: 'var(--ink)' }}>{str(entry.body) || 'A photo or recording'}</p>
                  {entry.teacherReply ? <p className="count-tile" style={{ display: 'block', background: 'var(--mint)' }} data-testid="teacher-reply">Your reply: {str(entry.teacherReply)}</p> : null}
                  <form className="form" action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'reply', entry: entry.id, href: `${base}/garden/workbook`, next: here }} />
                    <textarea data-testid="reply-text" name="reply" placeholder="Write a reply. They will see it in their workbook." required />
                    <div className="actions"><button className="btn ink small" data-testid="reply-submit" type="submit">{entry.teacherReply ? 'Send another reply' : 'Send reply'}</button></div>
                  </form>
                </article>
              )
            })}
            {!shared.length ? <p className="empty">Nothing shared yet. Learners choose, answer by answer, whether you can read it.</p> : null}
          </div>
        </section>

        <section className="panel" data-testid="evidence">
          <header><div><h2>Recordings to give feedback on ({evidence.length})</h2><p>Pause at a moment and add a note; the learner sees it on their timeline</p></div></header>
          <div className="body">
            {picked ? (
              <div className="evidence">
                <EvidencePlayer
                  src={((picked.video || picked.audio) as { url?: string } | null)?.url || null}
                  kind={picked.video ? 'video' : 'audio'}
                  answerId={picked.id}
                  next={`${here}?answer=${picked.id}`}
                  href={`${base}/course/${ref((picked.lesson as { course?: unknown } | null)?.course) || ''}?part=${ref(picked.lesson) || ''}`}
                  marks={notes.filter((note) => ref(note.answer) === picked.id).map((note) => ({ id: note.id, second: Number(note.second || 0), body: str(note.body), author: (note.author as { name?: string } | null)?.name || 'Teacher' }))}
                />
                <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  <b>{(picked.user as { name?: string } | null)?.name}</b>
                  <p className="hint" style={{ margin: 0 }}>{(picked.point as { prompt?: string } | null)?.prompt}</p>
                  {picked.body ? <p style={{ margin: 0 }}>{str(picked.body)}</p> : null}
                  <div className="hint" style={{ marginTop: 8 }}>Other recordings</div>
                  {evidence.map((answer) => (
                    <Link key={answer.id} className={`btn ${answer.id === picked.id ? 'ink' : 'ghost'} small`} href={`${here}?answer=${answer.id}`}>{(answer.user as { name?: string } | null)?.name || 'Learner'} · {shortDate(answer.createdAt)}</Link>
                  ))}
                </div>
              </div>
            ) : <p className="empty">No recordings yet. When a learner answers with a video or a voice note, it appears here.</p>}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Detailed watch history</h2><span className="hint">Only for learners who turned it on</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Learner</th><th>Film</th><th className="num">Watched up to</th><th>When</th></tr></thead>
            <tbody>
              {watches.map((row) => (
                <tr key={row.id} data-testid="watch-session"><td>{(row.user as { name?: string } | null)?.name}</td><td>{(row.lesson as { title?: string } | null)?.title}</td><td className="num">{clock(Number(row.seconds || 0))}</td><td>{shortDate(row.createdAt)}</td></tr>
              ))}
              {!watches.length ? <tr><td colSpan={4} className="empty">Nothing here unless a learner chooses to share it.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminFrame>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function PlansScreen(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const [people, plans, courseIds] = await Promise.all([
    portalPeople(payload, portal.id),
    rows(payload, 'schedules', { portal: { equals: portal.id } }, { sort: '-createdAt', limit: 100 }),
    visibleCourseIds(payload, user),
  ])
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }, { sort: 'title' }) : []
  const learners = people.filter((person) => person.role === 'learner')
  const today = now().toISOString().slice(0, 10)
  const later = new Date(now().getTime() + 27 * 86_400_000).toISOString().slice(0, 10)
  const start = String(query.start || today)
  const end = String(query.end || later)
  const weekdays = parseWeekdays(query.days)
  const selected = Number(query.course) || courses[0]?.id || 0
  const keptLearners = new Set(String(query.learner || '').split(',').map(Number).filter(Boolean))
  const here = `${base}/admin/plans`
  return (
    <AdminFrame ctx={ctx} active="plans" title="Study plans" intro="Share a course out across chosen days for one learner or a whole group. The parts stay in order and are spread evenly, so no day is left empty at the end. Learners can still watch at their own pace." testId="admin-plans">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(340px, 1fr) minmax(0, 1.6fr)', alignItems: 'start' }}>
        <section className="panel">
          <header><div><h2>New plan</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'schedule', portalSlug: portal.slug, targetType: 'course', next: here }} />
            <label className="stack">Name<input type="text" name="name" defaultValue={defaultPlanName(clockNow())} /></label>
            <label className="stack">Course<select data-testid="schedule-course" name="course" defaultValue={selected || undefined}>{courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}</select></label>
            <div className="cols">
              <label className="stack">From<input data-testid="schedule-start" type="date" name="start" defaultValue={start} /></label>
              <label className="stack">Until<input data-testid="schedule-end" type="date" name="end" defaultValue={end} /></label>
            </div>
            <div className="checks">{DAYS.map((label, index) => <label className="check" key={label}><input data-testid={`weekday-${index}`} type="checkbox" name="weekday" value={index} defaultChecked={weekdays.includes(index)} /> {label}</label>)}</div>
            <div className="hint">For</div>
            <div className="checks" style={{ flexDirection: 'column' }}>{learners.map((learner) => <label className="check" key={learner.id}><input type="checkbox" name="learner" value={learner.id} data-testid="plan-learner" defaultChecked={keptLearners.has(learner.id)} /> {str(learner.name)}</label>)}</div>
            <div className="actions"><button className="btn ink" data-testid="schedule-submit" type="submit">Share out the parts</button></div>
          </form>
        </section>
        <section className="panel">
          <header className="light"><h2>Plans ({plans.length})</h2></header>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Plan</th><th>For</th><th>Dates</th><th className="num">Parts</th><th>Days</th></tr></thead>
              <tbody>
                {plans.map((plan) => {
                  const slots = (plan.slots as { date?: string; title?: string }[]) || []
                  const names = ((plan.learners as unknown[]) || []).map((item) => str(people.find((person) => person.id === ref(item))?.name)).filter(Boolean)
                  return (
                    <tr key={plan.id} data-testid="schedule-plan">
                      <td><b>{str(plan.name)}</b><details><summary className="hint" style={{ cursor: 'pointer' }}>See the days</summary>{slots.map((slot, index) => <div key={index} className="hint" data-testid="schedule-slot">{slot.date}: {slot.title}</div>)}</details></td>
                      <td>{names.join(', ') || 'Themselves'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{str(plan.startDate)} to {str(plan.endDate)}</td>
                      <td className="num">{slots.length}</td>
                      <td>{((plan.weekdays as number[]) || []).map((day) => DAYS[day]).join(', ')}</td>
                    </tr>
                  )
                })}
                {!plans.length ? <tr><td colSpan={5} className="empty">No plans yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminFrame>
  )
}

export async function NightsScreen(ctx: Ctx) {
  const { payload, user, portal, base } = ctx
  const [events, rsvps, checkins, people] = await Promise.all([
    rows(payload, 'events', { portal: { equals: portal.id } }, { sort: 'startsAt' }),
    rows(payload, 'rsvps', { portal: { equals: portal.id } }, { limit: 1000 }),
    rows(payload, 'checkins', { portal: { equals: portal.id } }, { limit: 1000 }),
    portalPeople(payload, portal.id),
  ])
  const here = `${base}/admin/nights`
  const name = (id: unknown) => str(people.find((person) => person.id === ref(id))?.name) || 'Someone'
  return (
    <AdminFrame ctx={ctx} active="nights" title="Nights" intro="Evenings in person. Learners who watched a part in the last week get a ticket they can use themselves; anyone else has a place held and you welcome them in at the door." testId="admin-nights">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          {events.map((event) => {
            const going = rsvps.filter((row) => ref(row.event) === event.id)
            const inside = checkins.filter((row) => ref(row.event) === event.id)
            return (
              <section className="panel" key={event.id} data-testid="event">
                <header><div><h2>{str(event.title)}</h2><p>{longDate(str(event.startsAt))}{event.place ? ` · ${str(event.place)}` : ''}</p></div><span className="badge gold">{going.length} coming · {inside.length} here</span></header>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Name</th><th>Ticket</th><th>Kind</th><th>Arrived</th></tr></thead>
                    <tbody>
                      {going.map((row) => {
                        const arrived = inside.find((item) => ref(item.user) === ref(row.user))
                        return (
                          <tr key={row.id} data-testid="rsvp-row">
                            <td>{name(row.user)}</td>
                            <td style={{ fontFamily: 'ui-monospace, monospace' }}>{str(row.ticket)}</td>
                            <td>{row.ticketKind === 'earned' ? <span className="badge teal">Earned</span> : <span className="badge grey">Held</span>}</td>
                            <td>{arrived ? <span className="badge ink">{arrived.override ? 'Welcomed in' : 'Checked in'}</span> : <span className="hint">Not yet</span>}</td>
                          </tr>
                        )
                      })}
                      {inside.filter((item) => !going.some((row) => ref(row.user) === ref(item.user))).map((item) => (
                        <tr key={`walk-${item.id}`}><td>{name(item.user)}</td><td className="hint">No ticket</td><td><span className="badge purple">Walk-in</span></td><td><span className="badge ink">Welcomed in</span></td></tr>
                      ))}
                      {!going.length && !inside.length ? <tr><td colSpan={4} className="empty">Nobody has said they will come yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <form className="feedback-bar" action="/api/hearts" method="post" style={{ margin: '0 18px 18px' }}>
                  <Hidden fields={{ action: 'checkin', event: event.id, next: here }} />
                  <select name="learner" data-testid="checkin-learner" style={{ maxWidth: 260 }} required>
                    <option value="">Who has arrived?</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{str(person.name)}</option>)}
                  </select>
                  <label className="check"><input type="checkbox" name="override" data-testid="checkin-override" /> Let them in anyway</label>
                  <button className="btn ink small" type="submit" data-testid="staff-checkin">Check in</button>
                </form>
              </section>
            )
          })}
          {!events.length ? <section className="panel"><div className="body empty">No nights yet.</div></section> : null}
        </div>
        {user.role !== 'teacher' ? (
          <section className="panel">
            <header><div><h2>Plan a night</h2><p>People with night alerts on are told straight away</p></div></header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-event', portalSlug: portal.slug, next: here }} />
              <label className="stack">Name<input type="text" data-testid="event-title" name="title" required /></label>
              <label className="stack">Date and time<input type="datetime-local" name="startsAt" data-testid="event-starts" /></label>
              <label className="stack">Place<input type="text" name="place" /></label>
              <label className="stack">A note for people coming<textarea name="note" /></label>
              <div className="actions"><button className="btn ink" type="submit" data-testid="event-submit">Save night</button></div>
            </form>
          </section>
        ) : null}
      </div>
    </AdminFrame>
  )
}
