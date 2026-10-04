import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { CopyLink } from '@/components/app/copy-link'
import { Qr } from '@/components/qr'
import { GATHER_KINDS, KIND_LABEL, afterTalkLine, personName, publicNames, relatedGatherings, taskWantsCompany, type TaskRef } from '@/lib/gather'
import { CrossPost } from '@/components/gather/cross-post'
import { DoorArrival } from '@/components/gather/door-arrival'
import { doorLabel } from '@/lib/doors'
import { now } from '@/lib/clock'
import { loadDoors } from '@/server/doors'
import { bringLink, listGatherings, sharePack, taskMatches, type GatherCard } from '@/server/gather'
import { type Ctx, portalPeople, ref, rows, str, unreadCount } from '../common'

const AUDIENCE_OPTIONS = [
  ['all', 'Everyone'],
  ['brothers', 'Brothers'],
  ['sisters', 'Sisters'],
  ['family', 'Families'],
  ['youth', 'Youth'],
] as const

function Card({ card, href }: { card: GatherCard; href: string }) {
  return (
    <article className="gather-card" data-testid="gather-card" data-id={card.id} data-status={card.mine || 'none'}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22, lineHeight: 1.2, color: 'var(--g-heading, #0f3b3a)' }}>{card.title}</h2>
      {card.onLine ? <p className="on-line" data-testid="gather-on">{card.onLine}</p> : null}
      <p className="gather-meta" style={{ marginTop: 0 }}>
        <span>{card.when}{card.place ? ` · ${card.place}` : ''}</span>
        <span>{card.capacity > 0 ? `${card.going} of ${card.capacity} places` : `${card.going} coming`}{card.waitlist ? ` · ${card.waitlist} waiting` : ''}</span>
      </p>
      <div>
        <span className="gather-chip gold">{card.audienceLabel}</span>
        <span className="gather-chip ivy">{KIND_LABEL[card.kind as keyof typeof KIND_LABEL] || 'Circle'}</span>
        {card.mine === 'going' ? <span className="gather-chip" data-testid="rsvp-state">You’re coming</span> : null}
        {card.mine === 'maybe' ? <span className="gather-chip" data-testid="rsvp-state">Maybe</span> : null}
        {card.mine === 'waitlist' ? <span className="gather-chip" data-testid="rsvp-state">On the list</span> : null}
        {card.mine === 'cant' ? <span className="gather-chip" data-testid="rsvp-state">Can’t this time</span> : null}
      </div>
      <Link className="pill gold small" href={href} data-testid="gather-open" style={{ marginTop: 4 }}>Open</Link>
    </article>
  )
}

export async function GatherListScreen(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const [{ cards, grouped }, unread] = await Promise.all([
    listGatherings(payload, portal.id, user.id),
    unreadCount(payload, user),
  ])
  const upcoming = grouped.upcoming
  const past = grouped.past
  return (
    <AppFrame testId="gather" tone="gather">
      <div className="app-scroll gather">
        <div className="app-head"><h1>Gather</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Meetings at {portal.name}. Your masjid comes first. Say if you’re coming, and bring someone who isn’t on HEARTS yet.</p>
        {!cards.length ? <p data-testid="gather-empty">Nothing is planned yet. You can suggest one.</p> : null}
        {upcoming.map((group) => (
          <section key={group.door} className="gather-door" data-testid="gather-group">
            <h2>{group.door}</h2>
            {group.items.map((card) => <Card key={card.id} card={card} href={`${base}/gather/${card.id}`} />)}
          </section>
        ))}
        {past.length ? <p className="eyebrow">Already met</p> : null}
        {past.map((group) => (
          <section key={`past-${group.door}`} data-testid="gather-past">
            <h2 style={{ fontSize: 22 }}>{group.door}</h2>
            {group.items.map((card) => <Card key={card.id} card={card} href={`${base}/gather/${card.id}`} />)}
          </section>
        ))}
        <Link className="pill outline block" href={`${base}/gather/propose`} data-testid="gather-propose" style={{ marginTop: 8 }}>Suggest a gathering</Link>
      </div>
      <TabBar base={base} active="gather" evening unread={unread} />
    </AppFrame>
  )
}

export async function GatherDetailScreen(ctx: Ctx, id: number) {
  const { payload, user, portal, base, origin, query } = ctx
  const { cards, rsvps, checkins, rows: docs } = await listGatherings(payload, portal.id, user.id, { includeProposed: true })
  const card = cards.find((row) => row.id === id)
  const doc = docs.find((row) => row.id === id)
  if (!card || !doc) notFound()
  const going = rsvps.filter((row) => ref(row.gathering) === id && row.status === 'going')
  const userIds = going.map((row) => ref(row.user)).filter((value): value is number => Boolean(value))
  const people = userIds.length ? await rows(payload, 'users', { id: { in: userIds } }) : []
  const nameOf = new Map(people.map((person) => [person.id, str(person.name)]))
  const full = going.map((row) => personName(nameOf.get(ref(row.user) || 0) || '', str(row.guestName)))
  const shown = publicNames(full)
  const checked = checkins.some((row) => ref(row.gathering) === id && ref(row.user) === user.id)
  const share = sharePack(origin, card, '')
  const personal = bringLink(origin, card.slug, user.id)
  const circles = Array.isArray(doc.circles) ? (doc.circles as { name: string; memberIds: string[] }[]) : []
  const mine = circles.find((circle) => circle.memberIds.includes(String(user.id)))
  const photos = await rows(payload, 'gather-photos', { and: [{ gathering: { equals: id } }, { consent: { equals: true } }] })
  const mediaIds = photos.map((row) => ref(row.image)).filter((value): value is number => Boolean(value))
  const media = mediaIds.length ? await rows(payload, 'media', { id: { in: mediaIds } }) : []
  const reflection = (await rows(payload, 'gather-reflections', { and: [{ gathering: { equals: id } }, { user: { equals: user.id } }] }))[0]
  const host = user.role !== 'learner' || ref(doc.host) === user.id
  const here = `${base}/gather/${id}`
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame testId="gather-detail" tone="gather">
      <div className="app-scroll gather">
        <Back href={`${base}/gather`} label="Gather" />
        <Flash error={query.error} notice={query.notice === 'You’re in. Welcome.' || query.notice === 'You were already checked in.' ? undefined : query.notice} />
        <p className="eyebrow" data-testid="detail-door">{card.doorHeading || 'At your masjid'}</p>
        <h1 style={{ fontSize: 36, margin: '4px 0 8px' }}>{card.title}</h1>
        {card.onLine ? <p data-testid="gather-on">{card.onLine}</p> : null}
        <div>
          <span className="gather-chip gold">{card.audienceLabel}</span>
          <span className="gather-chip ivy">{KIND_LABEL[card.kind as keyof typeof KIND_LABEL] || 'Circle'}</span>
        </div>
        <section className="gather-card" style={{ marginTop: 14 }}>
          <p className="gather-meta">
            <span data-testid="gather-when">{card.when}</span>
            <span>{card.place}</span>
            {card.mapUrl ? <a className="pill outline small" href={card.mapUrl} data-testid="open-maps">Open in Maps</a> : null}
            <span>Host: {card.hostLabel}</span>
            {card.bring ? <span>Bring: {card.bring}</span> : null}
            {card.note ? <span>{card.note}</span> : null}
            <span data-testid="gather-count">{card.capacity > 0 ? `${card.going} of ${card.capacity} places taken` : `${card.going} coming`}{card.waitlist ? `. ${card.waitlist} on the list.` : ''}</span>
          </p>
          {shown.length ? <p data-testid="gather-names">Coming: {shown.join(', ')}{full.length > shown.length ? '' : ''}</p> : <p>Be the first to say you’ll come.</p>}
          {card.status === 'proposed' ? <p data-testid="gather-proposed">Waiting for your imam to open this.</p> : null}
          {card.status === 'published' ? (
            <div className="gather-actions" data-testid="rsvp-choices">
              {(['going', 'maybe', 'cant'] as const).map((choice) => (
                <form key={choice} action="/api/gather" method="post">
                  <Hidden fields={{ action: 'rsvp', id, choice, next: here, remind: choice === 'going' ? 'on' : '' }} />
                  <button className={`pill small ${card.mine === choice ? 'gold' : 'outline'}`} type="submit" data-testid={`rsvp-${choice}`}>
                    {choice === 'going' ? 'I’m coming' : choice === 'maybe' ? 'Maybe' : 'Can’t'}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
        </section>
        <section className="gather-card" data-testid="gather-share">
          <h3 style={{ marginTop: 0, color: 'var(--g-heading, #0f3b3a)' }}>Invite someone</h3>
          <p>Send it on WhatsApp, or copy your invite link. It remembers that you brought them. They only see a first name.</p>
          <div className="gather-actions">
            <a className="pill gold small" href={share.whatsApp} data-testid="share-whatsapp">WhatsApp</a>
            <CopyLink value={personal} testId="copy-bring-link" label="Copy your invite link" />
            <a className="pill outline small" href={share.icsPath} data-testid="share-ics">Add to calendar</a>
            <a className="pill outline small" href={share.google} data-testid="share-google">Google Calendar</a>
          </div>
          <div className="door-qr" style={{ maxWidth: 200 }}>
            <Qr value={personal} testId="bring-qr" />
            <p style={{ margin: '8px 0 0', textAlign: 'center' }}>They can scan this to open the invite.</p>
          </div>
          <CrossPost text={share.crossPost} testId="cross-post" />
        </section>
        {card.prompts.length ? (
          <section className="gather-card" data-testid="gather-prompts">
            <h3 style={{ marginTop: 0, color: 'var(--g-heading, #0f3b3a)' }}>If you sit and talk</h3>
            {card.prompts.map((prompt) => <p key={prompt}>{prompt}</p>)}
          </section>
        ) : null}
        {mine ? (
          <section className="gather-card" data-testid="my-circle">
            <h3 style={{ marginTop: 0, color: 'var(--g-heading, #0f3b3a)' }}>{mine.name}</h3>
            <p>You’ll sit with {mine.memberIds.filter((member) => member !== String(user.id)).map((member) => nameOf.get(Number(member))?.split(' ')[0] || 'a guest').join(', ') || 'the host'}.</p>
          </section>
        ) : null}
        {photos.length ? (
          <section data-testid="gather-photos">
            <p className="eyebrow">From the night</p>
            {photos.map((photo) => {
              const file = media.find((item) => item.id === ref(photo.image))
              const src = str(file?.url)
              return src ? <img key={photo.id} src={src} alt={str(photo.caption) || 'From the gathering'} style={{ width: '100%', borderRadius: 18, marginBottom: 8 }} /> : null
            })}
          </section>
        ) : null}
        {checked ? (
          <section className="gather-card welcome-card" id="at-the-door" data-testid="checked-in">
            <h3 style={{ marginTop: 0 }} data-testid="welcome-in">You’re in. Welcome.</h3>
            {reflection ? <p data-testid="reflection-saved">{str(reflection.body)}</p> : <Link className="pill gold small" href={`${base}/gather/${id}/reflect`} data-testid="reflect-open">Write one thing you’ll carry</Link>}
          </section>
        ) : card.status === 'published' && !card.past ? (
          <DoorArrival id={id} next={`${here}#at-the-door`} reflectHref={`${base}/gather/${id}/reflect`} />
        ) : null}
        {host ? <Link className="pill outline" href={`${base}/gather/${id}/door`} data-testid="door-link">Door code for tonight</Link> : null}
        <p className="muted" style={{ marginTop: 16 }}>A reminder is set when you say you’re coming. It stays on this page and in your bell.</p>
      </div>
      <TabBar base={base} active="gather" evening unread={unread} />
    </AppFrame>
  )
}

export async function GatherProposeScreen(ctx: Ctx) {
  const { payload, portal, base, query } = ctx
  const [courses, doors, unread] = await Promise.all([
    rows(payload, 'courses', undefined, { sort: 'title', limit: 40 }),
    loadDoors(payload),
    unreadCount(payload, ctx.user),
  ])
  return (
    <AppFrame testId="gather-propose" tone="gather">
      <div className="app-scroll gather">
        <Back href={`${base}/gather`} label="Gather" />
        <h1>Suggest a gathering</h1>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Your imam looks at it before anyone else sees it. Sisters’ and brothers’ gatherings stay marked that way.</p>
        <form className="gather-card" action="/api/gather" method="post" data-testid="propose-form">
          <Hidden fields={{ action: 'propose', portal: portal.slug, next: `${base}/gather` }} />
          <label>Name<input className="field" name="title" required data-testid="gather-title" /></label>
          <label>Kind
            <select className="field" name="kind" defaultValue="circle">{GATHER_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select>
          </label>
          <label>Who it’s for
            <select className="field" name="audience" defaultValue="all">{AUDIENCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>When, London time<input className="field" type="text" name="startsAt" required lang="en-GB" placeholder="DD/MM/YYYY HH:mm" autoComplete="off" data-testid="gather-when-input" /></label>
          <label>Place<input className="field" name="place" /></label>
          <label>Door
            <select className="field" name="door"><option value="">None</option>{doors.map((door) => <option key={door.number} value={door.number}>{doorLabel(door)}</option>)}</select>
          </label>
          <label>Course
            <select className="field" name="course"><option value="">None</option>{courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}</select>
          </label>
          <label>What to bring<textarea className="field" name="bring" rows={2} /></label>
          <label>A note<textarea className="field" name="note" rows={3} /></label>
          <button className="pill gold block" type="submit" data-testid="propose-submit">Send it to the desk</button>
        </form>
      </div>
      <TabBar base={base} active="gather" evening unread={unread} />
    </AppFrame>
  )
}

export async function GatherDoorScreen(ctx: Ctx, id: number) {
  const { payload, user, portal, base, origin } = ctx
  const doc = (await listGatherings(payload, portal.id, user.id, { includeProposed: true })).rows.find((row) => row.id === id)
  if (!doc) notFound()
  if (user.role === 'learner' && ref(doc.host) !== user.id) notFound()
  const card = (await listGatherings(payload, portal.id, user.id, { includeProposed: true })).cards.find((row) => row.id === id)
  if (!card) notFound()
  const url = `${origin}/gather/${card.slug}/in?k=${card.checkinToken}`
  const learners = (await portalPeople(payload, portal.id)).filter((person) => person.role === 'learner')
  return (
    <AppFrame testId="gather-door" tone="gather">
      <div className="app-scroll gather">
        <Back href={`${base}/gather/${id}`} label={card.title} />
        <h1>At the door</h1>
        <p>People can scan the QR on the poster, or type this door code.</p>
        <section className="gather-card" data-testid="door-entry">
          <p className="eyebrow" style={{ textAlign: 'center' }}>Door code</p>
          <p className="door-code-readout" data-testid="door-entry-code">{card.entryCode || '----'}</p>
        </section>
        <div className="door-qr"><Qr value={url} testId="door-qr" /></div>
        <a className="pill gold" href={`/gather/${card.slug}/poster.pdf`} data-testid="poster-link">Print an A4 poster</a>
        {user.role !== 'learner' ? (
          <form className="gather-card" action="/api/gather" method="post" style={{ marginTop: 16 }}>
            <Hidden fields={{ action: 'checkin', method: 'host', id, next: `${base}/gather/${id}/door` }} />
            <label>Someone without a phone
              <select className="field" name="learner" data-testid="host-checkin-learner">
                <option value="">Choose</option>
                {learners.map((person) => <option key={person.id} value={person.id}>{str(person.name)}</option>)}
              </select>
            </label>
            <button className="pill outline" type="submit" data-testid="host-checkin">Check them in</button>
          </form>
        ) : null}
        <form action="/api/gather" method="post" style={{ marginTop: 12 }}>
          <Hidden fields={{ action: 'split', id, next: `${base}/gather/${id}` }} />
          <button className="pill outline" type="submit" data-testid="split-circles">Split into circles</button>
        </form>
        <form className="gather-card" action="/api/gather" method="post" encType="multipart/form-data" style={{ marginTop: 16 }} data-testid="photo-form">
          <h3 style={{ marginTop: 0, color: 'var(--g-heading, #0f3b3a)' }}>A photo from the night</h3>
          <p>Only people who agreed to be in the picture. It stays inside the portal.</p>
          <Hidden fields={{ action: 'photo', id, next: `${base}/gather/${id}` }} />
          <label>Photo<input className="field" type="file" name="image" accept="image/*" required data-testid="gather-photo" /></label>
          <label>Caption<input className="field" name="caption" /></label>
          <label className="gather-meta" style={{ margin: '10px 0' }}><input type="checkbox" name="consent" data-testid="photo-consent" /> Everyone in the photo said yes</label>
          <button className="pill gold" type="submit" data-testid="photo-save">Keep the photo</button>
        </form>
      </div>
      <TabBar base={base} active="gather" evening />
    </AppFrame>
  )
}

export async function GatherReflectScreen(ctx: Ctx, id: number) {
  const { payload, user, portal, base, query } = ctx
  const card = (await listGatherings(payload, portal.id, user.id)).cards.find((row) => row.id === id)
  if (!card) notFound()
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame testId="gather-reflect" tone="gather">
      <div className="app-scroll gather">
        <Back href={`${base}/gather/${id}`} label={card.title} />
        <h1>One thing you’ll carry</h1>
        <Flash error={query.error} notice={query.notice === 'You’re in. Welcome.' ? undefined : query.notice} />
        {query.notice === 'You’re in. Welcome.' ? <section className="gather-card welcome-card" data-testid="welcome-in"><h2>You’re in. Welcome.</h2></section> : null}
        <p className="lead">A full sentence is enough. It goes into your harvest and your garden. It is not shown on the public page.</p>
        <form className="gather-card" action="/api/gather" method="post">
          <Hidden fields={{ action: 'reflect', id, next: `${base}/gather/${id}` }} />
          <textarea className="field" name="body" rows={4} required data-testid="reflect-body" placeholder="I will carry the quiet of sitting with people I had not met." />
          <button className="pill gold block" type="submit" data-testid="reflect-submit" style={{ marginTop: 12 }}>Keep it</button>
        </form>
      </div>
      <TabBar base={base} active="gather" evening unread={unread} />
    </AppFrame>
  )
}

export async function homeGatherings(ctx: Pick<Ctx, 'payload' | 'portal' | 'user' | 'base'>) {
  const { cards } = await listGatherings(ctx.payload, ctx.portal.id, ctx.user.id)
  return cards.filter((card) => card.status === 'published' && !card.past).slice(0, 2)
}

export function HomeGather({ cards, base, masjid }: { cards: GatherCard[]; base: string; masjid: string }) {
  if (!cards.length) return null
  return (
    <section data-testid="home-gather">
      <p className="eyebrow">At {masjid}</p>
      {cards.map((card) => (
        <Link key={card.id} className="continue-row" href={`${base}/gather/${card.id}`} data-testid="home-gather-row">
          <span className="t"><b>{card.title}</b><small>{card.when}{card.place ? ` · ${card.place}` : ''}</small></span>
        </Link>
      ))}
      <Link href={`${base}/gather`} data-testid="home-gather-all">All gatherings</Link>
    </section>
  )
}

export function TalkGatherNotice({ startsAt, href, title }: { startsAt: string; href: string; title: string }) {
  return (
    <section className="card" data-testid="talk-gather" style={{ marginTop: 14 }}>
      <p>{afterTalkLine(startsAt)}</p>
      <Link className="pill gold small" href={href} data-testid="talk-gather-open">{title}</Link>
    </section>
  )
}

export function companyGatherings(cards: GatherCard[], task: TaskRef) {
  if (!taskWantsCompany(task.prompt) && !cards.some((card) => card.taskId === task.id)) return []
  const hits = taskMatches(cards, task)
  return cards.filter((card) => hits.some((hit) => hit.id === card.id))
}

export function relatedCards(cards: GatherCard[], ref: { lessonId?: number | null; courseId?: number | null; door?: number | null }) {
  const hits = relatedGatherings(
    cards.map((card) => ({ id: card.id, lessonId: card.lessonId, courseId: card.courseId, door: card.door, taskId: card.taskId, startsAt: card.startsAt })),
    ref,
    now().getTime(),
  )
  return cards.filter((card) => hits.some((hit) => hit.id === card.id) && !card.past)
}
