import Link from 'next/link'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { WeekScreen } from '@/screens/app/week'
import { Avatar } from '@/components/app/feed'
import { OptInLane, PrefToggle, StartAgain } from '@/components/app/me-controls'
import { EmptyState } from '@/components/app/empty'
import { KeepHearts } from '@/components/app/install-card'
import { ThemePinControl } from '@/components/theme/theme-pin'
import { SavedList, SavedToast } from '@/components/app/saved-list'
import { Qr } from '@/components/qr'
import { dayNumber, portalName } from '@/server/learner'
import { featureOn } from '@/lib/features'
import { type Ctx, longDate, ref, rows, shortDate, str, unreadCount } from '../common'
import { ConfirmStrip } from '@/components/app/confirm-strip'
import { PageHelp } from '@/components/app/page-help'
import { DeleteAccount } from '@/components/app/delete-account'
import { deleteDueAt, isEmailConfirmed } from '@/lib/account-rules'
import { britishPortalTime, portalTimeZone } from '@/lib/zone-time'
import { KIND_LABEL, NOTIFY_KINDS, parsePrefs } from '@/lib/notify-prefs'
import { now } from '@/lib/clock'

/** Notices written before prompts were clipped on a word were cut mid-word at 60 characters; they read the same way now. */
function noteBody(body: string) {
  return body.replace(/^(A follow-up to ")([^"]{60})(" opens)/, (_, open: string, prompt: string, close: string) => `${open}${prompt.replace(/\s+\S*$/, '').replace(/[\s,;:]+$/, '')}…${close}`)
}

export async function MeScreen({ payload, user, portal, base, query }: Ctx) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 30 })).filter((note) => note.channel !== 'email-stub' && note.channel !== 'think')
  const unread = notes.filter((note) => !note.read).length
  const links: [string, string, string, string][] = [
    ...(featureOn(portal, 'compass') ? [['path', 'Your path', 'Where a little time will help, in plain words', 'me/path'] as [string, string, string, string]] : []),
    ...(featureOn(portal, 'planner') ? [['plan', 'My week', 'Spread a course across the days that suit you', 'week'] as [string, string, string, string]] : []),
    ['circle', featureOn(portal, 'gather') ? 'Circle and nights' : 'Circle', featureOn(portal, 'gather') ? 'Your board, and the evenings you can come to' : 'Your board', 'me/circle'],
    ...(featureOn(portal, 'workbook') ? [['workbook', 'Workbook', 'Your answers and your teacher’s replies', 'garden/workbook'] as [string, string, string, string]] : []),
    ['settings', 'Settings', 'Night alerts, watch history and signing out', 'me/settings'],
    ['help', 'Get help', 'Something broken, a learning question, or something worrying', 'me/help'],
  ]
  if (user.role !== 'learner') links.unshift(['desk', 'Portal desk', 'Courses, codes and learners', 'admin'])
  return (
    <AppFrame testId="me">
      <div className="app-scroll">
        <div className="app-head"><h1>Me</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <div className="profile">
          <Avatar name={user.name || user.email} portrait={null} size={58} />
          <span><b data-testid="me-name" data-user-id={user.id}>{user.name || user.email}</b><small className="muted">{portalName(portal)} · day {dayNumber(user)}</small></span>
        </div>
        <ThemePinControl />
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
        <p className="eyebrow" style={{ marginTop: 18 }}>Your opening and this phone</p>
        <section className="card prefs" data-testid="me-prefs">
          <PrefToggle name="keepPlace" label="Keep my place" hint="Saves where you are on our side, so another phone picks up from here. Off keeps it on this phone only." checked={Boolean(user.keepPlace)} next={`${base}/me`} />
          <PrefToggle name="shareOpening" label="Share my opening answers with my mentor" hint="Private answers stay with you either way." checked={Boolean(user.shareOpening)} next={`${base}/me`} />
          <PrefToggle name="trendsOptIn" label="Add my taps to my chapter’s trends" hint="Only counts across ten or more people, never your name." checked={Boolean(user.trendsOptIn)} next={`${base}/me`} />
          <PrefToggle name="shareWithLearners" label="Share answers with other learners" hint="Off: nobody else on a video sees your answers. You still see what others chose to share, after you answer. On: you choose answer by answer." checked={Boolean(user.shareWithLearners)} next={`${base}/me`} />
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
          <EmptyState testId="notes-empty" action={featureOn(portal, 'garden') ? { href: `${base}/garden`, label: 'Open the garden' } : { href: base, label: 'Back home' }}>Nothing new. Replies from your teacher and new nights will show here.</EmptyState>
        )}
      </div>
      <TabBar base={base} active="me" portal={portal} unread={unread} />
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
      <TabBar base={base} active="me" portal={portal} unread={unread} />
    </AppFrame>
  )
}

export async function SettingsScreen({ payload, user, portal, base, query }: Ctx) {
  const unread = await unreadCount(payload, user)
  const here = `${base}/me/settings`
  const prefs = parsePrefs(user.notificationPrefs, user.nightAlerts)
  const deletePage = query.account === 'delete'
  const dataPage = query.account === 'data'
  const zone = portalTimeZone(portal)
  const deleteWhen = britishPortalTime(deleteDueAt(user.deletionRequestedAt || now()), zone)
  return (
    <AppFrame testId="settings">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>Settings <PageHelp topic="settings" /></h1></div>
        <Flash error={query.error} notice={query.notice} />
        {!isEmailConfirmed(user) ? <ConfirmStrip next={here} required={Boolean(portal.requireEmailConfirm)} /> : null}
        {deletePage ? (
          <section className="card" data-testid="delete-account">
            <h3>Delete my account <PageHelp topic="deleteAccount" /></h3>
            <p>We will delete your name, email, answers, plans and uploads after 14 days. That is <time data-testid="delete-when">{deleteWhen}</time>. Anonymous counts stay, so a course can still say how many people finished it. Signing in before then cancels this.</p>
            <form className="form-stack" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'request-delete', next: here, confirm: 'delete' }} />
              <button className="pill outline block" type="submit" data-testid="delete-account-submit">Delete my account</button>
            </form>
          </section>
        ) : null}
        {dataPage ? (
          <section className="card" data-testid="download-data">
            <h3>Download my data <PageHelp topic="downloadData" /></h3>
            <p>A zip of your profile, answers and uploads. If email is off, the file downloads here.</p>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'download-data', next: here }} />
              <button className="pill gold small" type="submit" data-testid="download-data-submit">Download my data</button>
            </form>
          </section>
        ) : null}
        <section className="card form-stack" data-testid="change-password">
          <h3>Change password <PageHelp topic="changePassword" /></h3>
          <form className="form-stack" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'change-password', next: here }} />
            <label>Current password<input className="field" data-testid="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label>New password<input className="field" data-testid="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
            <label>New password again<input className="field" data-testid="new-password-again" name="passwordAgain" type="password" minLength={8} autoComplete="new-password" required /></label>
            <button className="pill ink small" type="submit" data-testid="change-password-submit">Save password</button>
          </form>
        </section>
        <section className="card form-stack" data-testid="change-email">
          <h3>Change email</h3>
          <p className="muted" style={{ fontSize: 13 }}>We write to the new address. The change happens only after you confirm it. We also tell the old address.</p>
          <form className="form-stack" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'change-email', next: here }} />
            <label>New email<input className="field" data-testid="change-email-input" name="email" type="email" defaultValue={user.pendingEmail || ''} required /></label>
            <button className="pill outline small" type="submit" data-testid="change-email-submit">Send confirmation</button>
          </form>
        </section>
        <section className="card" data-testid="notify-prefs">
          <h3>Notifications <PageHelp topic="notifications" /></h3>
          <form className="form-stack" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'save-notify-prefs', next: here }} />
            {NOTIFY_KINDS.map((kind) => (
              <label key={kind} className="stack">{KIND_LABEL[kind]}
                <select className="field" name={`pref-${kind}`} defaultValue={prefs.channels[kind]} data-testid={`pref-${kind}`}>
                  <option value="in-app">In the app</option>
                  <option value="email">Email</option>
                  <option value="off">Off</option>
                </select>
              </label>
            ))}
            <label className="toggle"><input type="checkbox" name="quietNight" defaultChecked={prefs.quietNight} data-testid="quiet-night" /> Quiet at night (no emails 22:00 to 07:00 in the portal&apos;s time zone)</label>
            <label className="toggle"><input type="checkbox" name="emailNews" defaultChecked={Boolean(prefs.emailNewsAt)} data-testid="email-news" /> I am happy to receive these emails (not required to use HEARTS)</label>
            <button className="pill outline small" type="submit" data-testid="notify-prefs-save">Save</button>
          </form>
        </section>
        <p><Link href={`${here}?account=data`} data-testid="download-data-link">Download my data</Link></p>
        <p><Link href={`${here}?account=delete`} data-testid="delete-account-link">Delete my account</Link></p>
        {featureOn(portal, 'gather') ? (
        <form className="card form-stack" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'night-alerts', next: here }} />
          <label className="toggle" style={{ marginTop: 0 }}><input type="checkbox" name="nightAlerts" defaultChecked={Boolean(user.nightAlerts)} data-testid="night-alerts" /> Tell me when a new night opens</label>
          <button className="pill outline small" type="submit" data-testid="night-alerts-save">Save</button>
        </form>
        ) : null}
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
        <section className="card" data-testid="settings-legal">
          <h3>How we look after each other</h3>
          <p>What we keep, the short rules, and how we speak here.</p>
          <p><Link href={`${base}/privacy`}>Privacy</Link> · <Link href={`${base}/terms`}>Terms</Link> · <Link href={`${base}/guidelines`}>How we speak</Link></p>
          <p><Link href={`${base}/me/help`} data-testid="settings-help">Get help</Link></p>
        </section>
        <form action="/api/hearts" method="post" style={{ marginTop: 14 }}>
          <Hidden fields={{ action: 'logout' }} />
          <button className="pill outline block" type="submit" data-testid="logout">Sign out</button>
        </form>
        {!deletePage ? <DeleteAccount name={user.name || user.email} next={`${base}/me/settings`} /> : null}
      </div>
      <TabBar base={base} active="me" portal={portal} unread={unread} />
    </AppFrame>
  )
}
