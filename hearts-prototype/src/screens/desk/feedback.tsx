import Link from 'next/link'
import { headers } from 'next/headers'
import { Hidden } from '@/components/app/shell'
import {
  EMPTY_FILTERS,
  FAMILY_LABEL,
  anonymiseFromQuery,
  assignPseudonyms,
  buildFeedback,
  canNameExport,
  countPhrase,
  displayDay,
  exportKindLabel,
  filterQuery,
  parseFilters,
  sharingDecision,
  type Family,
  type RawFeedback,
} from '@/lib/feedback'
import { doorLabel, DOORS } from '@/lib/doors'
import { rows, str, type Ctx } from '../common'
import { HelpTip } from '@/components/desk/help'
import { PortalAiChoice } from '@/components/desk/paid-ai'
import { publicAi } from '@/lib/portal-ai'
import { TOOL } from '@/lib/desk-help'
import { AdminFrame } from './overview'
import { exportAudit, includedSummaries, loadRawFeedback, summariesFor, weakQuestions } from '@/server/feedback'
import styles from './feedback.module.css'
import { localeFromAcceptLanguage, portalTimeZone, zonedTime, zoneCity } from '@/lib/zone-time'

const FAMILIES: Family[] = ['popup', 'reflection', 'task', 'circle', 'live']

export async function FeedbackScreen(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  if (!canNameExport(user.role)) {
    return <AdminFrame ctx={ctx} active="feedback" title="Feedback" testId="feedback-denied"><p>Feedback is for teachers and portal admins.</p></AdminFrame>
  }
  const filters = parseFilters(query)
  const ai = publicAi(portal.aiConnection)
  const anonymised = anonymiseFromQuery(query) || !canNameExport(user.role)
  const here = `${base}/admin/feedback`
  const [raw, codes, summaryRows, rewrites, audits] = await Promise.all([
    loadRawFeedback(payload, portal.id),
    rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'label', limit: 200 }),
    summariesFor(payload, portal.id),
    weakQuestions(payload),
    user.role === 'teacher' ? Promise.resolve([]) : exportAudit(payload, portal.id),
  ])
  const built = buildFeedback(raw, portal.id, filters, anonymised)
  const timeZone = portalTimeZone(portal)
  const locale = localeFromAcceptLanguage((await headers()).get('accept-language'))
  const included = new Map((await includedSummaries(payload, portal.id, built)).map((row) => [row.questionKey, row]))
  const drafts = summaryRows.filter((row) => row.status !== 'included')
  const draftByKey = new Map(drafts.map((row) => [str(row.questionKey), row]))
  const options = optionLists(raw, anonymised)
  const preserved = filterQuery(filters, { filters: '1', view: query.view === 'learner' ? 'learner' : 'door', anonymise: anonymised ? '1' : '' })
  const pageQuery = preserved.toString()
  const download = (format: string) => `/api/feedback?portal=${portal.slug}&format=${format}&${filterQuery(filters, { named: anonymised ? '' : '1' }).toString()}`
  const emptyExport = built.sharedCount === 0

  return (
    <AdminFrame
      ctx={ctx}
      active="feedback"
      title="Feedback"
      intro="Read and download what learners chose to share, so you can understand your community. Answers they kept private are counted and left out."
      testId="feedback-desk"
      tools={
        <details className={styles.dialog} data-testid="export-dialog">
          <summary>Download</summary>
          <div className={styles.body}>
            <p className="hint" data-testid="export-mode">{anonymised ? 'Anonymise is on. Names become Learner A, Learner B, and so on. Emails are left out. This download is written to the audit log.' : 'Names are included. Emails are still left out. This named download is written to the audit log, and only covers this portal.'}</p>
            {emptyExport ? <p className="hint" data-testid="export-empty">Nothing shared matches this view, so download is paused.</p> : null}
            <div className="actions" style={{ justifyContent: 'flex-start' }}>
              {emptyExport ? <span className="btn" aria-disabled="true" data-testid="export-csv">CSV</span> : <a className="btn" href={download('csv')} data-testid="export-csv">CSV</a>}
              {emptyExport ? <span className="btn" aria-disabled="true" data-testid="export-xlsx">Excel</span> : <a className="btn" href={download('xlsx')} data-testid="export-xlsx">Excel</a>}
              {emptyExport ? <span className="btn" aria-disabled="true" data-testid="export-pdf">PDF digest</span> : <a className="btn" href={download('pdf')} data-testid="export-pdf">PDF digest</a>}
              <HelpTip topic="export">{TOOL.exportFeedback}</HelpTip>
            </div>
          </div>
        </details>
      }
    >
      <div className={styles.page}>
        <section className={styles.summary} data-testid="feedback-summary">
          <div className={styles.tile}><b data-testid="shared-count">{built.sharedCount}</b><span>Shared answers</span></div>
          <div className={styles.tile}><b data-testid="private-count">{built.privateCount}</b><span>Kept private</span></div>
          <div className={styles.tile}><b>{built.doorCounts.length}</b><span>Doors in this view</span></div>
          <div className={styles.tile}><b>{built.questionCounts.length}</b><span>Questions in this view</span></div>
        </section>

        <div className={styles.counts}>
          <section className="panel" data-testid="door-counts">
            <header><h2>By door</h2></header>
            <div className="body">
              {built.doorCounts.length ? built.doorCounts.map((row) => (
                <div className={styles.doorRow} key={row.key}><span>{row.label}</span><b>{countPhrase(row.shared, row.privateCount)}</b></div>
              )) : <p className="hint">No door has an answer in this view yet.</p>}
            </div>
          </section>
          <section className="panel" data-testid="question-counts">
            <header><h2>By question</h2></header>
            <div className="body">
              {built.questionCounts.length ? built.questionCounts.map((row) => (
                <div className={styles.questionRow} key={row.key}><span>{row.label}</span><b>{countPhrase(row.shared, row.privateCount)}</b></div>
              )) : <p className="hint">No question has an answer in this view yet.</p>}
            </div>
          </section>
        </div>

        <form className={`panel`} action={here} method="get" data-testid="feedback-filters">
          <header className="light"><h2>Filters <HelpTip topic="filters">{TOOL.filters}</HelpTip></h2></header>
          <div className="body">
            <input type="hidden" name="filters" value="1" />
            {query.view === 'learner' ? <input type="hidden" name="view" value="learner" /> : null}
            <div className={styles.filters}>
              <label>Door
                <select name="door" defaultValue={filters.door ? `W${filters.door}` : ''} data-testid="filter-door">
                  <option value="">All doors</option>
                  {DOORS.map((door) => <option key={door.number} value={`W${door.number}`}>{doorLabel(door)}</option>)}
                </select>
              </label>
              <label>Ghunya seat
                <select name="seat" defaultValue={filters.seatId || ''}>
                  <option value="">All seats</option>
                  {options.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.label}</option>)}
                </select>
              </label>
              <label>Course
                <select name="course" defaultValue={filters.courseId || ''}>
                  <option value="">All courses</option>
                  {options.courses.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}
                </select>
              </label>
              <label>Talk
                <select name="talk" defaultValue={filters.talkId || ''}>
                  <option value="">All talks</option>
                  {options.talks.map((talk) => <option key={talk.id} value={talk.id}>{talk.label}</option>)}
                </select>
              </label>
              <label>Question
                <select name="question" defaultValue={filters.questionId || ''}>
                  <option value="">All questions</option>
                  {options.questions.map((question) => <option key={question.id} value={question.id}>{question.label}</option>)}
                </select>
              </label>
              <label>Question family
                <select name="family" defaultValue={filters.family} data-testid="filter-family">
                  <option value="">All families</option>
                  {FAMILIES.map((family) => <option key={family} value={family}>{FAMILY_LABEL[family]}</option>)}
                </select>
              </label>
              <label>Learner
                <select name="learner" defaultValue={filters.learnerId || ''}>
                  <option value="">All learners</option>
                  {options.learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.label}</option>)}
                </select>
              </label>
              <label>Cohort or access code
                <select name="cohort" defaultValue={filters.accessCodeId || ''} data-testid="filter-cohort">
                  <option value="">All cohorts</option>
                  {codes.map((code) => <option key={code.id} value={code.id}>{str(code.label) || str(code.code)}</option>)}
                </select>
              </label>
              <label>From<input type="text" name="from" lang="en-GB" inputMode="numeric" placeholder="dd/mm/yyyy" autoComplete="off" spellCheck={false} defaultValue={displayDay(filters.from || '')} data-testid="filter-from" /></label>
              <label>To<input type="text" name="to" lang="en-GB" inputMode="numeric" placeholder="dd/mm/yyyy" autoComplete="off" spellCheck={false} defaultValue={displayDay(filters.to || '')} data-testid="filter-to" /></label>
              <label className="check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" name="anonymise" value="1" defaultChecked={anonymised} data-testid="anonymise" /> Anonymise
                <HelpTip topic="anonymise">{TOOL.anonymise}</HelpTip>
              </label>
              <div className="actions" style={{ alignSelf: 'end' }}><button className="btn" type="submit" data-testid="apply-filters">Apply</button></div>
            </div>
          </div>
        </form>

        <div className={styles.bar}>
          <div className={styles.switch}>
            <Link className={`btn small ${query.view === 'learner' ? 'ghost' : ''}`} href={`${here}?${filterQuery(filters, { filters: '1', anonymise: anonymised ? '1' : '', view: 'door' })}`} data-testid="view-door">By door</Link>
            <Link className={`btn small ${query.view === 'learner' ? '' : 'ghost'}`} href={`${here}?${filterQuery(filters, { filters: '1', anonymise: anonymised ? '1' : '', view: 'learner' })}`} data-testid="view-learner">By learner</Link>
          </div>
          <p className="hint" data-testid="privacy-note">{built.privateCount} kept private. Those answers are not shown and are not in a download.</p>
        </div>

        {query.view === 'learner' ? (
          <div className={styles.group} data-testid="learner-view">
            {built.learners.map((learner) => (
              <section className="panel" key={learner.learnerId} data-testid="learner-group">
                <header><h2>{learner.learner}</h2></header>
                <div className="body" style={{ display: 'grid', gap: 10 }}>
                  {learner.answers.map((answer) => (
                    <article className={styles.answer} key={answer.id} data-testid="feedback-answer">
                      <div className={styles.meta}><span className="badge teal">{answer.familyLabel}</span><span className="hint">{answer.door}{answer.talk ? ` · ${answer.talk}` : ''}</span></div>
                      <p><b>{answer.question}</b></p>
                      <p>{answer.text}</p>
                      <p className="hint">{answer.dateLabel}{answer.seat ? ` · ${answer.seat}` : ''}</p>
                      {answer.reply ? <p className={styles.reply}>Teacher reply: {answer.reply}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {!built.learners.length ? <p className="empty">Nothing shared matches these filters.</p> : null}
          </div>
        ) : (
          <div className={styles.group} data-testid="grouped-view">
            {built.doors.map((door) => (
              <section key={door.key} data-testid="door-group">
                <h2 className={styles.doorTitle}>{door.door}</h2>
                <p className="hint">{countPhrase(door.shared, door.privateCount)}</p>
                {door.talks.map((talk) => (
                  <article className={styles.talk} key={talk.key} data-testid="talk-group">
                    <header><h3>{talk.talk || 'Talk'}</h3>{talk.course ? <p>{talk.course}</p> : null}</header>
                    {talk.questions.map((question) => {
                      const draft = draftByKey.get(question.key)
                      const live = included.get(question.key)
                      return (
                        <div className={styles.question} key={question.key} data-testid="question-group">
                          <div className={styles.meta}><span className="badge teal">{question.familyLabel}</span>{question.privateCount ? <span className={styles.private} data-testid="kept-private">{question.privateCount} kept private</span> : null}</div>
                          <h4>{question.question}</h4>
                          {live ? (
                            <div className={styles.ai} data-testid="ai-summary">
                              <h5>AI summary <HelpTip topic="ai-summary">{TOOL.aiSummary}</HelpTip></h5>
                              <ul>{live.themes.map((theme) => <li key={theme}>{theme}</li>)}</ul>
                              {live.quotes.map((quote) => <blockquote key={quote}>“{quote}”</blockquote>)}
                            </div>
                          ) : null}
                          {draft && !live ? (
                            <div className={styles.ai} data-testid="ai-summary-draft">
                              <h5>AI summary · draft</h5>
                              <ul>{(Array.isArray(draft.themes) ? draft.themes : []).map((theme) => <li key={String(theme)}>{String(theme)}</li>)}</ul>
                              <p className="hint">This draft is not in the PDF until you include it.</p>
                              <form action={`/api/feedback?portal=${portal.slug}`} method="post">
                                <Hidden fields={{ action: 'include-summary', id: draft.id, next: `${here}?${pageQuery}` }} />
                                <button className="btn small" type="submit" data-testid="include-summary">Include in the digest</button>
                              </form>
                            </div>
                          ) : null}
                          {question.answers.map((answer) => (
                            <article className={styles.answer} key={answer.id} data-testid="feedback-answer">
                              <p><b>{answer.learner}</b> <span className="hint">{answer.dateLabel}</span></p>
                              <p>{answer.text}</p>
                              {answer.seat ? <p className="hint">{answer.seat}</p> : null}
                              {answer.reply ? <p className={styles.reply} data-testid="teacher-reply">Teacher reply: {answer.reply}</p> : null}
                            </article>
                          ))}
                          {!question.answers.length ? <p className="hint">No shared answer under this question.</p> : null}
                          {!draft && !live && question.answers.length ? (
                            <form action={`/api/feedback?portal=${portal.slug}`} method="post">
                              <Hidden fields={{ action: 'summarise', questionKey: question.key, next: `${here}?${pageQuery}`, anonymise: anonymised ? '1' : '', ...Object.fromEntries(filterQuery(filters)) }} />
                              <PortalAiChoice connected={ai.connected} settingsHref={user.role === 'portal-admin' ? `${base}/admin/settings` : undefined} />
                              <button className="btn small ghost" type="submit" data-testid="draft-summary">Draft a summary</button>
                            </form>
                          ) : null}
                        </div>
                      )
                    })}
                  </article>
                ))}
              </section>
            ))}
            {!built.doors.length ? <p className="empty" data-testid="feedback-empty">Nothing shared matches these filters.</p> : null}
          </div>
        )}

        <section className="panel" data-testid="weak-questions">
          <header>
            <div><h2>Question quality <HelpTip topic="weak-questions">{TOOL.weakQuestions}</HelpTip></h2><p>Weak questions, with a suggested rewrite kept as a draft</p></div>
            <form action={`/api/feedback?portal=${portal.slug}`} method="post">
              <Hidden fields={{ action: 'check-questions', next: `${here}?${pageQuery}` }} />
              <PortalAiChoice connected={ai.connected} settingsHref={user.role === 'portal-admin' ? `${base}/admin/settings` : undefined} />
              <button className="btn small" type="submit" data-testid="check-questions">Check questions for teacher value</button>
            </form>
          </header>
          <div className={`body ${styles.weak}`}>
            <p className="hint">The check flags questions whose answers would be yes or no, generic, or unhelpful to a sheikh. Rewrites are drafts only. Nothing is published over the live question.</p>
            {rewrites.map((row) => (
              <article key={row.id} data-testid="weak-question">
                <div className={styles.meta}><span className="badge ink">Draft</span>{row.family ? <span className="badge teal">{row.family}</span> : null}<span className="hint">{row.talk}</span></div>
                <p data-testid="weak-prompt">{row.prompt}</p>
                <ul>{row.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <p className={styles.rewrite} data-testid="weak-rewrite">{row.rewrite}</p>
              </article>
            ))}
            {!rewrites.length ? <p className="hint">No draft rewrites yet. Run the check when you want a list.</p> : null}
          </div>
        </section>

        {user.role === 'teacher' ? null : (
          <section className="panel" data-testid="export-audit">
            <header><div><h2>Export log</h2><p data-testid="audit-zone">Times in {zoneCity(timeZone)} time</p></div></header>
            <div className="table-wrap">
              <table className={`data ${styles.audit}`}>
                <thead><tr><th>When</th><th>Who</th><th>Kind</th><th className="num">Rows</th><th>Filters</th></tr></thead>
                <tbody>
                  {audits.map((row) => {
                    const detail = (row.detail || {}) as { named?: boolean; rows?: number; format?: string; filters?: Record<string, unknown> }
                    const who = row.actor as { name?: string; email?: string } | number | null
                    const name = who && typeof who === 'object' ? who.name || who.email : 'Staff'
                    return (
                      <tr key={row.id} data-testid="audit-row">
                        <td data-testid="audit-when" data-at={str(row.at)} style={{ whiteSpace: 'nowrap' }}>{zonedTime(str(row.at), timeZone, locale)}</td>
                        <td>{name}</td>
                        <td data-testid="audit-kind">{exportKindLabel(detail.format, detail.named)}</td>
                        <td className="num">{detail.rows ?? ''}</td>
                        <td className="hint">{filterPhrase(detail.filters)}</td>
                      </tr>
                    )
                  })}
                  {!audits.length ? <tr><td colSpan={5}>No exports yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminFrame>
  )
}

function optionLists(raw: RawFeedback[], anonymised: boolean) {
  const sharedIds = raw.filter((row) => sharingDecision(row) === 'share').map((row) => row.learnerId)
  const names = anonymised ? assignPseudonyms(sharedIds) : null
  const seats = unique(raw.filter((row) => row.seatId).map((row) => ({ id: row.seatId as number, label: row.seat })))
  const courses = unique(raw.filter((row) => row.courseId).map((row) => ({ id: row.courseId as number, label: row.course })))
  const talks = unique(raw.filter((row) => row.talkId).map((row) => ({ id: row.talkId as number, label: row.talk })))
  const questions = unique(raw.filter((row) => row.questionId).map((row) => ({ id: row.questionId as number, label: row.question })))
  const learners = unique(raw.filter((row) => row.learnerId && sharingDecision(row) === 'share').map((row) => ({ id: row.learnerId, label: names?.get(row.learnerId) || row.learnerName })))
  return { seats, courses, talks, questions, learners }
}

function unique<T extends { id: number; label: string }>(rows: T[]) {
  const map = new Map<number, T>()
  for (const row of rows) if (!map.has(row.id)) map.set(row.id, row)
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function filterPhrase(filters: Record<string, unknown> | undefined) {
  if (!filters) return 'All'
  const parts = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`)
  return parts.length ? parts.join(', ') : 'All'
}
