import Link from 'next/link'
import { Hidden } from '@/components/app/shell'
import { ReviewKeys, ReviewPlayer } from '@/components/desk/review'
import {
  densityReport,
  groupExtractSummary,
  neighborSuggested,
  nestForTimeline,
  reviewAfterDecision,
  suggestedQueue,
  withExtractParam,
  type TalkExtract,
} from '@/lib/extracts'
import { ExtractPlay } from './extract-play'

function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

function kindLabel(kind: TalkExtract['kind']) {
  return kind === 'hors' ? "hors d'oeuvre" : 'appetiser'
}

function statusLabel(status: TalkExtract['status']) {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Set aside'
  if (status === 'suggested') return 'Suggested'
  return 'Draft'
}

function statusTone(status: TalkExtract['status']) {
  if (status === 'approved') return 'teal'
  if (status === 'rejected') return 'grey'
  return 'gold'
}

function arcLabel(arc: TalkExtract['arc']) {
  if (arc === 'hook') return 'Hook'
  if (arc === 'turn') return 'Turn'
  if (arc === 'land') return 'Land'
  return null
}

function Nudge({ extract, next, edge, step, label }: { extract: number; next: string; edge: 'start' | 'end'; step: 'back' | 'forward'; label: string }) {
  return (
    <form action="/api/hearts" method="post" className="extract-nudge" data-testid="extract-nudge">
      <Hidden fields={{ action: 'extract-nudge', extract, next, edge, step }} />
      <button className="btn ghost small" type="submit">{label}</button>
    </form>
  )
}

function ExtractActions({ extract, next, locked }: { extract: TalkExtract; next: string; locked: boolean }) {
  if (locked || extract.id == null) return null
  return (
    <div className="extract-actions">
      <form action="/api/hearts" method="post" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Hidden fields={{ action: 'extract-status', extract: extract.id, next }} />
        {extract.status !== 'approved' ? <button className="btn teal small" name="status" value="approved" data-testid="extract-approve" type="submit">Approve</button> : null}
        {extract.status !== 'rejected' ? <button className="btn ghost small" name="status" value="rejected" data-testid="extract-reject" type="submit">Set aside</button> : null}
        {extract.status !== 'draft' ? <button className="btn ghost small" name="status" value="draft" type="submit">Back to draft</button> : null}
      </form>
      <Nudge extract={extract.id} next={next} edge="start" step="back" label="Start earlier" />
      <Nudge extract={extract.id} next={next} edge="start" step="forward" label="Start later" />
      <Nudge extract={extract.id} next={next} edge="end" step="back" label="End earlier" />
      <Nudge extract={extract.id} next={next} edge="end" step="forward" label="End later" />
    </div>
  )
}

function ExtractRow({
  extract,
  next,
  locked,
  youtubeId,
  nested,
  flag,
  current,
}: {
  extract: TalkExtract
  next: string
  locked: boolean
  youtubeId: string | null
  nested?: boolean
  flag?: string | null
  current?: boolean
}) {
  const arc = arcLabel(extract.arc)
  return (
    <article
      className={`extract-row${nested ? ' nested' : ''}${flag === 'orphan' ? ' flagged' : ''}${current ? ' current' : ''}`}
      data-testid={extract.kind === 'appetiser' ? 'extract-appetiser' : 'extract-hors'}
      data-kind={extract.kind}
      data-status={extract.status}
      data-arc={extract.arc || ''}
      data-empty={flag === 'empty' ? 'yes' : undefined}
      data-orphan={flag === 'orphan' ? 'yes' : undefined}
      data-current={current ? 'yes' : undefined}
      id={extract.id != null ? `extract-${extract.id}` : undefined}
    >
      <div className="extract-time">
        <b>{clock(extract.start)}</b>
        <small>to {clock(extract.end)}</small>
        <span className={`badge ${statusTone(extract.status)}`}>{statusLabel(extract.status)}</span>
        {arc ? <span className="badge gold" data-testid="extract-arc">{arc}</span> : null}
      </div>
      <div className="extract-body">
        <p className="extract-kind">{kindLabel(extract.kind)}</p>
        <p>{extract.quote || <span className="hint">No spoken line stored.</span>}</p>
        {flag === 'empty' ? <p className="extract-empty-note" data-testid="extract-empty">This appetiser has no hors d&apos;oeuvre yet.</p> : null}
        {flag === 'orphan' ? <p className="extract-flag" data-testid="extract-orphan">This hors d&apos;oeuvre belongs to no appetiser.</p> : null}
        <ExtractActions extract={extract} next={next} locked={locked} />
        {youtubeId ? <ExtractPlay youtubeId={youtubeId} start={extract.start} /> : null}
      </div>
    </article>
  )
}

function ExtractReview({
  extracts,
  currentId,
  next,
  locked,
  youtubeId,
}: {
  extracts: TalkExtract[]
  currentId: number | null
  next: string
  locked: boolean
  youtubeId: string | null
}) {
  const queue = suggestedQueue(extracts)
  if (!queue.length || locked) return null
  const focusId = currentId && queue.some((row) => row.id === currentId) ? currentId : queue[0]?.id ?? null
  const current = extracts.find((row) => row.id === focusId) || null
  const index = queue.findIndex((row) => row.id === focusId)
  const prevId = neighborSuggested(extracts, focusId, -1)
  const nextId = neighborSuggested(extracts, focusId, 1)
  const after = current?.id != null ? reviewAfterDecision(extracts, current.id) : nextId
  const afterUrl = withExtractParam(next, after)
  const prevUrl = prevId != null ? withExtractParam(next, prevId) : null
  const nextUrl = nextId != null ? withExtractParam(next, nextId) : null

  return (
    <div className="extract-review" data-testid="extract-review" data-extract={focusId || ''}>
      <ReviewKeys />
      <p data-testid="extract-review-count">
        {queue.length} {queue.length === 1 ? 'suggested pick' : 'suggested picks'} waiting on this talk. Play the clip, then approve or set aside. Only approved extracts reach learners.
      </p>
      <p className="hint review-keys" data-testid="review-shortcuts">Keys: P play, A approve, R set aside, J or → next, K or ← previous.</p>
      <div className="actions review-step">
        {prevUrl ? <Link className="btn ghost small" href={prevUrl} data-key="k" data-testid="review-prev">‹ Previous <kbd>K</kbd></Link> : <span className="btn ghost small" aria-disabled="true">‹ Previous</span>}
        <span className="hint" data-testid="review-position">{index >= 0 ? index + 1 : 1} of {queue.length}</span>
        {nextUrl ? <Link className="btn ghost small" href={nextUrl} data-key="j" data-testid="review-next">Next <kbd>J</kbd> ›</Link> : <span className="btn ghost small" aria-disabled="true">Next ›</span>}
      </div>
      {current ? (
        <div className="extract-review-clip">
          <p className="extract-kind">{kindLabel(current.kind)} · {clock(current.start)} to {clock(current.end)}</p>
          <p>{current.quote || <span className="hint">No spoken line stored.</span>}</p>
          <ReviewPlayer
            youtubeId={youtubeId}
            autoplay="p"
            segments={[{ key: 'p', label: 'Play this clip', start: current.start, end: current.end }]}
          />
          <div className="actions">
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'extract-status', extract: current.id, status: 'approved', next: afterUrl }} />
              <button className="btn teal" type="submit" data-key="a" data-testid="extract-review-approve">Approve <kbd>A</kbd></button>
            </form>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'extract-status', extract: current.id, status: 'rejected', next: afterUrl }} />
              <button className="btn ghost" type="submit" data-key="r" data-testid="extract-review-reject">Set aside <kbd>R</kbd></button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ExtractTimeline({
  extracts,
  duration,
  youtubeId,
  next,
  locked,
  currentExtract = null,
}: {
  extracts: TalkExtract[]
  duration: number
  youtubeId: string | null
  next: string
  locked: boolean
  currentExtract?: number | null
}) {
  const report = densityReport(duration, extracts)
  const nest = nestForTimeline(extracts)
  const summary = groupExtractSummary(nest.groups, nest.orphans)
  const shown = 4
  const rest = nest.groups.length > shown ? nest.groups.slice(shown) : []
  const head = rest.length ? nest.groups.slice(0, shown) : nest.groups
  const bar = (have: number, want: number) => Math.min(100, Math.round((have / Math.max(1, want)) * 100))
  const waiting = suggestedQueue(extracts).length
  const suggestedNote = waiting
    ? ` · ${waiting} ${waiting === 1 ? 'suggested pick' : 'suggested picks'} waiting`
    : report.horsSuggested || report.appetiserSuggested
      ? ` · ${report.horsSuggested + report.appetiserSuggested} suggested`
      : ''

  const renderGroup = (group: (typeof nest.groups)[number]) => (
    <div key={group.appetiser.id || group.appetiser.start} className="extract-group" data-testid="extract-group" data-empty={group.empty ? 'yes' : 'no'}>
      <ExtractRow extract={group.appetiser} next={next} locked={locked} youtubeId={youtubeId} flag={group.empty ? 'empty' : null} current={group.appetiser.id === currentExtract} />
      {group.hors.map((row) => (
        <ExtractRow key={row.id || row.start} extract={row} next={next} locked={locked} youtubeId={youtubeId} nested current={row.id === currentExtract} />
      ))}
    </div>
  )

  return (
    <section className="panel extract-desk" data-testid="extract-timeline">
      <header>
        <div>
          <h2>Extracts on this talk</h2>
          <p data-testid="extract-summary">{summary}</p>
        </div>
        <details className="extract-help" data-testid="extract-help">
          <summary aria-label="What these extracts are">?</summary>
          <div>
            <p>An appetiser is a hook, a turn and a land. Hors d&apos;oeuvres are drawn from inside it. Most appetisers hold none or one strong hors d&apos;oeuvre, usually the turn running into the land. An appetiser with no hors is common, not an error.</p>
            <p>We attach a hors d&apos;oeuvre to the tightest appetiser whose time holds it. A later file may name the real parents.</p>
            <p>The machine score on a single clip is noisy near the line. AI picks arrive as suggested. Only approved extracts reach learners. This timeline is the decision: play the clip, approve or set aside, then go to the next.</p>
            <p>Aim for about one hors d&apos;oeuvre every 6 minutes and one appetiser every 15 minutes.</p>
          </div>
        </details>
      </header>
      <div className="body">
        <ExtractReview extracts={extracts} currentId={currentExtract} next={next} locked={locked} youtubeId={youtubeId} />
        <div className="extract-density" data-testid="extract-density" data-hors-met={report.horsMet ? 'yes' : 'no'} data-appetiser-met={report.appetiserMet ? 'yes' : 'no'}>
          <p>
            {Math.round(report.minutes)} minutes · {report.hors} of {report.horsTarget} hors d&apos;oeuvres
            {report.horsDraft ? ` (${report.horsDraft} still draft)` : ''}
            {' · '}{report.appetiser} of {report.appetiserTarget} appetisers
            {report.appetiserDraft ? ` (${report.appetiserDraft} still draft)` : ''}
            {suggestedNote}
          </p>
          <div className="extract-bars" aria-hidden>
            <div><i style={{ width: `${bar(report.hors, report.horsTarget)}%` }} /></div>
            <div><i style={{ width: `${bar(report.appetiser, report.appetiserTarget)}%` }} /></div>
          </div>
        </div>
        {head.map(renderGroup)}
        {rest.length ? (
          <details className="extract-more" data-testid="extract-more">
            <summary>{groupExtractSummary(rest, [])}</summary>
            {rest.map(renderGroup)}
          </details>
        ) : null}
        {nest.orphans.length ? (
          <div className="extract-orphans" data-testid="extract-orphans">
            <h3>Hors d&apos;oeuvres with no appetiser</h3>
            {nest.orphans.map((row) => (
              <ExtractRow key={row.id || row.start} extract={row} next={next} locked={locked} youtubeId={youtubeId} flag="orphan" current={row.id === currentExtract} />
            ))}
          </div>
        ) : null}
        {!extracts.length ? <p className="empty">No extracts on this talk yet. The old hors and appetiser pair is copied here when the talk is saved or imported.</p> : null}
      </div>
    </section>
  )
}
