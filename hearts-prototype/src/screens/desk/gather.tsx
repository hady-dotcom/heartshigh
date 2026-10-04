import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { Qr } from '@/components/qr'
import { GATHER_KINDS, KIND_LABEL } from '@/lib/gather'
import { doorLabel } from '@/lib/doors'
import { loadDoors } from '@/server/doors'
import { attendanceReport, listGatherings, sharePack } from '@/server/gather'
import { type Ctx, rows, str } from '../common'
import { AdminFrame } from './overview'

const AUDIENCES = [
  ['all', 'Everyone'],
  ['brothers', 'Brothers'],
  ['sisters', 'Sisters'],
  ['family', 'Families'],
  ['youth', 'Youth'],
] as const

export async function GatherDeskScreen(ctx: Ctx) {
  const { payload, user, portal, base, origin, query } = ctx
  const [{ grouped, cards }, courses, lessons, doors] = await Promise.all([
    listGatherings(payload, portal.id, user.id, { includeProposed: true }),
    rows(payload, 'courses', undefined, { sort: 'title', limit: 40 }),
    rows(payload, 'lessons', undefined, { sort: 'title', limit: 80 }),
    loadDoors(payload),
  ])
  const here = `${base}/admin/gather`
  const proposed = cards.filter((card) => card.status === 'proposed')
  const preview = cards.filter((card) => card.status === 'published' && !card.past).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
  return (
    <AdminFrame ctx={ctx} active="gather" tone="evening" title="Gather" intro="Upcoming and past gatherings at this masjid." testId="desk-gather">
      <div className="stats-strip" data-testid="gather-summary">
        <div className="stat-chip"><b>{cards.filter((card) => !card.past && card.status === 'published').length}</b><span>Upcoming</span></div>
        <div className="stat-chip"><b>{cards.reduce((sum, card) => sum + card.going, 0)}</b><span>Places said yes</span></div>
        <div className="stat-chip"><b>{cards.reduce((sum, card) => sum + card.checkedIn, 0)}</b><span>Checked in</span></div>
        <div className="stat-chip"><b>{proposed.length}</b><span>Waiting on you</span></div>
      </div>
      <p style={{ marginTop: 0 }}><Link className="btn" href={`${base}/admin/gather/attendance`} data-testid="attendance-link">Attendance</Link></p>
      {proposed.length ? (
        <section className="panel" data-testid="proposed-list" style={{ marginBottom: 18 }}>
          <header><h2>Suggested by learners</h2></header>
          <div className="body">
            {proposed.map((card) => (
              <div key={card.id} data-testid="proposed-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <span><b>{card.title}</b><br /><span className="hint">{card.when}</span></span>
                <form action="/api/gather" method="post">
                  <Hidden fields={{ action: 'status', status: 'published', id: card.id, portal: portal.slug, next: here }} />
                  <button className="btn small" type="submit" data-testid="approve-gather">Open it</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 0.8fr)', alignItems: 'start' }}>
        <div>
          {(['upcoming', 'past'] as const).map((bucket) => (
            <section key={bucket} style={{ marginBottom: 18 }} data-testid={`desk-${bucket}`}>
              <h2 style={{ fontFamily: 'var(--serif)', color: '#0f3b3a', fontSize: 32, margin: '0 0 8px' }}>{bucket === 'upcoming' ? 'Upcoming' : 'Past'}</h2>
              {grouped[bucket].map((group) => (
                <section className="panel" key={`${bucket}-${group.door}`} data-testid="desk-door" style={{ marginBottom: 12 }}>
                  <header><div><h2>{group.door}</h2><p>{group.items.length} {group.items.length === 1 ? 'gathering' : 'gatherings'}</p></div></header>
                  <div className="body">
                    {group.items.map((card) => (
                      <article key={card.id} data-testid="desk-gather-row" style={{ marginBottom: 12 }}>
                        <b>{card.title}</b>
                        <p className="hint" style={{ margin: '4px 0' }}>{card.when}{card.place ? ` · ${card.place}` : ''}</p>
                        <span className="badge gold">{card.going} coming</span>{' '}
                        <span className="badge teal">{card.checkedIn} here</span>{' '}
                        {card.waitlist ? <span className="badge grey">{card.waitlist} waiting</span> : null}
                        <div style={{ marginTop: 8 }}>
                          <Link href={`${base}/gather/${card.id}/door`}>Door code</Link>
                          {' · '}
                          <a href={`/gather/${card.slug}/poster.pdf`}>A4 poster</a>
                          {' · '}
                          <a href={sharePack(origin, card).url}>Public page</a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {!grouped[bucket].length ? <p className="hint">{bucket === 'upcoming' ? 'Nothing coming up.' : 'Nothing in the past yet.'}</p> : null}
            </section>
          ))}
        </div>
        <div>
          {preview ? (
            <section className="panel wa-desk" data-testid="desk-wa-preview">
              <header><h2>In WhatsApp</h2></header>
              <div className="body wa-desk-row">
                <p>The card people see.</p>
                <img src={`/gather/${preview.slug}/card.png`} alt="" />
                <p className="wa-caption"><b>{preview.title}</b><br />{preview.when}{preview.place ? ` · ${preview.place}` : ''}</p>
              </div>
            </section>
          ) : null}
        <section className="panel">
          <header><h2>Plan a gathering</h2></header>
          <form className="body form" action="/api/gather" method="post" data-testid="desk-gather-form">
            <Hidden fields={{ action: 'save', portal: portal.slug, next: here }} />
            <label className="stack">Name<input type="text" name="title" required data-testid="desk-gather-title" /></label>
            <label className="stack">Kind
              <select name="kind" defaultValue="circle">{GATHER_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select>
            </label>
            <label className="stack">Who it’s for
              <select name="audience" defaultValue="all">{AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="stack">When, London time<input type="text" name="startsAt" required lang="en-GB" placeholder="DD/MM/YYYY HH:mm" autoComplete="off" data-testid="desk-gather-when" /></label>
            <label className="stack">Place<input type="text" name="place" data-testid="desk-gather-place" /></label>
            <label className="stack">Map link<input type="url" name="mapUrl" placeholder="https://" /></label>
            <label className="stack">How many places. Leave 0 if anyone can come.<input type="number" name="capacity" min={0} defaultValue={20} /></label>
            <label className="stack">Host name on the public page<input type="text" name="hostLabel" defaultValue={str(user.name).split(' ')[0]} /></label>
            <label className="stack">Door
              <select name="door"><option value="">None</option>{doors.map((door) => <option key={door.number} value={door.number}>{doorLabel(door)}</option>)}</select>
            </label>
            <label className="stack">Course
              <select name="course"><option value="">None</option>{courses.map((course) => <option key={course.id} value={course.id}>{str(course.title)}</option>)}</select>
            </label>
            <label className="stack">Talk
              <select name="lesson" data-testid="desk-gather-lesson"><option value="">None</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{str(lesson.title)}</option>)}</select>
            </label>
            <label className="stack">What to bring<textarea name="bring" rows={2} /></label>
            <label className="stack">A note<textarea name="note" rows={3} /></label>
            <button className="btn" type="submit" data-testid="desk-gather-save">Save gathering</button>
          </form>
        </section>
        </div>
      </div>
    </AdminFrame>
  )
}

export async function GatherAttendanceScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const report = await attendanceReport(payload, portal.id)
  const max = Math.max(1, ...report.series.map((point) => point.checkedIn))
  return (
    <AdminFrame ctx={ctx} active="gather" tone="evening" title="Attendance" intro="Who showed up, who was new, and who brought them." testId="desk-attendance">
      <div className="stats-strip">
        <div className="stat-chip"><b data-testid="stat-newcomers">{report.newcomers}</b><span>Newcomers</span></div>
        <div className="stat-chip"><b data-testid="stat-regulars">{report.regulars}</b><span>Regulars</span></div>
        <div className="stat-chip"><b>{report.brought.length}</b><span>Brought by someone</span></div>
        <div className="stat-chip"><b>{report.series.length}</b><span>Nights held</span></div>
      </div>
      <section className="panel" data-testid="attendance-chart">
        <header><h2>Over time</h2></header>
        <div className="body">
          {report.series.length ? (
            <>
              <p className="attendance-legend" data-testid="attendance-legend"><span><i className="gold" /> Newcomers</span><span><i className="teal" /> Regulars</span></p>
              <div className="chart" data-testid="attendance-bars" style={{ gridTemplateColumns: `repeat(${Math.max(report.series.slice(-8).length, 1)}, minmax(0, 1fr))` }}>
                {report.series.slice(-8).map((point) => (
                  <div className="col" key={`${point.title}-${point.label}`}>
                    <span className="bar-count" data-testid="bar-count">{point.checkedIn}</span>
                    <div className="slot" title={`${point.title}: ${point.checkedIn}`}>
                      <i className="new" style={{ height: `${Math.round((point.newcomers / max) * 100)}%` }} />
                      <i style={{ height: `${Math.round((point.regulars / max) * 100)}%` }} />
                    </div>
                    <small>{point.label}</small>
                  </div>
                ))}
              </div>
            </>
          ) : <p>No one has checked in yet.</p>}
        </div>
      </section>
      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="panel" data-testid="brought">
          <header><h2>Who brought whom</h2></header>
          <div className="body">
            {report.brought.length ? report.brought.map((row, index) => (
              <p key={index} data-testid="brought-row"><b>{row.host}</b> brought {row.guest}{row.gathering ? ` to ${row.gathering}` : ''}.</p>
            )) : <p>No bring-a-friend links have been used yet.</p>}
          </div>
        </section>
        <section className="panel" data-testid="follow-up">
          <header><h2>Follow-up</h2></header>
          <div className="body">
            {report.followUp ? <p data-testid="follow-up-line">{report.followUp}</p> : <p>No newcomers are waiting on a welcome.</p>}
            {report.followNames.length ? <p>{report.followNames.join(', ')}</p> : null}
            <form action="/api/gather" method="post">
              <Hidden fields={{ action: 'welcome', portal: portal.slug, next: `${base}/admin/gather/attendance` }} />
              <button className="btn" type="submit" data-testid="send-welcome">Send them a welcome</button>
            </form>
            <p style={{ marginTop: 12 }}><a className="btn ghost" href={`/api/gather?export=1&portal=${portal.slug}`} data-testid="gather-export">Export</a></p>
          </div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Door code</h2></header>
        <div className="body">
          {report.cards.filter((card) => !card.past).slice(0, 1).map((card) => (
            <div key={card.id}>
              <p>{card.title}</p>
              {card.entryCode ? <p className="door-code-readout" data-testid="desk-entry-code">{card.entryCode}</p> : null}
              <div className="door-qr" style={{ maxWidth: 280 }}><Qr value={`${ctx.origin}/gather/${card.slug}/in?k=${card.checkinToken}`} testId="desk-door-qr" /></div>
            </div>
          ))}
          {!report.cards.some((card) => !card.past) ? <p>Plan a gathering and the door code will sit here.</p> : null}
        </div>
      </section>
    </AdminFrame>
  )
}
