import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { CalendarHelp } from '@/components/desk/help'
import { actionCta, CONTEXT_KEYS, contextName, ukDate } from '@/lib/calendar-context'
import { EXPERIMENT_SLOTS, slotPlainName } from '@/lib/experiment-slots'
import { now } from '@/lib/clock'
import type { SessionUser } from '@/server/context'
import { canEditCalendar, canViewCalendar, contextAt, hijriOffsetOf, loadCopy, loadSeasons, seedDefaultCopy } from '@/server/calendar'
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
  if (ctx) return <AdminFrame ctx={ctx} active="calendar" title={title} intro={intro} testId={testId} tools={tools} help={<CalendarHelp />}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="calendar" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={tools} help={<CalendarHelp />}>
      {children}
    </DeskFrame>
  )
}

function dateValue(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  return now().toISOString().slice(0, 10)
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
  const at = new Date(`${previewDay}T${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00:00.000Z`)
  const weekday = at.getUTCDay()
  const [context, offset, seasons, copy, flags] = await Promise.all([
    contextAt(payload, at, hour, weekday),
    hijriOffsetOf(payload),
    loadSeasons(payload),
    loadCopy(payload),
    flagsOfSafe(payload),
  ])
  const fridayLine = copy.find((row) => row.slot === 'feed-cta-label' && row.context === 'friday' && row.approved)?.label
    || "Watch a Friday reminder before Jumu'ah ›"
  const ramadanLine = copy.find((row) => row.slot === 'feed-cta-label' && row.context === 'ramadan' && row.approved)?.label
    || 'Watch a short clip for a Ramadan evening ›'
  const eidLine = copy.find((row) => row.slot === 'feed-cta-label' && (row.context === 'eidFitr' || row.context === 'eidAdha') && row.approved)?.label
    || 'Watch a short clip for Eid ›'
  const lastTenLine = copy.find((row) => row.slot === 'feed-cta-label' && row.context === 'lastTenNights' && row.approved)?.label
    || 'Watch a few minutes in the last ten nights ›'
  const rawCta = context.lastTenNights ? lastTenLine
    : context.eidFitr || context.eidAdha ? eidLine
    : context.ramadan ? ramadanLine
    : context.friday ? fridayLine
    : 'Learn more ›'
  const cta = actionCta(rawCta)
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
                <label>Date <span className={styles.quiet}>({ukDate(previewDay)})</span><input type="date" name="date" defaultValue={previewDay} data-testid="calendar-date" /></label>
                <label>Hour (UK)
                  <select name="hour" defaultValue={String(hour)} data-testid="calendar-hour">
                    {Array.from({ length: 24 }, (_, index) => <option key={index} value={index}>{index}:00</option>)}
                  </select>
                </label>
                <button className="btn" type="submit" data-testid="calendar-preview-go">Preview</button>
              </form>
              <p className={styles.quiet}>The Islamic day moves on at Maghrib (about sunset in the UK, or the portal’s zone).</p>
              <p className={styles.quiet} data-testid="calendar-context">{context.active.map(contextName).join(' · ') || 'No special day'} · {context.hijriLabel} · {ukDate(previewDay)}</p>
              <div
                className={styles.phone}
                data-testid="calendar-phone"
                data-friday={context.friday ? 'yes' : 'no'}
                data-ramadan={context.ramadan ? 'yes' : 'no'}
                data-last-ten={context.lastTenNights ? 'yes' : 'no'}
                data-dhul-hijjah={context.dhulHijjah ? 'yes' : 'no'}
                data-eid={eid ? 'yes' : 'no'}
                data-muharram={context.muharram ? 'yes' : 'no'}
              >
                <p className={styles.quiet} style={{ color: '#f1d58a', letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 11 }}>Home</p>
                <p className={styles.phoneTitle}>{context.greeting || 'Your garden starts today'}</p>
                <p className={styles.phoneWhen}>{ukDate(previewDay)}</p>
                <p>{context.lastTenNights ? 'The last ten nights. A few quiet minutes, if you have them.' : context.ramadan ? 'A quieter evening in Ramadan. A short clip is waiting when you are ready.' : eid ? 'Eid mubarak. A short clip, if you would like one.' : context.dhulHijjah ? 'The first ten days. A short clip is waiting.' : context.muharram ? 'A new Hijri year. A short clip to begin.' : context.friday ? 'A Friday reminder, before Jumu\'ah, if you have a moment.' : 'Short clips from real talks, when you have a little time.'}</p>
                <span className={styles.cta} data-testid="calendar-cta">{cta}</span>
              </div>
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
              <label>Key<input name="key" placeholder="exams" required /></label>
              <label>Name<input name="name" placeholder="Exam season" required /></label>
              <label>Theme words<input name="theme" placeholder="focus revision" /></label>
              <label>From<input type="date" name="start" required /></label>
              <label>Until<input type="date" name="end" required /></label>
              <button className="btn" type="submit">Save season</button>
            </form>
            {seasons.length ? (
              <div className="body">
                {seasons.map((season) => (
                  <p key={season.key} className={styles.quiet}>{season.name} · {season.start} to {season.end}</p>
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
                <label>Slot
                  <select name="slot" defaultValue="feed-cta-label">
                    {EXPERIMENT_SLOTS.filter((slot) => slot.kind === 'copy').map((slot) => <option key={slot.key} value={slot.key}>{slot.name}</option>)}
                  </select>
                </label>
                <label>When
                  <select name="context" defaultValue="friday">
                    {CONTEXT_KEYS.map((key) => <option key={key} value={key}>{contextName(key)}</option>)}
                    {seasons.map((season) => <option key={season.key} value={season.key}>{season.name}</option>)}
                  </select>
                </label>
                <label>Line<input name="label" required placeholder="A Friday reminder before Jumu'ah" data-testid="copy-label" /></label>
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
