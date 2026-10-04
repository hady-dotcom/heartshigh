import { defaultPlanName, plural } from '@/lib/schedule'
import { now as clockNow } from '@/lib/clock'
import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { Avatar } from '@/components/app/feed'
import { OptInLane, PrefToggle, StartAgain } from '@/components/app/me-controls'
import { EmptyState } from '@/components/app/empty'
import { KeepHearts } from '@/components/app/install-card'
import { ThemePinControl } from '@/components/theme/theme-pin'
import { Qr } from '@/components/qr'
import { now } from '@/lib/clock'
import { visibleCourseIds } from '@/server/context'
import { dayNumber, portalName } from '@/server/learner'
import { type Ctx, longDate, ref, rows, shortDate, str, unreadCount } from '../common'

/** Notices written before prompts were clipped on a word were cut mid-word at 60 characters; they read the same way now. */
function noteBody(body: string) {
  return body.replace(/^(A follow-up to ")([^"]{60})(" opens)/, (_, open: string, prompt: string, close: string) => `${open}${prompt.replace(/\s+\S*$/, '').replace(/[\s,;:]+$/, '')}…${close}`)
}

export async function MeScreen({ payload, user, portal, base, query }: Ctx) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 30 })).filter((note) => note.channel !== 'email-stub')
  const unread = notes.filter((note) => !note.read).length
  const links: [string, string, string, string][] = [
    ['path', 'Your path', 'Where a little time will help, in plain words', 'me/path'],
    ['plan', 'My study plan', 'Spread a course across the days that suit you', 'me/plan'],
    ['circle', 'Circle and nights', 'Your board, and the evenings you can come to', 'me/circle'],
    ['workbook', 'Workbook', 'Your answers and your teacher’s replies', 'garden/workbook'],
    ['settings', 'Settings', 'Night alerts, watch history and signing out', 'me/settings'],
  ]
  if (user.role !== 'learner') links.unshift(['desk', 'Portal desk', 'Courses, codes and learners', 'admin'])
  return (
    <AppFrame testId="me">
      <div className="app-scroll">
        <div className="app-head"><h1>Me</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <div className="profile">
          <Avatar name={user.name || user.email} portrait={null} size={58} />
          <span><b data-testid="me-name">{user.name || user.email}</b><small className="muted">{portalName(portal)} · day {dayNumber(user)}</small></span>
        </div>
        <ThemePinControl />
        <details className="card name-edit" data-testid="name-edit">
          <summary>Change the name we use</summary>
          <form className="form-stack" action="/api/hearts" method="post" style={{ marginTop: 10 }}>
            <Hidden fields={{ action: 'profile', next: `${base}/me` }} />
            <input className="field" name="name" defaultValue={user.name || ''} maxLength={80} data-testid="name-input" aria-label="Your name" />
            <button className="pill ink small" type="submit" data-testid="name-save">Save name</button>
          </form>
        </details>
        <KeepHearts />
        {links.map(([key, title, sub, href]) => (
          <Link key={key} className="list-link" href={`${base}/${href}`} data-testid={`me-${key}`}>
            <span className="grow">{title}<small>{sub}</small></span>›
          </Link>
        ))}
        <p className="eyebrow" style={{ marginTop: 18 }}>Your opening and this phone</p>
        <section className="card prefs" data-testid="me-prefs">
          <PrefToggle name="keepPlace" label="Keep my place" hint="Saves where you are on our side, so another phone picks up from here. Off keeps it on this phone only." checked={Boolean(user.keepPlace)} next={`${base}/me`} />
          <PrefToggle name="shareOpening" label="Share my opening answers with my mentor" hint="Private answers stay with you either way." checked={Boolean(user.shareOpening)} next={`${base}/me`} />
          <PrefToggle name="trendsOptIn" label="Add my taps to my chapter’s trends" hint="Only counts across ten or more people, never your name." checked={Boolean(user.trendsOptIn)} next={`${base}/me`} />
          <PrefToggle name="shareWithLearners" label="Share answers with other learners" hint="Off: nobody else on a video sees your answers, and you do not see theirs. On: you choose answer by answer." checked={Boolean(user.shareWithLearners)} next={`${base}/me`} />
          <PrefToggle name="haptics" label="Haptics" hint="A small buzz when you tap an answer." checked={user.haptics !== false} next={`${base}/me`} />
          <OptInLane lane="guarding-gaze" label="Private lanes: Guarding the gaze" hint="Clips on this appear only if you turn this on. It is kept on this phone and never shown to anyone." portal={portal.slug || ''} />
        </section>
        <StartAgain base={base} />
        <div className="app-head" style={{ marginTop: 18 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Notifications</h2>
          {unread ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'read-notes', next: `${base}/me` }} />
              <button className="mini-btn" type="submit" data-testid="read-notes">Mark all as read</button>
            </form>
          ) : null}
        </div>
        {notes.length ? notes.map((note) => (
          <Link key={note.id} href={str(note.href) && str(note.href) !== '/' ? str(note.href) : `${base}/me`} className={`note${note.read ? '' : ' unread'}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} data-testid="notification" data-read={note.read ? 'yes' : 'no'}>
            <b>{str(note.title)}</b>
            <p>{noteBody(str(note.body))}</p>
            <small className="muted">{shortDate(note.createdAt)}</small>
          </Link>
        )) : (
          <EmptyState testId="notes-empty" action={{ href: `${base}/garden`, label: 'Open the garden' }}>Nothing new. Replies from your teacher and new nights will show here.</EmptyState>
        )}
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function PlanScreen({ payload, user, portal, base, query }: Ctx) {
  const ids = await visibleCourseIds(payload, user)
  const courses = ids.length ? await rows(payload, 'courses', { id: { in: ids } }) : []
  const plans = (await rows(payload, 'schedules', { portal: { equals: portal.id } }, { sort: '-createdAt', limit: 50 })).filter((plan) => ref(plan.owner) === user.id || ((plan.learners as unknown[]) || []).some((item) => ref(item) === user.id))
  const today = now().toISOString().slice(0, 10)
  const later = new Date(now().getTime() + 27 * 86_400_000).toISOString().slice(0, 10)
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame testId="plan">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>My study plan</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Pick a course, the dates and the days of the week. The parts are shared out evenly, in order, so no day is left empty at the end. It is a guide only; you can always watch at your own pace.</p>
        <form className="card form-stack" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'schedule', portalSlug: portal.slug, targetType: 'course', next: `${base}/me/plan` }} />
          <label>Name<input className="field" name="name" defaultValue={defaultPlanName(clockNow())} /></label>
          <label>Course
            <select className="field" data-testid="schedule-course" name="course">{courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}</select>
          </label>
          <label>From<input className="field" data-testid="schedule-start" type="date" name="start" defaultValue={today} /></label>
          <label>Until<input className="field" data-testid="schedule-end" type="date" name="end" defaultValue={later} /></label>
          <div>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-2)' }}>Days of the week</span>
            <div className="weekdays" style={{ marginTop: 8 }}>
              {DAYS.map((label, index) => (
                <label key={label}><input data-testid={`weekday-${index}`} type="checkbox" name="weekday" value={index} /><span>{label.slice(0, 2)}</span></label>
              ))}
            </div>
          </div>
          <button className="pill purple block" data-testid="schedule-submit" type="submit">Share out the parts</button>
        </form>
        {plans.map((plan) => {
          const slots = (plan.slots as { date?: string; title?: string; lessonId?: number }[]) || []
          return (
            <section key={plan.id} data-testid="schedule-plan" style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 19, margin: '0 0 4px' }}>{str(plan.name)}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{plural(slots.length, 'part')} · {str(plan.startDate)} to {str(plan.endDate)}{ref(plan.owner) !== user.id ? ' · made by your teacher' : ''}</p>
              {slots.map((slot, index) => (
                <div className="slot" key={index} data-testid="schedule-slot">
                  <span className="date">{slot.date ? new Date(`${slot.date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' }) : ''}<small>{slot.date ? new Date(`${slot.date}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', weekday: 'short', timeZone: 'UTC' }) : ''}</small></span>
                  <span>{str(slot.title)}</span>
                </div>
              ))}
            </section>
          )
        })}
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}

export async function CircleScreen({ payload, user, portal, base, query }: Ctx) {
  const [messages, events, rsvps, checkins, unread] = await Promise.all([
    rows(payload, 'messages', { portal: { equals: portal.id } }, { depth: 1, sort: '-createdAt', limit: 30 }),
    rows(payload, 'events', { portal: { equals: portal.id } }, { sort: 'startsAt', limit: 20 }),
    rows(payload, 'rsvps', { portal: { equals: portal.id } }, { limit: 500 }),
    rows(payload, 'checkins', { and: [{ portal: { equals: portal.id } }, { user: { equals: user.id } }] }),
    unreadCount(payload, user),
  ])
  const here = `${base}/me/circle`
  return (
    <AppFrame testId="circle">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Circle</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="eyebrow" style={{ marginTop: 6 }}>Nights</p>
        {events.length ? events.map((event) => {
          const mine = rsvps.find((row) => ref(row.event) === event.id && ref(row.user) === user.id)
          const coming = rsvps.filter((row) => ref(row.event) === event.id).length
          const inside = checkins.some((row) => ref(row.event) === event.id)
          return (
            <article className="card" key={event.id} data-testid="event">
              <h3>{str(event.title)}</h3>
              <p>{longDate(str(event.startsAt))}{event.place ? ` · ${str(event.place)}` : ''}</p>
              {event.note ? <p style={{ marginTop: 6 }}>{str(event.note)}</p> : null}
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{coming} coming</p>
              {mine ? (
                <div className="ticket" data-testid="ticket" data-kind={str(mine.ticketKind)}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{mine.ticketKind === 'earned' ? 'Your ticket' : 'Your place is held'}</p>
                  <div className="code" data-testid="ticket-code">{str(mine.ticket)}</div>
                  <div style={{ display: 'grid', placeItems: 'center', margin: '10px 0' }}><Qr value={str(mine.ticket)} testId="ticket-qr" /></div>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>{mine.ticketKind === 'earned' ? 'You watched a part this week, so you can check yourself in at the door.' : 'Watch one part before the night and your ticket is yours. Until then, a teacher will welcome you in at the door.'}</p>
                  {inside ? <p className="consent-chip" style={{ marginTop: 10 }} data-testid="checked-in">You are checked in</p> : (
                    <form action="/api/hearts" method="post" style={{ marginTop: 10 }}>
                      <Hidden fields={{ action: 'checkin', event: event.id, next: here }} />
                      <button className="pill teal small" type="submit" data-testid="checkin">I&apos;m here</button>
                    </form>
                  )}
                </div>
              ) : (
                <form action="/api/hearts" method="post" style={{ marginTop: 10 }}>
                  <Hidden fields={{ action: 'rsvp', event: event.id, next: here }} />
                  <button className="pill gold small" type="submit" data-testid="rsvp">I&apos;ll come</button>
                </form>
              )}
            </article>
          )
        }) : <p className="muted">No nights are planned yet.</p>}
        <p className="eyebrow">Board</p>
        <form className="card form-stack" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'board', next: here }} />
          <textarea className="field" data-testid="board-body" name="body" rows={2} placeholder="A note for everyone in your circle" required />
          <button className="pill ink small" data-testid="board-submit" type="submit">Post</button>
        </form>
        {messages.map((message) => (
          <div className="note" key={message.id} data-testid="board-note">
            <b>{(message.author as { name?: string } | null)?.name || 'Someone'}</b>
            <p>{str(message.body)}</p>
          </div>
        ))}
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}

export async function SettingsScreen({ payload, user, portal, base, query }: Ctx) {
  const unread = await unreadCount(payload, user)
  const here = `${base}/me/settings`
  return (
    <AppFrame testId="settings">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Settings</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <form className="card form-stack" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'night-alerts', next: here }} />
          <label className="toggle" style={{ marginTop: 0 }}><input type="checkbox" name="nightAlerts" defaultChecked={Boolean(user.nightAlerts)} data-testid="night-alerts" /> Tell me when a new night opens</label>
          <button className="pill outline small" type="submit" data-testid="night-alerts-save">Save</button>
        </form>
        <form className="card form-stack" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'watch-opt-in', next: here }} />
          <label className="toggle" style={{ marginTop: 0 }}><input data-testid="share-watch" type="checkbox" name="shareWatch" defaultChecked={Boolean(user.shareWatch)} /> Share my detailed watch history with my teachers</label>
          <p className="muted" style={{ fontSize: 13 }}>{portal.watchHistoryOptIn ? 'Your portal has asked for this. It is off unless you turn it on.' : 'Off unless you turn it on. Your teachers only see which parts you finished.'}</p>
          <button className="pill outline small" type="submit" data-testid="share-watch-save">Save</button>
        </form>
        <section className="card">
          <h3>On this device</h3>
          <p>The speakers you follow, and the clips you like or save, are kept on this phone only.</p>
        </section>
        <form action="/api/hearts" method="post" style={{ marginTop: 14 }}>
          <Hidden fields={{ action: 'logout' }} />
          <button className="pill outline block" type="submit" data-testid="logout">Sign out</button>
        </form>
      </div>
      <TabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}
