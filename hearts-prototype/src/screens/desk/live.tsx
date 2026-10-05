import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { LiveWhenPicker } from '@/components/desk/live-when'
import { doorSpokenLabel } from '@/lib/doors'
import { muxConfigured, SOURCE_LABEL } from '@/lib/live'
import { loadDoors } from '@/server/doors'
import { listQuestions, listSessions, muxStatus } from '@/server/live'
import { type Ctx, rows, str } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'
import type { SessionUser } from '@/server/context'
import type { Payload } from 'payload'

export async function LiveDeskScreen(ctx: Ctx) {
  const { payload, user, portal, base } = ctx
  const [cards, doors] = await Promise.all([listSessions(payload, portal, user.id), loadDoors(payload)])
  const live = cards.find((card) => card.status === 'live') || null
  const scheduled = cards.filter((card) => card.status === 'scheduled')
  const ended = cards.filter((card) => card.status === 'ended')
  const questions = live ? await listQuestions(payload, live.id, user, true) : []
  const mux = muxStatus()
  const here = `${base}/admin/live`
  return (
    <AdminFrame ctx={ctx} active="live" tone="evening" title="Go live" intro="Start a live session for the learners of this portal. Paste a YouTube or Vimeo link, or use Mux when it is configured." testId="desk-live">
      <div className="stats-strip" data-testid="live-summary">
        <div className="stat-chip"><b>{live ? 1 : 0}</b><span>Live now</span></div>
        <div className="stat-chip"><b>{scheduled.length}</b><span>Coming up</span></div>
        <div className="stat-chip"><b>{ended.length}</b><span>Replays</span></div>
        <div className="stat-chip"><b>{live?.viewerCount || 0}</b><span>Watching</span></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', alignItems: 'start' }}>
        <div>
          {live ? (
            <section className="panel" data-testid="desk-live-now" style={{ marginBottom: 18 }}>
              <header>
                <div>
                  <h2>Live now</h2>
                  <p>{live.hostName} · {live.title}</p>
                </div>
              </header>
              <div className="body">
                <p className="hint" style={{ marginTop: 0 }}>{live.doorLabel || 'No door set.'} · {SOURCE_LABEL[live.source]} · {live.viewerCount} watching</p>
                {live.source === 'mux' && live.muxStreamKey ? (
                  <div className="live-mux" data-testid="desk-mux-keys">
                    <p>Use these in OBS or a phone app.</p>
                    <label className="stack">RTMP URL<input readOnly value={live.muxRtmpUrl} /></label>
                    <label className="stack">Stream key<input readOnly value={live.muxStreamKey} /></label>
                  </div>
                ) : null}
                <form action="/api/live" method="post">
                  <Hidden fields={{ action: 'end', id: live.id, portal: portal.slug, next: here }} />
                  <button className="btn" type="submit" data-testid="desk-end-live" data-write>End live</button>
                </form>
              </div>
            </section>
          ) : null}
          <section className="panel" data-testid="desk-live-questions" style={{ marginBottom: 18 }}>
            <header>
              <div>
                <h2>Questions</h2>
                <p>{live ? 'From learners watching now. Pin, mark answered, or hide.' : 'Questions appear here once you are live.'}</p>
              </div>
              {live ? <a className="btn ghost small" href={`/api/live?export=1&portal=${portal.slug}&id=${live.id}`} data-testid="live-export">Export questions</a> : null}
            </header>
            <div className="body">
              {questions.map((question) => (
                <article key={question.id} className={`live-q${question.hidden ? ' hidden' : ''}${question.pinned ? ' pinned' : ''}`} data-testid="desk-live-question" data-hidden={question.hidden ? 'yes' : 'no'} data-answered={question.answered ? 'yes' : 'no'} data-pinned={question.pinned ? 'yes' : 'no'}>
                  <p>{question.body}</p>
                  <small className="hint">{question.authorName}{question.answered ? ' · Answered' : ''}{question.pinned ? ' · Pinned' : ''}{question.hidden ? ' · Hidden' : ''}</small>
                  <div className="live-q-actions">
                    <form action="/api/live" method="post">
                      <Hidden fields={{ action: 'moderate', question: question.id, answered: question.answered ? '0' : '1', portal: portal.slug, next: here }} />
                      <button className="btn ghost small" type="submit" data-testid="live-mark-answered" data-write>{question.answered ? 'Not answered' : 'Mark answered'}</button>
                    </form>
                    <form action="/api/live" method="post">
                      <Hidden fields={{ action: 'moderate', question: question.id, pinned: question.pinned ? '0' : '1', portal: portal.slug, next: here }} />
                      <button className="btn ghost small" type="submit" data-testid="live-pin" data-write>{question.pinned ? 'Unpin' : 'Pin'}</button>
                    </form>
                    <form action="/api/live" method="post">
                      <Hidden fields={{ action: 'moderate', question: question.id, hidden: question.hidden ? '0' : '1', portal: portal.slug, next: here }} />
                      <button className="btn ghost small" type="submit" data-testid="live-hide" data-write>{question.hidden ? 'Show' : 'Hide'}</button>
                    </form>
                  </div>
                </article>
              ))}
              {live && !questions.length ? <p className="hint">No questions yet. They will appear as learners send them.</p> : null}
              {!live ? <p className="hint">Go live and the questions will land here.</p> : null}
            </div>
          </section>
          {scheduled.length ? (
            <section className="panel" data-testid="desk-live-upcoming" style={{ marginBottom: 18 }}>
              <header><h2>Coming up</h2></header>
              <div className="body">
                {scheduled.map((card) => (
                  <article key={card.id} data-testid="desk-scheduled-row" style={{ marginBottom: 12 }}>
                    <b>{card.title}</b>
                    <p className="hint" style={{ margin: '4px 0' }}>{card.when}{card.doorLabel ? ` · ${card.doorLabel}` : ''}</p>
                    <form action="/api/live" method="post">
                      <Hidden fields={{ action: 'start', id: card.id, portal: portal.slug, next: here }} />
                      <button className="btn small" type="submit" data-testid="desk-start-scheduled" data-write>Go live now</button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {ended.length ? (
            <section className="panel" data-testid="desk-live-ended">
              <header><h2>Ended</h2></header>
              <div className="body">
                {ended.map((card) => (
                  <article key={card.id} data-testid="desk-ended-row" style={{ marginBottom: 12 }}>
                    <b>{card.title}</b>
                    <p className="hint" style={{ margin: '4px 0' }}>{card.when}{card.replayLessonId ? ' · Replay draft ready' : ''}</p>
                    {card.replayLessonId ? <Link href={`${base}/admin/content`}>Open Content</Link> : null}
                    {' · '}
                    <a href={`/api/live?export=1&portal=${portal.slug}&id=${card.id}`}>Export questions</a>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <section className="panel">
          <header><h2>Go live</h2></header>
          <form className="body form" action="/api/live" method="post" data-testid="desk-live-form">
            <Hidden fields={{ portal: portal.slug, next: here }} />
            <label className="stack">Title<input type="text" name="title" required data-testid="desk-live-title" placeholder="Circle after Isha" /></label>
            <label className="stack">Door
              <select name="door" data-testid="desk-live-door">
                <option value="">None</option>
                {doors.map((door) => <option key={door.number} value={door.number}>{doorSpokenLabel(door)}</option>)}
              </select>
            </label>
            <label className="stack">Source
              <select name="source" defaultValue="youtube" data-testid="desk-live-source">
                <option value="youtube">{SOURCE_LABEL.youtube}</option>
                <option value="vimeo">{SOURCE_LABEL.vimeo}</option>
                <option value="mux">{SOURCE_LABEL.mux}</option>
              </select>
            </label>
            <label className="stack">YouTube Live or Vimeo link
              <input type="url" name="sourceUrl" data-testid="desk-live-url" placeholder="https://www.youtube.com/live/…" />
            </label>
            <p className="hint" data-testid="desk-mux-status">{mux.message}</p>
            <div className="stack">Schedule for later
              <LiveWhenPicker />
            </div>
            <div className="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" type="submit" name="action" value="start-now" data-testid="desk-start-now" data-write>Start now</button>
              <button className="btn ghost" type="submit" name="action" value="save" data-testid="desk-schedule" data-write>Schedule</button>
            </div>
            {!muxConfigured() ? <p className="hint">Mux stays off until the keys are in the environment. YouTube and Vimeo do not need any extra setup.</p> : null}
          </form>
        </section>
      </div>
    </AdminFrame>
  )
}

export async function MasterLiveScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  const portals = await rows(payload, 'portals', undefined, { sort: 'name', limit: 80 })
  const sessions = await rows(payload, 'live-sessions', undefined, { sort: '-createdAt', limit: 80 })
  return (
    <DeskFrame payload={payload} user={user} title="Live" intro="Every portal’s live sessions. Open a portal desk to start or end one." active="live" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-live">
      <section className="panel">
        <header><h2>All portals</h2></header>
        <div className="body">
          {sessions.map((row) => {
            const portal = portals.find((item) => item.id === Number(row.portal))
            return (
              <article key={row.id} data-testid="master-live-row" style={{ marginBottom: 12 }}>
                <b>{str(row.title)}</b>
                <p className="hint">{str(portal?.name) || 'Portal'} · {str(row.status)} · {str(row.hostName)}</p>
                {portal ? <Link href={`/p/${str(portal.slug)}/admin/live`}>Open the desk</Link> : null}
              </article>
            )
          })}
          {!sessions.length ? <p className="hint">No live sessions yet.</p> : null}
        </div>
      </section>
    </DeskFrame>
  )
}
