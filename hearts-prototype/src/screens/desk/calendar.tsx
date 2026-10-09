import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { actionCta, CONTEXT_KEYS, contextName, parseUkDate, ukDate } from '@/lib/calendar-context'
import { EXPERIMENT_SLOTS, slotPlainName } from '@/lib/experiment-slots'
import { now } from '@/lib/clock'
import { DEFAULT_TIME_ZONE, isTimeZone, PORTAL_TIME_ZONES, portalTimeZone, wallClock, zoneCity } from '@/lib/zone-time'
import type { SessionUser } from '@/server/context'
import { canEditCalendar, canViewCalendar, contextAt, hijriOffsetOf, loadCopy, loadSeasons, resolveContextLabel, seedDefaultCopy } from '@/server/calendar'
import { flagsOfSafe } from './calendar-flags'
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
  if (ctx) return <AdminFrame ctx={ctx} active="calendar" title={title} intro={intro} testId={testId} tools={tools}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="calendar" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={tools}>
      {children}
    </DeskFrame>
  )
}

function dateValue(value?: string) {
  return parseUkDate(value) || now().toISOString().slice(0, 10)
}

export async function CalendarPages({ ctx, master }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = (ctx?.query || master?.query || {}) as Query
  const base = ctx ? `${ctx.base}/admin/calendar` : '/master/calendar'
  if (!canViewCalendar(user)) {
    return <Frame ctx={ctx || null} master={master || null} title="Calendar" intro="" testId="calendar-denied"><p>The calendar desk is for the master and portal admins.</p></Frame>
  }
  await seedDefaultCopy(payload, user)
  const previewDay = dateValue(query.date)
  const hour = Number(query.hour || 10)
  const minute = Math.max(0, Math.min(59, Math.round(Number(query.minute || 0))))
  const zone = isTimeZone(query.zone) ? query.zone : ctx ? portalTimeZone(ctx.portal) : DEFAULT_TIME_ZONE
  const at = wallClock(previewDay, hour, zone, Number.isFinite(minute) ? minute : 0)
  const [context, offset, seasons, copy, flags] = await Promise.all([
    contextAt(payload, at, hour, undefined, zone),
    hijriOffsetOf(payload),
    loadSeasons(payload),
    loadCopy(payload),
    flagsOfSafe(payload),
  ])
  const cta = await resolveContextLabel(payload, 'feed-cta-label', {}, context)
  const eid = context.eidFitr || context.eidAdha
  const masterUser = canEditCalendar(user)
  return (
    <Frame
      ctx={ctx || null}
      master={master || null}
      title="Calendar wording"
      intro="Seasonal lines for buttons and the order of talks. A sheikh’s words are never touched."
      testId="calendar-desk"
    >
      <div className={styles.page}>
        <section className={styles.summary} data-testid="calendar-now">
          <div className={styles.tile}><b>{context.hijriLabel}</b><span>Hijri date{offset ? ` · offset ${offset > 0 ? '+' : ''}${offset}` : ''}</span></div>
          <div className={styles.tile}><b>{context.greeting || 'Ordinary day'}</b><span>What the app would lean toward</span></div>
          <div className={styles.tile}><b>{context.active.length}</b><span>Active contexts</span></div>
          <div className={styles.tile}><b>{copy.filter((row) => row.approved).length}</b><span>Approved lines</span></div>
        </section>
        <div className={styles.layout}>
          <section className="panel" data-testid="calendar-preview">
            <header><h2>See the app on a date</h2></header>
            <div className="body">
              <form action={base} method="get" className="form">
                <label className="stack">Date
                  <input type="text" name="date" lang="en-GB" autoComplete="off" spellCheck={false} placeholder="4 October 2026" defaultValue={ukDate(previewDay)} data-testid="calendar-date" />
                </label>
                <label className="stack">Hour
                  <select name="hour" defaultValue={String(hour)} data-testid="calendar-hour">
                    {Array.from({ length: 24 }, (_, index) => <option key={index} value={index}>{String(index).padStart(2, '0')}</option>)}
                  </select>
                </label>
                <label className="stack">Minute
                  <select name="minute" defaultValue={String(minute)} data-testid="calendar-minute">
                    {[0, 15, 30, 45].includes(minute) ? null : <option value={minute}>{String(minute).padStart(2, '0')}</option>}
                    <option value="0">00</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                  </select>
                </label>
                <label className="stack">Zone
                  <select name="zone" defaultValue={zone} data-testid="calendar-zone">
                    {PORTAL_TIME_ZONES.map((item) => <option key={item} value={item}>{zoneCity(item)} · {item}</option>)}
                  </select>
                </label>
                <button className="btn" type="submit" data-testid="calendar-preview-go">Preview</button>
              </form>
              <p className={styles.quiet}>The Islamic day moves on at Maghrib (about sunset in the UK, or the portal’s zone).</p>
              <p className={styles.quiet} data-testid="calendar-context">{context.active.map(contextName).join(' · ') || 'No special day'} · {context.hijriLabel} · {ukDate(previewDay)} · {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')} {zoneCity(zone)}</p>
              <div
                className={styles.phone}
                data-testid="calendar-phone"
                data-friday={context.friday ? 'yes' : 'no'}
                data-ramadan={context.ramadan ? 'yes' : 'no'}
                data-last-ten={context.lastTenNights ? 'yes' : 'no'}
                data-dhul-hijjah={context.dhulHijjah ? 'yes' : 'no'}
                data-eid={eid ? 'yes' : 'no'}
                data-muharram={context.muharram ? 'yes' : 'no'}
                data-hijri={context.hijriLabel}
              >
                <p className={styles.quiet} style={{ color: 'var(--desk-gold, #D4A84B)', letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 11 }}>Feed</p>
                <p className={styles.phoneTitle}>{context.greeting || 'Your garden starts today'}</p>
                <p className={styles.phoneWhen}>{ukDate(previewDay)} · {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}</p>
                <p>{context.lastTenNights ? 'The last ten nights. A few quiet minutes, if you have them.' : context.ramadan ? 'A quieter evening in Ramadan. A short clip is waiting when you are ready.' : eid ? 'Eid mubarak. A short clip, if you would like one.' : context.dhulHijjah ? 'The first ten days. A short clip is waiting.' : context.muharram ? 'A new Hijri year. A short clip to begin.' : context.friday ? 'A Friday reminder, before Jumu\'ah, if you have a moment.' : 'Short clips from real talks, when you have a little time.'}</p>
                <span className={styles.cta} data-testid="calendar-cta">{cta}</span>
              </div>
              {masterUser ? (
                <form action="/api/experiments" method="post" style={{ marginTop: 12 }}>
                  <Hidden fields={{ action: 'from-label', slot: 'feed-cta-label', label: cta, reason: `Calendar ${context.hijriLabel}`, next: '/master/experiments' }} />
                  <button className="btn" type="submit" data-testid="make-experiment">Make this an experiment</button>
                </form>
              ) : null}
            </div>
          </section>
          <div style={{ display: 'grid', gap: 18 }}>
            {masterUser ? (
              <section className="panel">
                <header><h2>Moon sighting</h2></header>
                <form className="body form" action="/api/calendar" method="post" data-testid="hijri-offset">
                  <Hidden fields={{ action: 'offset', next: `${base}?date=${previewDay}` }} />
                  <label>Offset
                    <select name="offset" defaultValue={String(offset)}>
                      <option value="-1">Minus one day</option>
                      <option value="0">No offset</option>
                      <option value="1">Plus one day</option>
                    </select>
                  </label>
                  <button className="btn" type="submit">Save offset</button>
                </form>
              </section>
            ) : null}
            {masterUser ? (
              <section className="panel">
                <header><h2>Popular inside HEARTS</h2></header>
                <form className="body" action="/api/calendar" method="post">
                  <Hidden fields={{ action: 'popular', value: flags.popular ? 'off' : 'on', next: base }} />
                  <p className={styles.quiet}>Most finished talks this week can nudge the order, after the season theme. Talk content itself never changes.</p>
                  <button className="btn ghost" type="submit" data-testid="popular-toggle">{flags.popular ? 'Turn popular talks off' : 'Use popular talks'}</button>
                </form>
              </section>
            ) : null}
          </div>
        </div>
        {masterUser ? (
          <section className="panel">
            <header><h2>A season you set</h2></header>
            <form className="body form" action="/api/calendar" method="post" data-testid="season-form">
              <Hidden fields={{ action: 'season', next: base }} />
              <label className="stack">Key<input type="text" name="key" placeholder="exams" required /></label>
              <label className="stack">Name<input type="text" name="name" placeholder="Exam season" required /></label>
              <label className="stack">Theme words<input type="text" name="theme" placeholder="focus revision" /></label>
              <label className="stack">From<input type="text" name="start" lang="en-GB" autoComplete="off" spellCheck={false} placeholder="4 October 2026" required /></label>
              <label className="stack">Until<input type="text" name="end" lang="en-GB" autoComplete="off" spellCheck={false} placeholder="11 October 2026" required /></label>
              <button className="btn" type="submit">Save season</button>
            </form>
            {seasons.length ? (
              <div className="body">
                {seasons.map((season) => (
                  <p key={season.key} className={styles.quiet}>{season.name} · {ukDate(season.start)} to {ukDate(season.end)}</p>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <section className="panel">
          <header><h2>Seasonal lines</h2></header>
          <div className="body">
            <p className={styles.quiet}>AI drafts need your approval. They never change a sheikh’s words.</p>
            {masterUser ? (
              <form className="form" action="/api/calendar" method="post" data-testid="copy-form">
                <Hidden fields={{ action: 'copy', next: base }} />
                <label className="stack">Slot
                  <select name="slot" defaultValue="feed-cta-label">
                    {EXPERIMENT_SLOTS.filter((slot) => slot.kind === 'copy').map((slot) => <option key={slot.key} value={slot.key}>{slot.name}</option>)}
                  </select>
                </label>
                <label className="stack">When
                  <select name="context" defaultValue="friday">
                    {CONTEXT_KEYS.map((key) => <option key={key} value={key}>{contextName(key)}</option>)}
                    {seasons.map((season) => <option key={season.key} value={season.key}>{season.name}</option>)}
                  </select>
                </label>
                <label className="stack">Line
                  <textarea name="label" rows={4} required placeholder="Watch a Friday reminder before Jumu'ah" data-testid="copy-label" />
                </label>
                <button className="btn" type="submit">Save draft</button>
              </form>
            ) : null}
            {masterUser ? (
              <form action="/api/calendar" method="post" style={{ marginTop: 10 }}>
                <Hidden fields={{ action: 'suggest', slot: 'feed-cta-label', context: 'friday', next: base }} />
                <button className="btn ghost" type="submit" data-testid="copy-suggest">Suggest a Friday line</button>
              </form>
            ) : null}
            <table className={styles.table} data-testid="copy-table">
              <thead><tr><th>Where it shows</th><th>When</th><th>Line</th><th>Approved</th>{masterUser ? <th /> : null}</tr></thead>
              <tbody>
                {copy.map((row) => (
                  <tr key={row.id} data-testid="copy-row" data-approved={row.approved ? 'yes' : 'no'}>
                    <td>{slotPlainName(row.slot)}</td>
                    <td>{contextName(row.context)}</td>
                    <td>{actionCta(row.label)}</td>
                    <td>{row.approved ? 'Yes' : 'Needs approval'}</td>
                    {masterUser ? (
                      <td>
                        <form action="/api/calendar" method="post">
                          <Hidden fields={{ action: row.approved ? 'hold' : 'approve', id: String(row.id), next: base }} />
                          <button className="btn ghost small" type="submit">{row.approved ? 'Hold back' : 'Approve'}</button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <p className={styles.quiet}>Experiments can also carry Friday or Ramadan lines on a version. <Link href="/master/experiments">Open the Experiments desk</Link>.</p>
      </div>
    </Frame>
  )
}
