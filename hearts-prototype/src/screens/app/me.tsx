import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { WeekScreen } from '@/screens/app/week'
import { Avatar } from '@/components/app/feed'
import { OptInLane, PrefToggle, SoundOnToggle, StartAgain } from '@/components/app/me-controls'
import { SavedList, SavedToast } from '@/components/app/saved-list'
import { EmptyState } from '@/components/app/empty'
import { KeepHearts } from '@/components/app/install-card'
import { Qr } from '@/components/qr'
import { dayNumber, portalName } from '@/server/learner'
import { shapedFor } from '@/server/missions'
import { featureOn } from '@/lib/features'
import { type Ctx, longDate, ref, rows, shortDate, str, unreadCount } from '../common'

/** Notices written before prompts were clipped on a word were cut mid-word at 60 characters; they read the same way now. */
function noteBody(body: string) {
  return body.replace(/^(A follow-up to ")([^"]{60})(" opens)/, (_, open: string, prompt: string, close: string) => `${open}${prompt.replace(/\s+\S*$/, '').replace(/[\s,;:]+$/, '')}…${close}`)
}

export async function MeScreen({ payload, user, portal, base, query }: Ctx) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 30 })).filter((note) => note.channel !== 'email-stub' && note.channel !== 'think')
  const shaped = await shapedFor(payload, user.id)
  const unread = notes.filter((note) => !note.read).length
  const links: [string, string, string, string][] = [
    ...(featureOn(portal, 'planner') ? [['plan', 'My week', 'Spread a course across the days that suit you', 'week'] as [string, string, string, string]] : []),
    ['saved', 'Saved', 'Clips you kept from the feed', 'me/saved'],
    ...(featureOn(portal, 'workbook') ? [['workbook', 'Workbook', 'Your answers and your teacher’s replies', 'garden/workbook'] as [string, string, string, string]] : []),
    ...(featureOn(portal, 'compass') ? [['path', 'Where to grow next', 'Plain words, only when a real talk or answer backs them', 'me/path'] as [string, string, string, string]] : []),
    ...(featureOn(portal, 'missions') ? [['shaped', 'Things you helped shape', 'Missions you joined, and what we decided', 'me/shaped'] as [string, string, string, string]] : []),
    ['help', 'Ask for help', 'Write to the team here. You do not need an email.', 'me/help'],
    ['settings', 'Settings', 'Night alerts, watch history and logging out', 'me/settings'],
  ]
  if (user.role !== 'learner') links.unshift(['desk', 'Portal desk', 'Courses, codes and learners', 'admin'])
  return (
    <AppFrame testId="me">
      <div className="app-scroll">
        <div className="app-head"><h1>Me</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <div className="profile">
          <Avatar name={user.name || user.email} portrait={null} size={58} />
          <span><b data-testid="me-name">{user.name || user.email}</b><small className="muted">{portalName(portal)} · day <span data-testid="day-number">{dayNumber(user)}</span></small></span>
        </div>
        <SavedToast />
        <p className="eyebrow" id="saved" style={{ marginTop: 18 }}>Saved</p>
        <SavedList base={base} />
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
        <form action="/api/hearts" method="post" style={{ marginTop: 16 }}>
          <Hidden fields={{ action: 'logout' }} />
          <button className="pill outline block" type="submit" data-testid="logout">Log out</button>
        </form>
        <p className="eyebrow" style={{ marginTop: 18 }}>Circle and nights</p>
        <Link className="list-link" href={`${base}/me/circle`} data-testid="me-circle">
          <span className="grow">Circle and nights<small>Your board, and the evenings you can come to</small></span>›
        </Link>
        <p className="eyebrow" style={{ marginTop: 18 }}>Your opening and this phone</p>
        <section className="card prefs" data-testid="me-prefs">
          <PrefToggle name="keepPlace" label="Keep my place" hint="Saves where you are on our side, so another phone picks up from here. Off keeps it on this phone only." checked={Boolean(user.keepPlace)} next={`${base}/me`} />
          <PrefToggle name="shareOpening" label="Share my opening answers with my mentor" hint="Private answers stay with you either way." checked={Boolean(user.shareOpening)} next={`${base}/me`} />
          <PrefToggle name="trendsOptIn" label="Add my taps to my chapter’s trends" hint="Only counts across ten or more people, never your name." checked={Boolean(user.trendsOptIn)} next={`${base}/me`} />
          <PrefToggle name="shareWithLearners" label="Share answers with other learners" hint="Off: nobody else on a video sees your answers. You still see what others chose to share, after you answer. On: you choose answer by answer." checked={Boolean(user.shareWithLearners)} next={`${base}/me`} />
          <PrefToggle name="haptics" label="Haptics" hint="A small buzz when you tap an answer." checked={user.haptics !== false} next={`${base}/me`} />
          <OptInLane lane="guarding-gaze" label="Private lanes: Guarding the gaze" hint="Clips on this appear only if you turn this on. It is kept on this phone and never shown to anyone." portal={portal.slug || ''} />
        </section>
        {shaped.length ? (
          <section data-testid="shaped-list">
            <p className="eyebrow">Things you helped shape</p>
            {shaped.map((item) => (
              <Link key={item.id} className="list-link" href={`${base}/me/shaped`} data-testid="shaped-item">
                <span className="grow">{item.title}<small>You helped decide: {item.result}</small></span>›
              </Link>
            ))}
          </section>
        ) : null}
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
          <EmptyState testId="notes-empty" action={featureOn(portal, 'garden') ? { href: `${base}/garden`, label: 'Open the garden' } : { href: base, label: 'Back home' }}>Nothing new. Replies from your teacher and new nights will show here.</EmptyState>
        )}
        <p className="eyebrow" style={{ marginTop: 22 }}>Opening questions</p>
        <StartAgain base={base} />
      </div>
      <LearnerTabBar base={base} active="me" portal={portal} unread={unread} />
    </AppFrame>
  )
}

export async function PlanScreen(ctx: Ctx) {
  return WeekScreen(ctx)
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
        {featureOn(portal, 'gather') ? <><p className="eyebrow" style={{ marginTop: 6 }}>Nights</p>
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
        }) : <p className="muted">No nights are planned yet.</p>}</> : null}
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
      <LearnerTabBar base={base} active="me" portal={portal} unread={unread} />
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
        <p className="eyebrow">Sound and display</p>
        <section className="card prefs" data-testid="settings-sound">
          <PrefToggle name="haptics" label="Haptics" hint="A small buzz when you tap an answer." checked={user.haptics !== false} next={here} />
          <SoundOnToggle />
        </section>
        <p className="eyebrow">Privacy</p>
        <section className="card prefs" data-testid="me-prefs">
          <PrefToggle name="keepPlace" label="Start where I left off" hint="Open the feed on the last clip you watched, including on another phone." checked={Boolean(user.keepPlace)} next={here} />
          <PrefToggle name="shareOpening" label="Share my opening answers with my mentor" hint="Private answers stay with you either way." checked={Boolean(user.shareOpening)} next={here} />
          <PrefToggle name="trendsOptIn" label="Help my circle see what is popular" hint="Only counts across ten or more people, never your name." checked={Boolean(user.trendsOptIn)} next={here} />
          <PrefToggle name="shareWatch" label="Share my detailed watch history with my teachers" hint={portal.watchHistoryOptIn ? 'Your portal has asked for this. It is off unless you turn it on.' : 'Off unless you turn it on. Your teachers only see which parts you finished.'} checked={Boolean(user.shareWatch)} next={here} />
          <OptInLane lane="guarding-gaze" label="Private lanes: Guarding the gaze" hint="Clips on this appear only if you turn this on. It is kept on this phone and never shown to anyone." portal={portal.slug || ''} />
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Answers in a talk show to other learners as initials only. There is no rating. Your teacher still sees what you offer them.</p>
        </section>
        <p className="eyebrow">Notifications</p>
        <section className="card prefs">
          <PrefToggle name="nightAlerts" label="Tell me when a new night opens" checked={Boolean(user.nightAlerts)} next={here} />
        </section>
        <p className="eyebrow">Account</p>
        <section className="card">
          <h3>Privacy and this phone</h3>
          <p>The speakers you follow, and the clips you save, are kept on this phone only.</p>
        </section>
        <KeepHearts />
        <StartAgain base={base} />
        <form action="/api/hearts" method="post" style={{ marginTop: 14 }}>
          <Hidden fields={{ action: 'logout' }} />
          <button className="pill outline block" type="submit" data-testid="logout">Log out</button>
        </form>
      </div>
      <LearnerTabBar base={base} active="me" portal={portal} unread={unread} />
    </AppFrame>
  )
}

export async function SavedScreen({ payload, user, base }: Ctx) {
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame testId="saved">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Saved</h1></div>
        <p className="lead">Clips you kept from the feed. They stay on this phone.</p>
        <SavedList base={base} />
      </div>
      <LearnerTabBar base={base} active="me" unread={unread} />
    </AppFrame>
  )
}
